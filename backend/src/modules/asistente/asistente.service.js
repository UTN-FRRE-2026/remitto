import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { hoyArgentina } from '../reportes/reportes.schema.js';
import { adaptadorPorDefecto, asistenteDisponible, modeloAsistente, planificar, interpretarPlan } from '../../ia/asistente.js';
import { mensajeDe } from '../../ia/errores.js';
import { argumentosSchema, HERRAMIENTAS_HABILITADAS, ErrorPeriodo, limpiarArgumentos } from './asistente.schema.js';
import { HERRAMIENTAS } from './herramientas.js';

// HU25 (RF7.1): asistente de consultas en lenguaje natural, solo para el
// propietario.
// 1. El modelo traduce la pregunta a un plan: una herramienta habilitada y
//    sus argumentos (o una aclaración). Hasta 2 intentos, solo si el plan no
//    es válido, y sin reintentos automáticos del SDK.
// 2. El backend valida la herramienta y los argumentos y la ejecuta en una
//    transacción de solo lectura; arma el texto y la tabla o el gráfico.
// 3. Cada consulta (exitosa, aclaración o fallida) queda registrada en
//    consultas_agente con las herramientas usadas y la duración.
// Presupuesto global: 30 s por consulta entre los intentos y la ejecución
// (límite de espera del asistente; el objetivo de RNF2 es 3 s).

export const PRESUPUESTO_MS = 30_000;
export const MAX_INTENTOS = 2;
// Por debajo de este tiempo restante no se ejecuta la herramienta.
export const MIN_MS_HERRAMIENTA = 300;

const FUERA_DE_ALCANCE = 'Puedo responder sobre stock, faltantes, reposición, salidas y ventas, productos sin ventas y precios de compra.';
const MENSAJES = {
  NO_DISPONIBLE: 'El asistente no está disponible: falta configurar el servicio de IA.',
  TIEMPO: 'La consulta tardó demasiado y se canceló. Probá de nuevo en un momento.',
  RESPUESTA_INVALIDA: 'No pude interpretar la pregunta. Probá escribirla de otra forma.',
  HERRAMIENTA_NO_HABILITADA: 'No puedo hacer esa consulta: no es una de las habilitadas.',
  ARGUMENTOS_INVALIDOS: 'No pude armar la consulta con esos datos. Probá escribir la pregunta de otra forma.',
};

// Falla controlada de una consulta: se registra y se responde con su mensaje.
class Falla extends Error {
  constructor(codigo, mensaje = MENSAJES[codigo], estadoHttp = 200) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

const esTiempoAgotado = (err) =>
  err?.code === 'P2028' || /statement timeout|canceling statement|Transaction already closed|expired/i.test(err?.message ?? '');

function dependencias(deps) {
  return {
    db: deps.db ?? prisma,
    adaptador: deps.adaptador ?? adaptadorPorDefecto(),
    reloj: deps.reloj ?? Date.now,
    presupuestoMs: deps.presupuestoMs ?? PRESUPUESTO_MS,
    hoy: deps.hoy ?? hoyArgentina(),
    disponible: deps.disponible ?? asistenteDisponible(),
    modelo: deps.modelo ?? modeloAsistente(),
  };
}

// --- Planificación ---------------------------------------------------------

async function obtenerPlan(pregunta, d, vence, traza) {
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    const restante = vence - d.reloj();
    if (restante <= 0) throw new Falla('TIEMPO');
    const t0 = d.reloj();
    let respuesta;
    try {
      respuesta = await planificar(d.adaptador, { pregunta, hoy: d.hoy, timeoutMs: restante });
    } catch (err) {
      traza.planificador.intentos.push({ ms: d.reloj() - t0, error: err.codigo ?? 'ERROR_INTERNO' });
      if (err.codigo === 'DEMORA') throw new Falla('TIEMPO');
      throw new Falla('PROVEEDOR', `El servicio de IA no respondió: ${mensajeDe(err.codigo)}`);
    }
    const ms = d.reloj() - t0;
    if (d.reloj() > vence) {
      traza.planificador.intentos.push({ ms, error: 'FUERA_DE_TIEMPO' });
      throw new Falla('TIEMPO');
    }
    try {
      const plan = interpretarPlan(respuesta.texto);
      traza.planificador.intentos.push({ ms });
      return plan;
    } catch {
      traza.planificador.intentos.push({ ms, error: 'RESPUESTA_INVALIDA' });
    }
  }
  throw new Falla('RESPUESTA_INVALIDA');
}

// --- Ejecución -------------------------------------------------------------

// Ejecuta una herramienta habilitada con argumentos ya validados, en una
// transacción de solo lectura con el tiempo restante como tope.
// Espera una promesa como máximo `ms` (reloj real); si vence, rechaza con
// TIEMPO. La transacción de solo lectura que siga corriendo la corta su
// statement_timeout y Prisma la descarta.
function conTope(promesa, ms) {
  let temporizador;
  const tope = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Falla('TIEMPO')), Math.max(1, ms));
  });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(temporizador));
}

