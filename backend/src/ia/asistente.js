import { env, esProduccion } from '../config/env.js';
import { adaptadorReal } from './proveedor.js';
import * as simulado from './adaptadores/simulado.adapter.js';
import { ErrorIa, traducirErrorSdk } from './errores.js';
import { planSchema } from '../modules/asistente/asistente.schema.js';

// HU25: punto de entrada de la IA del asistente (como extractor.js para los
// comprobantes). Elige el adaptador, traduce los errores del SDK y valida el
// plan. El resto del módulo no conoce el proveedor.

const usaSimulacion = () => Boolean(env.ia.simulacion) && !esProduccion;

export const adaptadorPorDefecto = () => (usaSimulacion() ? simulado : adaptadorReal());

export function asistenteDisponible() {
  return usaSimulacion() || Boolean(env.ia.apiKey);
}

export function modeloAsistente() {
  return usaSimulacion() ? `simulado:${env.ia.modelo}` : env.ia.modelo;
}

// Una llamada al planificador (una sola solicitud). Lanza ErrorIa.
// Siempre sin reintentos automáticos del SDK: los intentos los cuenta y
// limita el servicio del asistente.
export async function planificar(adaptador, { pregunta, hoy, timeoutMs }) {
  try {
    return await adaptador.planificar({ pregunta, hoy, timeoutMs, reintentos: false });
  } catch (err) {
    throw traducirErrorSdk(err);
  }
}

// Texto del modelo → plan validado. Lanza ErrorIa RESPUESTA_INVALIDA.
export function interpretarPlan(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorIa('RESPUESTA_INVALIDA', { detalle: 'el plan no es JSON' });
  }
  const r = planSchema.safeParse(datos);
  if (!r.success) throw new ErrorIa('RESPUESTA_INVALIDA', { detalle: 'el plan no cumple el esquema' });
  return r.data;
}
