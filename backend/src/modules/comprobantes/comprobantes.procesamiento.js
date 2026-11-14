import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { iaDisponible, llamarModelo, interpretarRespuesta, modeloConfigurado } from '../../ia/extractor.js';
import { ErrorIa, formatearError } from '../../ia/errores.js';
import { VERSION_ESQUEMA } from '../../ia/esquemaComprobante.js';
import { leerArchivo } from './comprobantes.archivos.js';
import { proponerAsociacion } from './comprobantes.asociacion.js';
import { buscarEquivalencia, equivalenciasDelProveedor } from './comprobantes.equivalencias.js';

// HU9: lectura con IA en segundo plano, sin infraestructura extra.
//
// Estados (columna estado + campos ia*):
//   PENDIENTE ─solicitar─> PROCESANDO (en cola: procesandoDesde NULL)
//            ─sale de la cola─> PROCESANDO (leyendo: procesandoDesde con fecha)
//            ─> EN_REVISION | ERROR
// - Cola en memoria por proceso, de a un trabajo (cuida el límite por minuto).
// - Cada trabajo tiene un token (iaTrabajoId); toda escritura lo exige, así un
//   trabajo vencido o de otro backend nunca pisa un resultado.
// - Latido: el proceso dueño renueva iaVigenteHasta de sus trabajos (en cola o
//   leyendo). El barrido solo marca INTERRUMPIDO lo vencido, es decir, trabajos
//   cuyo proceso murió; nunca reprocesa solo.
// - Presupuesto: cada ejecución tiene IA_PRESUPUESTO_MS para llamadas y esperas.
// - Cuota: cada llamada real se registra (iaIntentos + 1) ANTES de enviarse.

export const OBJETIVO_RNF2_MS = 30000;
const MIN_LLAMADA_MS = 5000; // no vale la pena empezar una llamada con menos tiempo
const MARGEN_LLAMADA_MS = 500;
const ESPERA_POR_MINUTO_MS = 20000;

const cola = [];
const propios = new Map(); // token -> id (trabajos de este proceso)
let atendiendo = false;
let temporizadores = [];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const vigenteHasta = () => new Date(Date.now() + env.ia.vigenciaMs);

// Decide si hay tiempo para esperar y volver a llamar dentro del presupuesto.
export function hayTiempoParaReintentar({ ahora, limite, espera, minLlamadaMs = MIN_LLAMADA_MS }) {
  return ahora + espera + minLlamadaMs <= limite;
}

export function esperaAntesDeReintentar(codigo, numeroFallo) {
  if (codigo === 'LIMITE_POR_MINUTO') return ESPERA_POR_MINUTO_MS;
  return 1000 * 2 ** (numeroFallo - 1) + Math.floor(Math.random() * 300);
}

// POST /:id/procesar. Toma el comprobante de forma atómica y lo encola.
export async function solicitar(id) {
  if (!iaDisponible()) {
    throw new ApiError(503, 'La lectura con IA no está configurada en el servidor.');
  }
  const token = randomUUID();
  const ahora = new Date();
  const tomado = await prisma.comprobante.updateMany({
    where: { id, estado: { in: ['PENDIENTE', 'ERROR'] }, iaIntentos: { lt: env.ia.maxIntentos } },
    data: {
      estado: 'PROCESANDO',
      iaTrabajoId: token,
      iaSolicitadoEn: ahora,
      procesandoDesde: null,
      iaVigenteHasta: vigenteHasta(),
      errorProcesamiento: null,
    },
  });

  if (tomado.count === 0) {
    const actual = await prisma.comprobante.findUnique({ where: { id }, select: { estado: true } });
    if (!actual) throw ApiError.noEncontrado('Comprobante no encontrado');
    if (actual.estado === 'PROCESANDO') throw ApiError.conflicto('El comprobante ya se está leyendo.');
    if (actual.estado === 'PENDIENTE' || actual.estado === 'ERROR') {
      throw ApiError.conflicto(`Se alcanzó el límite de ${env.ia.maxIntentos} lecturas con IA para este comprobante.`);
    }
    throw ApiError.conflicto('El comprobante ya fue leído y espera revisión.');
  }

  propios.set(token, id);
  cola.push({ id, token });
  setImmediate(atender);
}