// La adquisición de la conexión y la ejecución comparten el mismo
// presupuesto: el paso entero no puede pasar de `vence`.
// - Antes de pedir la conexión: si no queda el mínimo, no se ejecuta.
// - Ya con la conexión: se recalcula lo que queda y es el statement_timeout;
//   si la espera lo consumió, la herramienta no se ejecuta.
// - Al terminar: si el presupuesto venció igual, la respuesta se descarta y
//   la consulta se registra con TIEMPO y su duración real.
async function ejecutarHerramienta(nombre, argumentos, { productoId } = {}, d, vence, traza) {
  const restante = vence - d.reloj();
  if (restante < MIN_MS_HERRAMIENTA) {
    traza.herramienta = { nombre, argumentos, omitida: true, motivo: 'sin tiempo' };
    throw new Falla('TIEMPO');
  }
  const t0 = d.reloj();
  let ejecutada = false;
  let r;
  try {
    r = await conTope(
      d.db.$transaction(
        async (tx) => {
          const quedan = vence - d.reloj();
          if (quedan < MIN_MS_HERRAMIENTA) throw new Falla('TIEMPO');
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(quedan))}`);
          ejecutada = true;
          return HERRAMIENTAS[nombre].ejecutar(argumentos, { tx, hoy: d.hoy, productoId });
        },
        // Tope de Prisma para cada etapa; el del paso completo lo pone conTope.
        { isolationLevel: 'RepeatableRead', maxWait: Math.max(1, Math.floor(restante)), timeout: Math.max(1, Math.floor(restante)) },
      ),
      restante,
    );
  } catch (err) {
    const ms = d.reloj() - t0;
    if (err instanceof ErrorPeriodo) {
      traza.herramienta = { nombre, argumentos, ms, aclaracion: 'periodo' };
      return { accion: 'aclaracion', respuesta: err.message, exitosa: true };
    }
    const tiempo = err instanceof Falla || esTiempoAgotado(err);
    traza.herramienta = { nombre, argumentos, ms, ejecutada, error: tiempo ? 'TIEMPO' : 'ERROR_INTERNO' };
    if (tiempo) throw new Falla('TIEMPO');
    throw err;
  }
  if (d.reloj() > vence) {
    traza.herramienta = { nombre, argumentos, ms: d.reloj() - t0, ejecutada, error: 'TIEMPO', filas: r.filas ?? 0 };
    throw new Falla('TIEMPO');
  }
  traza.herramienta = { nombre, argumentos, ms: d.reloj() - t0, filas: r.filas ?? 0 };
  if (r.aclaracion) {
    const opciones = r.aclaracion.opciones;
    // Plan pendiente: misma herramienta y argumentos (con el período ya
    // resuelto) para ejecutar sin volver a llamar al modelo.
    const pendiente = opciones.length
      ? {
          herramienta: nombre,
          argumentos: r.periodo ? { ...argumentos, periodo: { desde: r.periodo.desde, hasta: r.periodo.hasta } } : argumentos,
          opciones: opciones.map((o) => o.id),
          resuelta: false,
        }
      : null;
    if (pendiente) traza.pendiente = pendiente;
    traza.herramienta.aclaracion = 'producto';
    return { accion: 'aclaracion', respuesta: r.aclaracion.mensaje, opciones, exitosa: true };
  }
  return { accion: 'respuesta', respuesta: r.texto, presentacion: r.presentacion, exitosa: true };
}

async function ejecutarPlan(plan, d, vence, traza) {
  if (plan.accion === 'aclaracion') return { accion: 'aclaracion', respuesta: plan.mensaje, exitosa: true };
  if (plan.accion === 'fuera_de_alcance') return { accion: 'fuera_de_alcance', respuesta: FUERA_DE_ALCANCE, exitosa: true };
  const nombre = plan.herramienta;
  if (!HERRAMIENTAS_HABILITADAS.includes(nombre)) {
    traza.herramienta = { nombre: String(nombre).slice(0, 60), rechazada: true, motivo: 'no habilitada' };
    throw new Falla('HERRAMIENTA_NO_HABILITADA');
  }
  const { argumentos, descartados } = limpiarArgumentos(nombre, plan.argumentos);
  if (descartados.length > 0) traza.argumentosDescartados = descartados;
  const validacion = argumentosSchema[nombre].safeParse(argumentos);
  if (!validacion.success) {
    traza.herramienta = {
      nombre,
      argumentos: plan.argumentos,
      rechazada: true,
      motivo: 'argumentos inválidos',
      detalle: validacion.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(argumentos)'}: ${i.message}`),
    };
    throw new Falla('ARGUMENTOS_INVALIDOS');
  }
  return ejecutarHerramienta(nombre, validacion.data, {}, d, vence, traza);
}

