import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Verifica la solicitud HTTP que realmente serializa @anthropic-ai/sdk a partir
// del adaptador, sin red: fetch se intercepta y la clave es ficticia. Se fija
// el entorno ANTES de importar (dotenv no pisa variables ya definidas).
process.env.IA_PROVEEDOR = 'claude';
process.env.IA_API_KEY = 'sk-ant-clave-ficticia-de-prueba';
process.env.IA_MODELO = 'claude-haiku-5-5';
process.env.IA_NIVEL_RAZONAMIENTO = 'low';
delete process.env.IA_SIMULACION;

let pedidos = [];
let respuesta = () => new Response('{}', { status: 200 });
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  pedidos.push({ url: req.url, metodo: req.method, encabezados: req.headers, cuerpo: JSON.parse(await req.text()) });
  return respuesta();
};
const json = (status, cuerpo) => () =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', 'request-id': 'req_prueba' } });

const claude = await import('../src/ia/adaptadores/claude.adapter.js');
const { llamarModelo } = await import('../src/ia/extractor.js');
const { adaptadorPorDefecto, planificar } = await import('../src/ia/asistente.js');
const { ESQUEMA_JSON } = await import('../src/ia/esquemaComprobante.js');
const { ESQUEMA_PLAN } = await import('../src/ia/instruccionesAsistente.js');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');
// Foto HEIC de 64 × 48 px (como las del iPhone), generada para esta prueba.
const HEIC = Buffer.from(
  'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAX1tZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABoQABAAAAAAAAAIoAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA/WlwcnAAAADdaXBjbwAAAHZodmNDAQNwAAAAkAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbq5Ka5uAhoMCAAAAMDIAAAAwAhYgABAAZEAcFzwIkAAAATY29scm5jbHgAAQANAAaAAAAAFGlzcGUAAAAAAAAAQAAAAEAAAAAoY2xhcAAAAEAAAAABAAAAMAAAAAEAAAAAAAAAAv////AAAAACAAAAEHBpeGkAAAAAAwgICAAAABhpcG1hAAAAAAAAAAEAAQWBAgMFhAAAAJJtZGF0AAAAhigBrwngI7/xjxp88Xv/ToT+xOytPtbfG3n0Sb4JGEGnhhrIsVIzBvxiAPNGAtOeCwyqQTbmzRi/9h+JnMlXPyHli1FTlGgaJnnr8fKvUEKIgNgdFHWqbHIt/8rOcOIX29cd206WmOJJ4wAREIdxL83WCdg1tczeO7oP//kDe7307Pm09C64',
  'base64',
);

const mensaje = (texto, extra = {}) => ({
  id: 'msg_prueba',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: texto }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5, output_tokens_details: { thinking_tokens: 2 } },
  ...extra,
});
const exito = json(200, mensaje('{"ok":true}'));
const errorAnthropic = (status, tipo, texto) => json(status, { type: 'error', error: { type: tipo, message: texto } });

beforeEach(() => {
  pedidos = [];
  respuesta = exito;
});

// Recorre el esquema y devuelve los objetos sin additionalProperties: false.
function objetosAbiertos(nodo, ruta = '$') {
  if (!nodo || typeof nodo !== 'object') return [];
  const tipos = Array.isArray(nodo.type) ? nodo.type : [nodo.type];
  const malos = tipos.includes('object') && nodo.additionalProperties !== false ? [ruta] : [];
  for (const [k, hijo] of Object.entries(nodo.properties ?? {})) malos.push(...objetosAbiertos(hijo, `${ruta}.${k}`));
  if (nodo.items) malos.push(...objetosAbiertos(nodo.items, `${ruta}[]`));
  return malos;
}

// Límites documentados de la salida estructurada: 24 parámetros opcionales
// y 16 con unión de tipos por solicitud.
function contar(nodo, cuenta = { opcionales: 0, uniones: 0 }) {
  if (!nodo || typeof nodo !== 'object') return cuenta;
  const requeridos = new Set(nodo.required ?? []);
  for (const [k, hijo] of Object.entries(nodo.properties ?? {})) {
    if (!requeridos.has(k)) cuenta.opcionales += 1;
    if (Array.isArray(hijo.type) || hijo.anyOf) cuenta.uniones += 1;
    contar(hijo, cuenta);
  }
  if (nodo.items) contar(nodo.items, cuenta);
  return cuenta;
}

test('PDF: una sola solicitud POST a /v1/messages con la forma documentada', async () => {
  const r = await claude.llamar({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 });
  assert.equal(pedidos.length, 1);
  const p = pedidos[0];
  const url = new URL(p.url);
  assert.equal(p.metodo, 'POST');
  assert.equal(url.origin + url.pathname, 'https://api.anthropic.com/v1/messages');
  assert.equal(url.search, '', 'la clave no va en la URL');
  // El SDK 1.x envía la clave como Bearer.
  assert.equal(p.encabezados.get('authorization'), 'Bearer sk-ant-clave-ficticia-de-prueba');

  const c = p.cuerpo;
  assert.deepEqual(Object.keys(c).sort(), ['max_tokens', 'messages', 'model', 'output_config']);
  assert.equal(c.model, 'claude-haiku-5-5');
  assert.equal(c.messages.length, 1);
  const [archivo, texto] = c.messages[0].content;
  assert.deepEqual(archivo, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF.toString('base64') } });
  assert.equal(texto.type, 'text');
  assert.equal(c.output_config.effort, 'low');
  assert.equal(c.output_config.format.type, 'json_schema');
  assert.deepEqual(c.output_config.format.schema, claude.paraClaude(ESQUEMA_JSON));

  assert.equal(r.texto, '{"ok":true}', 'solo el texto, sin el bloque de razonamiento');
  assert.equal(r.estado, 'end_turn');
  assert.deepEqual(r.uso, { entrada: 10, salida: 5, razonamiento: 2 });
  assert.deepEqual(r.estructura, [{ tipo: 'thinking', largo: null }, { tipo: 'text', largo: 11 }]);
});