async function atender() {
  if (atendiendo) return;
  atendiendo = true;
  try {
    while (cola.length > 0) {
      const trabajo = cola.shift();
      try {
        await ejecutar(trabajo);
      } catch (err) {
        console.error(`[IA] Error inesperado en el comprobante ${trabajo.id}:`, err.message);
        await finalizarConError(trabajo, new ErrorIa('ERROR_INTERNO', { detalle: err.message }), {}).catch(() => {});
      } finally {
        propios.delete(trabajo.token);
      }
    }
  } finally {
    atendiendo = false;
  }
}

const delTrabajo = ({ id, token }) => ({ id, estado: 'PROCESANDO', iaTrabajoId: token });

async function ejecutar(trabajo) {
  const inicio = new Date();
  const empezo = await prisma.comprobante.updateMany({
    where: delTrabajo(trabajo),
    data: { procesandoDesde: inicio, iaVigenteHasta: vigenteHasta() },
  });
  if (empezo.count === 0) return; // ya no es nuestro (vencido o recuperado)

  const comp = await prisma.comprobante.findUnique({
    where: { id: trabajo.id },
    select: { archivoUrl: true, archivoMime: true, origenArchivo: true, iaSolicitadoEn: true, iaIntentos: true },
  });
  const intentosDisponibles = env.ia.maxIntentos - comp.iaIntentos;
  const ejecucion = {
    trabajoId: trabajo.token,
    modelo: modeloConfigurado(),
    presupuestoMs: env.ia.presupuestoMs,
    solicitadoEn: comp.iaSolicitadoEn.toISOString(),
    iniciadoEn: inicio.toISOString(),
    llamadas: [],
  };

  let buffer;
  try {
    buffer = await leerArchivo(comp.archivoUrl);
  } catch {
    return finalizarConError(trabajo, new ErrorIa('ERROR_INTERNO', { mensaje: 'El archivo del comprobante no está disponible.' }), { ejecucion });
  }

  const limite = inicio.getTime() + env.ia.presupuestoMs;
  let respuesta = null;
  let ultimoError = null;
  let fallos = 0;

  while (true) {
    const restante = limite - Date.now();
    if (restante < MIN_LLAMADA_MS) {
      ejecucion.presupuestoAgotado = true;
      break;
    }
    // Cuota: la llamada se registra antes de enviarse, aunque luego falle.
    const registrada = await prisma.comprobante.updateMany({
      where: { ...delTrabajo(trabajo), iaIntentos: { lt: env.ia.maxIntentos } },
      data: { iaIntentos: { increment: 1 }, iaVigenteHasta: vigenteHasta() },
    });
    if (registrada.count === 0) {
      const sigue = await prisma.comprobante.count({ where: delTrabajo(trabajo) });
      if (!sigue) return; // perdimos el trabajo: no escribir nada
      ultimoError ??= new ErrorIa('LIMITE_INTENTOS');
      break;
    }

    const t0 = Date.now();
    const llamada = { inicioMs: t0 - inicio.getTime(), timeoutMs: restante - MARGEN_LLAMADA_MS };
    try {
      respuesta = await llamarModelo({
        buffer,
        mime: comp.archivoMime,
        origen: comp.origenArchivo,
        timeoutMs: llamada.timeoutMs,
      });
      ejecucion.llamadas.push({ ...llamada, duracionMs: Date.now() - t0, resultado: 'OK', estadoProveedor: respuesta.estado ?? null });
      break;
    } catch (err) {
      const errorIa = err instanceof ErrorIa ? err : new ErrorIa('ERROR_INTERNO', { detalle: err.message });
      ejecucion.llamadas.push({
        ...llamada,
        duracionMs: Date.now() - t0,
        resultado: errorIa.codigo,
        proveedor: errorIa.proveedor ? { status: errorIa.proveedor.status, code: errorIa.proveedor.code } : null,
      });
      if (errorIa.detalle) console.warn(`[IA] Comprobante ${trabajo.id}: ${errorIa.codigo} (${errorIa.detalle})`);
      ultimoError = errorIa;
      fallos += 1;
      if (!errorIa.automatico || ejecucion.llamadas.length >= intentosDisponibles) break;
      const espera = esperaAntesDeReintentar(errorIa.codigo, fallos);
      if (!hayTiempoParaReintentar({ ahora: Date.now(), limite, espera })) {
        ejecucion.presupuestoAgotado = true;
        break;
      }
      await esperar(espera);
    }
  }

  if (!respuesta) {
    const error = ultimoError ?? new ErrorIa('DEMORA', { mensaje: 'No hubo tiempo para consultar la IA dentro del límite.' });
    return finalizarConError(trabajo, error, { ejecucion });
  }

  ejecucion.uso = respuesta.uso;
  ejecucion.estructura = respuesta.estructura ?? null;
  let interpretada;
  try {
    interpretada = interpretarRespuesta(respuesta.texto);
  } catch (err) {
    if (!(err instanceof ErrorIa)) throw err;
    if (err.detalle) console.warn(`[IA] Comprobante ${trabajo.id}: ${err.codigo} (${err.detalle})`);
    return finalizarConError(trabajo, err, {
      ejecucion,
      modelo: respuesta.modelo,
      original: err.original,
      lectura: err.lectura,
      normalizada: err.normalizada,
    });
  }
  return finalizarConExito(trabajo, interpretada, respuesta.modelo, ejecucion);
}

