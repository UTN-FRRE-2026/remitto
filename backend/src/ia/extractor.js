import { env, esProduccion } from '../config/env.js';
import * as gemini from './adaptadores/gemini.adapter.js';
import * as simulado from './adaptadores/simulado.adapter.js';
import { ErrorIa, traducirErrorSdk } from './errores.js';
import { lecturaSchema, VERSION_ESQUEMA } from './esquemaComprobante.js';
import { normalizarLectura } from './normalizar.js';

// HU9: punto de entrada de la capa de IA. Elige el adaptador (Strategy),
// traduce errores y valida/normaliza la respuesta. El resto del backend no
// conoce el proveedor.
const MAX_ORIGINAL = 100 * 1024;

const usaSimulacion = () => Boolean(env.ia.simulacion) && !esProduccion;

function adaptador() {
  return usaSimulacion() ? simulado : gemini;
}

// Hay con qué leer: simulación (solo desarrollo) o clave configurada.
export function iaDisponible() {
  return usaSimulacion() || Boolean(env.ia.apiKey);
}

export function modeloConfigurado() {
  return usaSimulacion() ? `simulado:${env.ia.modelo}` : env.ia.modelo;
}

// Una llamada real (una sola solicitud HTTP). Lanza ErrorIa.
export async function llamarModelo({ buffer, mime, origen, timeoutMs }) {
  try {
    return await adaptador().llamar({ buffer, mime, origen, timeoutMs });
  } catch (err) {
    throw traducirErrorSdk(err);
  }
}

// Interpreta el texto devuelto. Conserva siempre el original (aunque sea
// inválido) en err.original / resultado.original.
export function interpretarRespuesta(texto) {
  const original = typeof texto === 'string' ? texto.slice(0, MAX_ORIGINAL) : '';
  const fallar = (detalle, lectura) => {
    const err = new ErrorIa('RESPUESTA_INVALIDA', { detalle });
    err.original = original;
    err.lectura = lectura;
    return err;
  };

  if (!original.trim()) throw fallar('respuesta vacía o bloqueada');
  let lectura;
  try {
    lectura = JSON.parse(texto);
  } catch {
    throw fallar('la respuesta no es JSON');
  }
  const validacion = lecturaSchema.safeParse(lectura);
  if (!validacion.success) {
    const problemas = validacion.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
    throw fallar(`no cumple el esquema (${problemas.join('; ')})`, lectura);
  }

  const normalizada = normalizarLectura(validacion.data);
  if (normalizada.ilegible) {
    const err = new ErrorIa('DOCUMENTO_ILEGIBLE', { detalle: normalizada.motivoIlegible ?? 'sin motivo' });
    err.original = original;
    err.lectura = lectura;
    err.normalizada = normalizada;
    throw err;
  }
  return { versionEsquema: VERSION_ESQUEMA, original, lectura, normalizada };
}
