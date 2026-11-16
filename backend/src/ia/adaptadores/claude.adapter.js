import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { ESQUEMA_JSON } from '../esquemaComprobante.js';
import { INSTRUCCIONES } from '../instrucciones.js';
import { instruccionesAsistente, ESQUEMA_PLAN } from '../instruccionesAsistente.js';

// RNF6 (Adapter): único módulo que conoce el SDK de Anthropic. Ofrece las
// mismas dos operaciones que gemini.adapter.js (leer un comprobante y
// planificar una pregunta del asistente) y devuelve lo mismo.
// - Una sola solicitud HTTP por llamada: el SDK reintenta por defecto 2 veces;
//   se desactiva para que cada intento quede registrado y limitado por la
//   lógica de cuota del backend.
// - Salida estructurada (output_config.format) con el mismo esquema que se
//   le pide a Gemini, adaptado a las reglas de Claude (ver paraClaude).
// - El razonamiento lo regula IA_NIVEL_RAZONAMIENTO (low | medium | high),
//   que se envía como effort.
let cliente = null;

function obtenerCliente() {
  // La clave se pasa explícitamente: no se toma ANTHROPIC_API_KEY del entorno.
  if (!cliente) cliente = new Anthropic({ apiKey: env.ia.apiKey, maxRetries: 0 });
  return cliente;
}

export const nombre = 'claude';

// Respuesta larga posible: hasta 200 líneas de comprobante (MAX_LINEAS).
const MAX_TOKENS_LECTURA = 16000;
const MAX_TOKENS_PLAN = 4000;

// La salida estructurada de Claude exige additionalProperties: false en cada
// objeto y no conoce propertyOrdering (propio de Gemini). Claude respeta el
// orden de las propiedades del esquema, con las obligatorias primero.
export function paraClaude(nodo) {
  if (Array.isArray(nodo)) return nodo.map(paraClaude);
  if (!nodo || typeof nodo !== 'object') return nodo;
  const copia = {};
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === 'propertyOrdering') continue;
    if (clave === 'properties') {
      copia.properties = Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, paraClaude(v)]));
    } else {
      copia[clave] = paraClaude(valor);
    }
  }
  const tipos = Array.isArray(copia.type) ? copia.type : [copia.type];
  if (tipos.includes('object')) copia.additionalProperties = false;
  return copia;
}

const ESQUEMA_LECTURA = paraClaude(ESQUEMA_JSON);
const ESQUEMA_PLAN_CLAUDE = paraClaude(ESQUEMA_PLAN);

// Claude no acepta HEIC/HEIF (la cámara del iPhone): se convierte a JPEG.
// Normalmente el navegador ya lo convierte al comprimir la foto; esto cubre
// los que no lo decodifican (por ejemplo, Chrome en Windows).
const MIME_HEIC = ['image/heic', 'image/heif'];

async function imagenParaClaude(buffer, mime) {
  if (!MIME_HEIC.includes(mime)) return { datos: buffer, mime };
  const { default: convertir } = await import('heic-convert');
  const jpeg = await convertir({ buffer, format: 'JPEG', quality: 0.9 });
  return { datos: Buffer.from(jpeg), mime: 'image/jpeg' };
}

async function bloqueArchivo({ buffer, mime, origen }) {
  if (origen === 'PDF') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } };
  }
  const { datos, mime: tipo } = await imagenParaClaude(buffer, mime);
  return { type: 'image', source: { type: 'base64', media_type: tipo, data: datos.toString('base64') } };
}

const textoDe = (mensaje) =>
  (mensaje.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

// Resumen de la estructura (tipos y largos, sin contenido), como en Gemini.
export function resumirBloques(mensaje) {
  if (!Array.isArray(mensaje?.content)) return null;
  return mensaje.content.map((b) => ({ tipo: b?.type ?? null, largo: typeof b?.text === 'string' ? b.text.length : null }));
}

// Devuelve el texto crudo de la respuesta; los errores del SDK se propagan
// para que el extractor los traduzca.
export async function llamar({ buffer, mime, origen, timeoutMs }) {
  const archivo = await bloqueArchivo({ buffer, mime, origen });
  const mensaje = await obtenerCliente().messages.create(
    {
      model: env.ia.modelo,
      max_tokens: MAX_TOKENS_LECTURA,
      // El documento va antes del texto, como recomienda la documentación.
      messages: [{ role: 'user', content: [archivo, { type: 'text', text: INSTRUCCIONES }] }],
      output_config: {
        effort: env.ia.nivelRazonamiento,
        format: { type: 'json_schema', schema: ESQUEMA_LECTURA },
      },
    },
    { timeout: timeoutMs, maxRetries: 0 },
  );
  return {
    // Una negativa o un corte por max_tokens no cumplen el esquema: el
    // extractor lo informa como respuesta inválida.
    texto: textoDe(mensaje),
    estado: mensaje.stop_reason ?? null,
    estructura: resumirBloques(mensaje),
    uso: mensaje.usage
      ? {
          entrada: mensaje.usage.input_tokens ?? null,
          salida: mensaje.usage.output_tokens ?? null,
          razonamiento: mensaje.usage.output_tokens_details?.thinking_tokens ?? null,
        }
      : null,
    modelo: env.ia.modelo,
  };
}

// HU25: planificador del asistente. Una sola solicitud con el tiempo que le
// queda a la consulta; devuelve el texto JSON del plan, que valida
// ia/asistente.js.
export async function planificar({ pregunta, hoy, timeoutMs }) {
  const mensaje = await obtenerCliente().messages.create(
    {
      model: env.ia.modelo,
      max_tokens: MAX_TOKENS_PLAN,
      system: instruccionesAsistente(hoy),
      messages: [{ role: 'user', content: `Pregunta: ${pregunta}` }],
      output_config: {
        effort: env.ia.nivelRazonamiento,
        format: { type: 'json_schema', schema: ESQUEMA_PLAN_CLAUDE },
      },
    },
    { timeout: timeoutMs, maxRetries: 0 },
  );
  return { texto: textoDe(mensaje), modelo: env.ia.modelo };
}