function cerrarMetricas(ejecucion, exito) {
  const fin = Date.now();
  const solicitado = Date.parse(ejecucion.solicitadoEn);
  const iniciado = Date.parse(ejecucion.iniciadoEn);
  ejecucion.finalizadoEn = new Date(fin).toISOString();
  ejecucion.esperaColaMs = iniciado - solicitado;
  ejecucion.ejecucionMs = fin - iniciado;
  ejecucion.totalMs = fin - solicitado;
  ejecucion.objetivoMs = OBJETIVO_RNF2_MS;
  // RNF2 se evalúa sobre el tiempo completo desde la solicitud y solo si hubo resultado.
  ejecucion.rnf2 = exito ? (ejecucion.totalMs <= OBJETIVO_RNF2_MS ? 'CUMPLIDO' : 'EXCEDIDO') : 'NO_APLICA';
  return ejecucion;
}

const liberar = { iaTrabajoId: null, procesandoDesde: null, iaVigenteHasta: null };

// HU15/HU16: propuesta de producto y confianza para cada línea leída. Primero
// las equivalencias que el proveedor ya tiene confirmadas (confianza 1) y, si
// no hay, el producto más parecido. Si falla, las líneas quedan sin propuesta
// y se asocian a mano: no se pierde la lectura.
async function proponerAsociaciones(comprobanteId, lineas) {
  if (lineas.length === 0) return [];
  try {
    const { proveedorId } = await prisma.comprobante.findUnique({ where: { id: comprobanteId }, select: { proveedorId: true } });
    const [productos, equivalencias] = await Promise.all([
      prisma.producto.findMany({ where: { activo: true }, select: { id: true, nombre: true, codigoBarras: true } }),
      equivalenciasDelProveedor(prisma, proveedorId),
    ]);
    return lineas.map((l) => {
      const equivalencia = buscarEquivalencia(l, equivalencias);
      return equivalencia ? { productoId: equivalencia.productoId, confianza: 1 } : proponerAsociacion(l, productos);
    });
  } catch (err) {
    console.warn(`[IA] No se pudieron proponer asociaciones: ${err.message}`);
    return lineas.map(() => ({ productoId: null, confianza: null }));
  }
}

async function finalizarConExito(trabajo, { versionEsquema, original, lectura, normalizada }, modelo, ejecucion) {
  cerrarMetricas(ejecucion, true);
  const { cabecera, lineas } = normalizada;
  const propuestas = await proponerAsociaciones(trabajo.id, lineas);
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.comprobante.updateMany({
        where: delTrabajo(trabajo),
        data: {
          ...liberar,
          estado: 'EN_REVISION',
          respuestaIa: { versionEsquema, ejecucion, original, lectura, normalizada },
          modeloIa: modelo,
          requiereRevision: normalizada.requiereRevision,
          // Precarga editable en HU10. El número NO se escribe: la unicidad
          // por proveedor se exige al confirmar con el número definitivo.
          fechaEmision: cabecera.fechaEmision ? new Date(cabecera.fechaEmision) : null,
          totalDeclarado: cabecera.totalDeclarado,
          errorProcesamiento: null,
        },
      });
      if (r.count === 0) throw new TrabajoPerdido();
      // Un reintento reemplaza las líneas de la IA: nunca se duplican.
      await tx.detalleComprobante.deleteMany({ where: { comprobanteId: trabajo.id, agregadaManualmente: false } });
      if (lineas.length > 0) {
        await tx.detalleComprobante.createMany({
          data: lineas.map((l, i) => ({
            comprobanteId: trabajo.id,
            nroLinea: l.nroLinea,
            productoId: propuestas[i].productoId,
            confianza: propuestas[i].confianza,
            codigoExtraido: l.codigo,
            descripcionExtraida: l.descripcion,
            cantidadExtraida: l.cantidadExtraida,
            precioUnitarioExtraido: l.precioUnitarioExtraido,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            estado: 'PROPUESTO',
          })),
        });
      }
    });
  } catch (err) {
    if (err instanceof TrabajoPerdido) return;
    throw err;
  }
}

