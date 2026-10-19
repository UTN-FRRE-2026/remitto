import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';

// HU9: adaptador simulado para pruebas sin red (nunca en producción).
// El escenario sale de un marcador "SIMULACION=<escenario>[:ms]" dentro del
// archivo subido o, si no lo hay, de IA_SIMULACION. Los errores imitan las
// clases y campos que devuelve el SDK real (status y error.error.code).
export const nombre = 'simulado';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const llamadasPorArchivo = new Map();

function errorSdk(clase, status, code) {
  const Clase = { [clase]: class extends Error {} }[clase];
  const err = new Clase(`${status} simulado`);
  err.status = status;
  err.error = { error: { code, message: 'simulado' } };
  return err;
}

function errorTimeout() {
  const Clase = { APIConnectionTimeoutError: class extends Error {} }.APIConnectionTimeoutError;
  return new Clase('Request timed out (simulado)');
}

// Forma del esquema v3: cantidadTexto obligatorio ("" = celda vacía o
// ilegible), sin cantidad numérica y sin unidad salvo que se indique.
const linea = (codigo, descripcion, cantidad, precio, extra = {}) => ({
  codigo,
  descripcion,
  cantidadTexto: cantidad === null ? '' : String(cantidad).replace('.', ','),
  precioUnitario: precio,
  precioUnitarioTexto: precio === null ? null : precio.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
  ilegible: false,
  ...extra,
});

function respuestaOk(numero = '0001-00045872') {
  return {
    documento: { legible: true, motivoIlegible: null, manuscrito: false, bajaCalidad: false },
    cabecera: {
      tipo: 'REMITO',
      numero,
      fechaEmision: '2026-09-28',
      totalDeclarado: 72000,
      totalTexto: '72.000,00',
      proveedorNombre: 'DISTRIBUIDORA NORTE S.R.L.',
      proveedorCuit: '30-71234567-8',
    },
    lineas: [
      linea('2210', 'GAS, COLA 500ML', 36, 690),
      linea('3301', 'YERBA C/P 1KG', 12, 2850),
      linea('1045', 'GALL, RELL, CHOC 118G', 24, 540),
    ],
  };
}

function respuestaParcial() {
  const r = respuestaOk(null);
  r.documento.bajaCalidad = true;
  r.cabecera.fechaEmision = '2099-01-01';
  r.cabecera.totalDeclarado = null;
  r.cabecera.totalTexto = null;
  r.lineas = [
    linea('2210', 'GAS, COLA 500ML', 36, 690),
    linea('1187', 'ALF, TRIPLE CHOC', null, 380, { cantidadTexto: '4?', ilegible: true, observacion: 'cantidad borrosa' }),
    linea('5120', 'PAPAS FRIT, CLAS 80G', 2, 10680, { unidad: 'CAJA x12', precioUnitarioTexto: '10.680,00' }),
    linea('4410', 'AGUA S/GAS 1.5L', 0, null, { cantidadTexto: '0' }),
    linea(null, null, null, null, { ilegible: true }),
  ];
  return r;
}

function escenario(buffer) {
  const texto = buffer.toString('latin1');
  const m = /SIMULACION=([a-z_]+)(?::(\d+))?/.exec(texto);
  if (m) return { nombre: m[1], ms: Number(m[2] ?? 0) };
  const porDefecto = env.ia.simulacion;
  return { nombre: ['1', 'true', 'si'].includes(porDefecto) ? 'ok' : porDefecto, ms: 0 };
}

export async function llamar({ buffer, timeoutMs }) {
  const { nombre: esc, ms } = escenario(buffer);
  const clave = createHash('sha256').update(buffer).digest('hex');
  const numeroLlamada = (llamadasPorArchivo.get(clave) ?? 0) + 1;
  llamadasPorArchivo.set(clave, numeroLlamada);

  // Demora simulada que respeta el timeout de la llamada, como el SDK real.
  const demora = esc === 'demora' ? timeoutMs + 1000 : ms;
  if (demora > 0) {
    await esperar(Math.min(demora, timeoutMs));
    if (demora > timeoutMs) throw errorTimeout();
  }

  const responder = (obj) => ({ texto: JSON.stringify(obj), estado: 'completed', uso: { entrada: 1000, salida: 200, razonamiento: 50 }, modelo: `simulado:${env.ia.modelo}` });

  switch (esc) {
    case 'ok':
    case 'lento':
    case 'demora':
      return responder(respuestaOk());
    case 'duplicado':
      return responder(respuestaOk('0001-00000099'));
    case 'parcial':
      return responder(respuestaParcial());
    case 'ilegible':
      return responder({
        documento: { legible: false, motivoIlegible: 'Imagen borrosa', manuscrito: false, bajaCalidad: true },
        cabecera: { tipo: null, numero: null, fechaEmision: null, totalDeclarado: null, totalTexto: null, proveedorNombre: null, proveedorCuit: null },
        lineas: [],
      });
    case 'invalida':
      return { texto: 'Esto no es JSON', estado: 'completed', uso: null, modelo: `simulado:${env.ia.modelo}` };
    case 'esquema':
      return { texto: JSON.stringify({ documento: { legible: 'si' }, lineas: 'ninguna' }), estado: 'completed', uso: null, modelo: `simulado:${env.ia.modelo}` };
    case 'vacia':
      return { texto: '', estado: 'incomplete', uso: null, modelo: `simulado:${env.ia.modelo}` };
    case 'cuota':
      throw errorSdk('RateLimitError', 429, 'quota_exceeded');
    case 'minuto':
      throw errorSdk('RateLimitError', 429, 'rate_limit_exceeded');
    case 'clave':
      throw errorSdk('AuthenticationError', 401, 'authentication');
    case 'modelo':
      throw errorSdk('NotFoundError', 404, 'not_found');
    case 'servicio':
      throw errorSdk('InternalServerError', 503, 'service_unavailable');
    case 'transitorio':
      // Falla la primera llamada de cada archivo y responde bien después.
      if (numeroLlamada === 1) throw errorSdk('InternalServerError', 503, 'service_unavailable');
      return responder(respuestaOk('0001-00000777'));
    default:
      throw new Error(`Escenario de simulación desconocido: ${esc}`);
  }
}
