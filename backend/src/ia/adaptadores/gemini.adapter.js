import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { ESQUEMA_JSON } from '../esquemaComprobante.js';
import { INSTRUCCIONES } from '../instrucciones.js';

// HU9 / RNF6 (Adapter): único módulo que conoce el SDK de Gemini.
// - Interactions API con store:false (Google no conserva la interacción).
// - Una sola solicitud HTTP por llamada: el SDK reintenta por defecto hasta
//   4 veces (408/409/429/5xx); se desactiva para que cada intento quede
//   registrado y limitado por nuestra lógica de cuota.
// - Sin service_tier, sin sampling y sin cambiar de modelo.
let cliente = null;

function obtenerCliente() {
  // La clave se pasa explícitamente: el SDK no toma GOOGLE_API_KEY del entorno.
  if (!cliente) cliente = new GoogleGenAI({ apiKey: env.ia.apiKey });
  return cliente;
}

export const nombre = 'gemini';

export function resumirPasos(pasos) {
  if (!Array.isArray(pasos)) return null;
  return pasos.map((p) => ({
    tipo: p?.type ?? null,
    contenidos: Array.isArray(p?.content)
      ? p.content.map((c) => ({ tipo: c?.type ?? null, largo: typeof c?.text === 'string' ? c.text.length : null }))
      : null,
  }));
}

// Devuelve el texto crudo de la respuesta; los errores del SDK se propagan
// para que el extractor los traduzca.
export async function llamar({ buffer, mime, origen, timeoutMs }) {
  const archivo = {
    type: origen === 'PDF' ? 'document' : 'image',
    data: buffer.toString('base64'),
    mime_type: mime,
  };
  const interaccion = await obtenerCliente().interactions.create(
    {
      model: env.ia.modelo,
      input: [{ type: 'text', text: INSTRUCCIONES }, archivo],
      response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA_JSON },
      generation_config: { thinking_level: env.ia.nivelRazonamiento },
      store: false,
    },
    { timeout_ms: timeoutMs, retries: { strategy: 'none' } },
  );
  return {
    texto: interaccion.output_text ?? '',
    estado: interaccion.status,
    // Resumen de la estructura (tipos y largos, sin contenido) para detectar
    // bloques de texto que output_text no haya incluido.
    estructura: resumirPasos(interaccion.steps),
    uso: interaccion.usage
      ? {
          entrada: interaccion.usage.total_input_tokens ?? null,
          salida: interaccion.usage.total_output_tokens ?? null,
          razonamiento: interaccion.usage.total_thought_tokens ?? null,
        }
      : null,
    modelo: env.ia.modelo,
  };
}