async function finalizarConError(trabajo, error, { ejecucion, modelo, original, lectura, normalizada }) {
  if (ejecucion) cerrarMetricas(ejecucion, false);
  let mensaje = error.message;
  if (ejecucion?.presupuestoAgotado) mensaje += ' Se agotó el tiempo máximo de la lectura.';
  await prisma.comprobante.updateMany({
    where: delTrabajo(trabajo),
    data: {
      ...liberar,
      estado: 'ERROR',
      errorProcesamiento: formatearError(error.codigo, mensaje),
      // Se conserva todo lo recibido, aunque sea inválido, para diagnóstico.
      respuestaIa: {
        versionEsquema: VERSION_ESQUEMA,
        ejecucion: ejecucion ?? null,
        original: original ?? null,
        lectura: lectura ?? null,
        normalizada: normalizada ?? null,
        // Detalle técnico saneado del proveedor (sin clave ni base64); la UI
        // solo muestra el mensaje simple de errorProcesamiento.
        error: { codigo: error.codigo, detalle: error.detalle ?? null, proveedor: error.proveedor ?? null },
      },
      ...(modelo ? { modeloIa: modelo } : {}),
    },
  });
}

class TrabajoPerdido extends Error {}

// Latido: mantiene vigentes los trabajos de este proceso (en cola o leyendo).
async function renovarVigencia() {
  if (propios.size === 0) return;
  await prisma.comprobante.updateMany({
    where: { estado: 'PROCESANDO', iaTrabajoId: { in: [...propios.keys()] } },
    data: { iaVigenteHasta: vigenteHasta() },
  });
}

// Barrido: marca INTERRUMPIDO solo lo vencido y ajeno a este proceso.
export async function recuperarAbandonados() {
  const ahora = new Date();
  const vencidos = await prisma.comprobante.findMany({
    where: {
      estado: 'PROCESANDO',
      iaVigenteHasta: { lt: ahora },
      iaTrabajoId: { notIn: [...propios.keys()] },
    },
    select: { id: true, iaTrabajoId: true },
  });
  let recuperados = 0;
  for (const v of vencidos) {
    const r = await prisma.comprobante.updateMany({
      where: { id: v.id, estado: 'PROCESANDO', iaTrabajoId: v.iaTrabajoId, iaVigenteHasta: { lt: ahora } },
      data: {
        ...liberar,
        estado: 'ERROR',
        errorProcesamiento: formatearError('INTERRUMPIDO', new ErrorIa('INTERRUMPIDO').message),
      },
    });
    recuperados += r.count;
  }
  if (recuperados > 0) console.warn(`[IA] ${recuperados} lectura(s) interrumpida(s) marcadas para reintento.`);
  return recuperados;
}

export function iniciarProcesamiento() {
  const seguro = (fn) => () => fn().catch((err) => console.error('[IA]', err.message));
  seguro(recuperarAbandonados)();
  temporizadores = [
    setInterval(seguro(renovarVigencia), Math.max(1000, Math.floor(env.ia.vigenciaMs / 3))),
    setInterval(seguro(recuperarAbandonados), Math.max(1000, Math.floor(env.ia.vigenciaMs / 2))),
  ];
}

// Cierre ordenado: los trabajos propios no terminados quedan reintentables ya,
// sin esperar a que venza su vigencia.
export async function detenerProcesamiento() {
  temporizadores.forEach(clearInterval);
  temporizadores = [];
  if (propios.size === 0) return;
  cola.length = 0;
  await prisma.comprobante.updateMany({
    where: { estado: 'PROCESANDO', iaTrabajoId: { in: [...propios.keys()] } },
    data: {
      ...liberar,
      estado: 'ERROR',
      errorProcesamiento: formatearError('INTERRUMPIDO', new ErrorIa('INTERRUMPIDO').message),
    },
  });
}

export function trabajosEnEsteProceso() {
  return { enCola: cola.length, propios: propios.size };
}