test('imagen: se envía como bloque "image" en base64 con su MIME', async () => {
  await claude.llamar({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), mime: 'image/jpeg', origen: 'FOTO', timeoutMs: 5000 });
  assert.deepEqual(pedidos[0].cuerpo.messages[0].content[0], {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4A==' },
  });
});

test('HEIC: se convierte a JPEG antes de enviarlo (Claude no lo acepta)', async () => {
  await claude.llamar({ buffer: HEIC, mime: 'image/heic', origen: 'FOTO', timeoutMs: 5000 });
  const { source } = pedidos[0].cuerpo.messages[0].content[0];
  assert.equal(source.media_type, 'image/jpeg');
  const jpeg = Buffer.from(source.data, 'base64');
  assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff], 'cabecera JPEG');
});

test('no envía parámetros de muestreo ni de pago (temperature, service_tier, budget)', async () => {
  await claude.llamar({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 });
  const c = pedidos[0].cuerpo;
  for (const k of ['temperature', 'top_p', 'top_k', 'service_tier', 'thinking', 'speed', 'tools']) assert.equal(k in c, false, k);
});

test('los esquemas enviados cumplen las reglas de la salida estructurada de Claude', () => {
  for (const esquema of [ESQUEMA_JSON, ESQUEMA_PLAN]) {
    const enviado = claude.paraClaude(esquema);
    assert.deepEqual(objetosAbiertos(enviado), [], 'todo objeto lleva additionalProperties: false');
    assert.ok(!JSON.stringify(enviado).includes('propertyOrdering'), 'propertyOrdering es solo de Gemini');
    const { opcionales, uniones } = contar(enviado);
    assert.ok(opcionales <= 24, `opcionales: ${opcionales}`);
    assert.ok(uniones <= 16, `uniones: ${uniones}`);
  }
  // El esquema original (el de Gemini) no se modifica.
  assert.ok('propertyOrdering' in ESQUEMA_PLAN.properties.argumentos);
});

test('asistente: el planificador usa el adaptador de Claude con su esquema', async () => {
  respuesta = json(200, mensaje('{"accion":"aclaracion","herramienta":null,"argumentos":null,"mensaje":"¿Qué producto?"}'));
  const adaptador = adaptadorPorDefecto();
  assert.equal(adaptador.nombre, 'claude');
  const r = await planificar(adaptador, { pregunta: '¿cuánto queda?', hoy: '2026-11-16', timeoutMs: 5000 });
  assert.equal(r.texto.includes('aclaracion'), true);
  const c = pedidos[0].cuerpo;
  assert.equal(typeof c.system, 'string');
  assert.equal(c.messages[0].content, 'Pregunta: ¿cuánto queda?');
  assert.deepEqual(c.output_config.format.schema, claude.paraClaude(ESQUEMA_PLAN));
});

test('sin reintentos ocultos del SDK: un 529 (saturado) produce una sola solicitud', async () => {
  respuesta = errorAnthropic(529, 'overloaded_error', 'Overloaded');
  await assert.rejects(llamarModelo({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 }), (e) => e.codigo === 'SERVICIO_NO_DISPONIBLE');
  assert.equal(pedidos.length, 1);
});

test('errores de Anthropic: clave, saldo y límite por minuto', async () => {
  const casos = [
    [errorAnthropic(401, 'authentication_error', 'invalid x-api-key'), 'CLAVE_RECHAZADA'],
    [errorAnthropic(402, 'billing_error', 'Payment required'), 'SIN_CREDITO'],
    [errorAnthropic(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'), 'SIN_CREDITO'],
    [errorAnthropic(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit'), 'LIMITE_POR_MINUTO'],
    [errorAnthropic(404, 'not_found_error', 'model: claude-inexistente'), 'MODELO_NO_DISPONIBLE'],
  ];
  for (const [r, codigo] of casos) {
    respuesta = r;
    await assert.rejects(llamarModelo({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 }), (e) => {
      assert.equal(e.codigo, codigo);
      assert.ok(!JSON.stringify(e.proveedor).includes('clave-ficticia'));
      return true;
    });
  }
});

test('un 400 conserva el tipo y el mensaje del proveedor saneados', async () => {
  respuesta = errorAnthropic(400, 'invalid_request_error', 'output_config.format.schema: Schema is too complex for compilation');
  await assert.rejects(llamarModelo({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 }), (e) => {
    assert.equal(e.codigo, 'SOLICITUD_RECHAZADA');
    assert.equal(e.proveedor.status, 400);
    assert.equal(e.proveedor.code, 'invalid_request_error');
    assert.match(e.proveedor.message, /too complex/);
    return true;
  });
});
