import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Verifica la solicitud HTTP que realmente serializa @google/genai a partir del
// adaptador, sin red: fetch se intercepta y la clave es ficticia. Se fija el
// entorno ANTES de importar (dotenv no pisa variables ya definidas).
process.env.IA_API_KEY = 'clave-ficticia-de-prueba';
process.env.IA_MODELO = 'gemini-3.8-flash';
process.env.IA_NIVEL_RAZONAMIENTO = 'low';
delete process.env.IA_SIMULACION;

let pedidos = [];
let respuesta = () => new Response('{}', { status: 200 });
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  pedidos.push({ url: req.url, metodo: req.method, encabezados: req.headers, cuerpo: JSON.parse(await req.text()) });
  return respuesta();
};
const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const gemini = await import('../src/ia/adaptadores/gemini.adapter.js');
const { llamarModelo } = await import('../src/ia/extractor.js');
const { ESQUEMA_JSON } = await import('../src/ia/esquemaComprobante.js');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');
const exito = json(200, {
  id: 'x',
  status: 'completed',
  steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"ok":true}' }] }],
  usage: { total_input_tokens: 10, total_output_tokens: 5, total_thought_tokens: 2 },
});

beforeEach(() => {
  pedidos = [];
  respuesta = exito;
});

// Palabras clave de JSON Schema admitidas por la salida estructurada (docs oficiales).
const ADMITIDAS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'description', 'title', 'enum', 'format',
  'minimum', 'maximum', 'items', 'prefixItems', 'minItems', 'maxItems', 'anyOf',
]);
function clavesNoAdmitidas(nodo, ruta = '$') {
  if (!nodo || typeof nodo !== 'object') return [];
  const malas = Object.keys(nodo).filter((k) => !ADMITIDAS.has(k)).map((k) => `${ruta}.${k}`);
  for (const [k, hijo] of Object.entries(nodo.properties ?? {})) malas.push(...clavesNoAdmitidas(hijo, `${ruta}.${k}`));
  if (nodo.items) malas.push(...clavesNoAdmitidas(nodo.items, `${ruta}[]`));
  return malas;
}

test('PDF: una sola solicitud POST a v1beta/interactions con la forma documentada', async () => {
  const r = await gemini.llamar({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 });
  assert.equal(pedidos.length, 1);
  const p = pedidos[0];
  const url = new URL(p.url);
  assert.equal(p.metodo, 'POST');
  assert.equal(url.pathname, '/v1beta/interactions');
  assert.equal(url.search, '', 'la clave no va en la URL');
  assert.equal(p.encabezados.get('x-goog-api-key'), 'clave-ficticia-de-prueba');

  const c = p.cuerpo;
  assert.deepEqual(Object.keys(c).sort(), ['generation_config', 'input', 'model', 'response_format', 'store']);
  assert.equal(c.model, 'gemini-3.8-flash');
  assert.equal(c.store, false);
  assert.deepEqual(c.generation_config, { thinking_level: 'low' });
  assert.equal(c.input.length, 2);
  assert.equal(c.input[0].type, 'text');
  assert.deepEqual(c.input[1], { type: 'document', data: PDF.toString('base64'), mime_type: 'application/pdf' });
  assert.deepEqual(c.response_format, { type: 'text', mime_type: 'application/json', schema: ESQUEMA_JSON });

  assert.equal(r.texto, '{"ok":true}');
  assert.deepEqual(r.uso, { entrada: 10, salida: 5, razonamiento: 2 });
  // Resumen sin contenido: permite detectar bloques que output_text no incluya.
  assert.deepEqual(r.estructura, [{ tipo: 'model_output', contenidos: [{ tipo: 'text', largo: 11 }] }]);
});

test('imagen: se envía como bloque "image" con su MIME', async () => {
  await gemini.llamar({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), mime: 'image/jpeg', origen: 'FOTO', timeoutMs: 5000 });
  assert.deepEqual(pedidos[0].cuerpo.input[1], { type: 'image', data: '/9j/4A==', mime_type: 'image/jpeg' });
});

test('no envía parámetros prohibidos ni pagos (service_tier, sampling, background)', async () => {
  await gemini.llamar({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 });
  const c = pedidos[0].cuerpo;
  for (const k of ['service_tier', 'temperature', 'top_p', 'top_k', 'background', 'previous_interaction_id', 'tools']) {
    assert.equal(k in c, false, k);
  }
  for (const k of ['temperature', 'top_p', 'thinking_budget']) assert.equal(k in c.generation_config, false, k);
  assert.ok(['low', 'medium', 'high'].includes(c.generation_config.thinking_level), 'minimal no es válido en 3.8 Flash');
});

test('el JSON Schema enviado usa solo palabras clave admitidas', () => {
  assert.deepEqual(clavesNoAdmitidas(ESQUEMA_JSON), []);
});

test('sin reintentos ocultos del SDK: un 503 produce una sola solicitud', async () => {
  respuesta = json(503, { error: { code: 'service_unavailable', message: 'x' } });
  await assert.rejects(llamarModelo({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 }), (e) => e.codigo === 'SERVICIO_NO_DISPONIBLE');
  assert.equal(pedidos.length, 1);
});

test('un 400 conserva el mensaje del proveedor saneado para el servidor', async () => {
  respuesta = json(400, { error: { code: 'invalid_request', message: 'Invalid value at response_format.schema' } });
  await assert.rejects(llamarModelo({ buffer: PDF, mime: 'application/pdf', origen: 'PDF', timeoutMs: 5000 }), (e) => {
    assert.equal(e.codigo, 'SOLICITUD_RECHAZADA');
    assert.equal(e.proveedor.status, 400);
    assert.equal(e.proveedor.code, 'invalid_request');
    assert.equal(e.proveedor.message, 'Invalid value at response_format.schema');
    assert.ok(!JSON.stringify(e.proveedor).includes('clave-ficticia'));
    return true;
  });
  assert.equal(pedidos.length, 1);
});