// --- Registro --------------------------------------------------------------

async function registrar(d, { usuario, pregunta, resultado, traza, inicio }) {
  const duracionMs = Math.max(1, Math.round(d.reloj() - inicio));
  const fila = await d.db.consultaAgente.create({
    data: { usuarioId: usuario.id, pregunta, respuesta: resultado.respuesta ?? null, herramientas: traza, exitosa: resultado.exitosa, duracionMs },
    select: { id: true },
  });
  return {
    id: fila.id,
    accion: resultado.accion,
    respuesta: resultado.respuesta,
    ...(resultado.presentacion ? { presentacion: resultado.presentacion } : {}),
    ...(resultado.opciones ? { opciones: resultado.opciones } : {}),
    duracionMs,
    estadoHttp: resultado.estadoHttp ?? 200,
  };
}

function comoFalla(err) {
  if (err instanceof Falla) return { accion: 'error', respuesta: err.message, exitosa: false, estadoHttp: err.estadoHttp, codigo: err.codigo };
  return { accion: 'error', respuesta: 'No pude responder la consulta por un error interno.', exitosa: false, estadoHttp: 500, codigo: 'ERROR_INTERNO' };
}

// --- API del módulo --------------------------------------------------------

export async function consultar({ pregunta, usuario }, deps = {}) {
  const d = dependencias(deps);
  const inicio = d.reloj();
  const vence = inicio + d.presupuestoMs;
  const traza = { planificador: { modelo: d.modelo, intentos: [] }, herramienta: null };
  let resultado;
  try {
    if (!d.disponible) throw new Falla('NO_DISPONIBLE', MENSAJES.NO_DISPONIBLE, 503);
    const plan = await obtenerPlan(pregunta, d, vence, traza);
    resultado = await ejecutarPlan(plan, d, vence, traza);
  } catch (err) {
    resultado = comoFalla(err);
    traza.error = resultado.codigo;
  }
  return registrar(d, { usuario, pregunta, resultado, traza, inicio });
}

// Elección de un producto en una aclaración: la misma herramienta con los
// mismos argumentos (y período), sin volver a llamar al modelo.
export async function elegir({ consultaId, productoId, usuario }, deps = {}) {
  const d = dependencias(deps);
  const original = await d.db.consultaAgente.findUnique({ where: { id: consultaId } });
  if (!original || original.usuarioId !== usuario.id) throw ApiError.noEncontrado('Consulta no encontrada');
  const pendiente = original.herramientas?.pendiente;
  if (!pendiente) throw ApiError.invalido('Esa consulta no espera la elección de un producto');
  if (pendiente.resuelta) throw ApiError.conflicto('Esa elección ya se hizo');
  if (!pendiente.opciones.includes(productoId)) throw ApiError.invalido('El producto elegido no estaba entre las opciones ofrecidas');
  const producto = await d.db.producto.findFirst({ where: { id: productoId, activo: true }, select: { id: true, nombre: true } });
  if (!producto) throw ApiError.invalido('El producto elegido ya no está activo');
  // Se marca resuelta en una sola sentencia: dos elecciones simultáneas no
  // pueden ejecutarse las dos.
  const marcadas = await d.db.$executeRaw`
    UPDATE consultas_agente SET herramientas = jsonb_set(herramientas::jsonb, '{pendiente,resuelta}', 'true'::jsonb)
    WHERE id = ${consultaId} AND usuario_id = ${usuario.id} AND herramientas->'pendiente'->>'resuelta' = 'false'`;
  if (marcadas === 0) throw ApiError.conflicto('Esa elección ya se hizo');

  const inicio = d.reloj();
  const vence = inicio + d.presupuestoMs;
  const traza = { aclaracionDe: consultaId, planificador: { modelo: null, intentos: [] }, herramienta: null };
  let resultado;
  try {
    resultado = await ejecutarHerramienta(pendiente.herramienta, pendiente.argumentos, { productoId }, d, vence, traza);
  } catch (err) {
    resultado = comoFalla(err);
    traza.error = resultado.codigo;
  }
  return registrar(d, { usuario, pregunta: `${original.pregunta} → ${producto.nombre}`, resultado, traza, inicio });
}

export async function historial({ limite = 20 } = {}, db = prisma) {
  const filas = await db.consultaAgente.findMany({
    orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
    take: limite,
    select: { id: true, pregunta: true, respuesta: true, exitosa: true, duracionMs: true, creadaEn: true, herramientas: true, usuario: { select: { nombre: true } } },
  });
  return filas.map(({ herramientas, ...f }) => ({ ...f, herramienta: herramientas?.herramienta?.nombre ?? null }));
}
