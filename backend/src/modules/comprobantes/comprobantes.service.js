import fs from 'node:fs/promises';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { leerError } from '../../ia/errores.js';
import { iaDisponible } from '../../ia/extractor.js';
import { normalizarNumero } from '../../ia/normalizar.js';
import { validarArchivo, guardarArchivo, eliminarArchivo, rutaAbsoluta } from './comprobantes.archivos.js';
import { OBJETIVO_RNF2_MS } from './comprobantes.procesamiento.js';
import { incluirDetalle, validar, exigeRevisionCompleta } from './comprobantes.revision.js';
import { UMBRAL_CONFIANZA } from './comprobantes.asociacion.js';
import { anotarEquivalencias, equivalenciasDelProveedor } from './comprobantes.equivalencias.js';
import { precisionDeComprobante } from './comprobantes.precision.js';

// HU10: valida los datos para confirmar. El aviso de duplicado usa el número
// definitivo si ya se corrigió; si no, el que leyó la IA.
export function validarRevision(id) {
  return validar(id, (c) => {
    const definitivo = normalizarNumero(c.numero);
    if (!definitivo) return buscarPosiblesDuplicados(c);
    return buscarPosiblesDuplicados({
      ...c,
      respuestaIa: { normalizada: { cabecera: { numeroNormalizado: definitivo } } },
    });
  });
}

const incluir = {
  proveedor: { select: { id: true, razonSocial: true } },
  cargadoPor: { select: { id: true, nombre: true } },
  confirmadoPor: { select: { id: true, nombre: true } },
};

// HU8: registra el comprobante en PENDIENTE. Si falla el alta en la base,
// se borra el archivo ya guardado para no dejar huérfanos.
export async function crear({ proveedorId, tipo }, archivo, usuarioId) {
  const formato = validarArchivo(archivo);

  // HU6: un proveedor desactivado no puede recibir comprobantes nuevos.
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
    select: { activo: true },
  });
  if (!proveedor || !proveedor.activo) {
    throw ApiError.invalido('El proveedor no existe o está desactivado.', [
      { campo: 'proveedorId', mensaje: 'Proveedor inexistente o inactivo' },
    ]);
  }

  const archivoUrl = await guardarArchivo(archivo.buffer, formato);
  try {
    return await prisma.comprobante.create({
      data: {
        proveedorId,
        tipo,
        archivoUrl,
        archivoMime: formato.mime,
        origenArchivo: formato.origen,
        cargadoPorId: usuarioId,
      },
      include: incluir,
    });
  } catch (err) {
    await eliminarArchivo(archivoUrl);
    throw err;
  }
}

// HU16: marca las líneas en revisión cuya propuesta sale de una equivalencia
// confirmada del proveedor ("Recordado"). Fuera de la revisión no se marca.
async function conEquivalencias(comprobante, detalles) {
  if (comprobante.estado !== 'EN_REVISION' || !detalles.some((d) => d.confianza != null)) {
    return detalles.map((d) => ({ ...d, equivalencia: null }));
  }
  return anotarEquivalencias(detalles, await equivalenciasDelProveedor(prisma, comprobante.proveedorId));
}

// Una línea recién editada, con la misma marca que en el comprobante completo.
export async function anotarDetalle(comprobanteId, detalle) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: comprobanteId },
    select: { estado: true, proveedorId: true },
  });
  const [anotado] = await conEquivalencias(comprobante, [detalle]);
  return anotado;
}

export async function obtener(id) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id },
    include: { ...incluir, detalles: { include: incluirDetalle, orderBy: { nroLinea: 'asc' } } },
  });
  if (!comprobante) throw ApiError.noEncontrado('Comprobante no encontrado');
  // El detalle técnico del proveedor queda solo en el servidor (base y log).
  const { respuestaIa } = comprobante;
  return {
    ...comprobante,
    detalles: await conEquivalencias(comprobante, comprobante.detalles),
    respuestaIa: respuestaIa?.error ? { ...respuestaIa, error: { codigo: respuestaIa.error.codigo } } : respuestaIa,
    error: leerError(comprobante.errorProcesamiento),
    posibleDuplicado: await buscarPosiblesDuplicados(comprobante),
    // HU15: por debajo de este valor, la propuesta de producto se destaca.
    umbralConfianza: UMBRAL_CONFIANZA,
    // HU17: manuscrito o de baja calidad → cada línea se marca como revisada.
    revisionCompleta: exigeRevisionCompleta(comprobante),
    // HU19: lo leído contra lo confirmado (null si no está confirmado o no lo leyó la IA).
    precision: precisionDeComprobante(comprobante),
  };
}

// HU9: el número leído por la IA que coincide con otro comprobante del mismo
// proveedor se señala (no bloquea): se corrige en la revisión y la unicidad
// del número definitivo se exige al confirmar (HU10).
export async function buscarPosiblesDuplicados({ id, proveedorId, respuestaIa }) {
  const numero = respuestaIa?.normalizada?.cabecera?.numeroNormalizado;
  if (!numero) return [];
  const base = { proveedorId, id: { not: id }, estado: { not: 'ANULADO' } };
  const [porLectura, conNumero] = await Promise.all([
    prisma.comprobante.findMany({
      where: { ...base, respuestaIa: { path: ['normalizada', 'cabecera', 'numeroNormalizado'], equals: numero } },
      select: { id: true, estado: true },
    }),
    prisma.comprobante.findMany({
      where: { ...base, numero: { not: null } },
      select: { id: true, estado: true, numero: true },
    }),
  ]);
  const encontrados = new Map(porLectura.map((c) => [c.id, { id: c.id, estado: c.estado }]));
  for (const c of conNumero) {
    if (normalizarNumero(c.numero) === numero) encontrados.set(c.id, { id: c.id, estado: c.estado });
  }
  return [...encontrados.values()].sort((a, b) => a.id - b.id);
}

// HU9: estado liviano para la pantalla M4 (se consulta periódicamente).
export async function estadoProcesamiento(id) {
  const c = await prisma.comprobante.findUnique({
    where: { id },
    select: {
      id: true,
      proveedorId: true,
      estado: true,
      errorProcesamiento: true,
      iaIntentos: true,
      iaSolicitadoEn: true,
      procesandoDesde: true,
      requiereRevision: true,
      respuestaIa: true,
      _count: { select: { detalles: true } },
    },
  });
  if (!c) throw ApiError.noEncontrado('Comprobante no encontrado');

  const procesando = c.estado === 'PROCESANDO';
  const ahora = Date.now();
  // Mientras procesa, los tiempos se calculan en vivo; después, los de la última ejecución.
  const ejecucion = procesando ? null : c.respuestaIa?.ejecucion ?? null;
  let tiempos = null;
  if (procesando && c.iaSolicitadoEn) {
    const solicitado = c.iaSolicitadoEn.getTime();
    const iniciado = c.procesandoDesde?.getTime();
    tiempos = {
      esperaColaMs: (iniciado ?? ahora) - solicitado,
      ejecucionMs: iniciado ? ahora - iniciado : null,
      totalMs: ahora - solicitado,
      enCurso: true,
    };
  } else if (ejecucion) {
    tiempos = {
      esperaColaMs: ejecucion.esperaColaMs,
      ejecucionMs: ejecucion.ejecucionMs,
      totalMs: ejecucion.totalMs,
      enCurso: false,
    };
  }

  const disponible = iaDisponible();
  return {
    id: c.id,
    estado: c.estado,
    fase: procesando ? (c.procesandoDesde ? 'LEYENDO' : 'EN_COLA') : c.estado,
    error: leerError(c.errorProcesamiento),
    intentos: c.iaIntentos,
    maxIntentos: env.ia.maxIntentos,
    iaDisponible: disponible,
    puedeLeer: disponible && ['PENDIENTE', 'ERROR'].includes(c.estado) && c.iaIntentos < env.ia.maxIntentos,
    tiempos,
    objetivoMs: OBJETIVO_RNF2_MS,
    rnf2: ejecucion?.rnf2 ?? null,
    presupuestoMs: ejecucion?.presupuestoMs ?? env.ia.presupuestoMs,
    presupuestoAgotado: Boolean(ejecucion?.presupuestoAgotado),
    llamadas: ejecucion?.llamadas ?? [],
    lineas: c._count.detalles,
    requiereRevision: c.requiereRevision,
    posibleDuplicado: c.estado === 'EN_REVISION' ? await buscarPosiblesDuplicados(c) : [],
  };
}

// Datos para servir el archivo original por la ruta autenticada.
export async function archivo(id) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id },
    select: { id: true, archivoUrl: true, archivoMime: true },
  });
  if (!comprobante) throw ApiError.noEncontrado('Comprobante no encontrado');

  const ruta = rutaAbsoluta(comprobante.archivoUrl);
  try {
    await fs.access(ruta);
  } catch {
    throw ApiError.noEncontrado('El archivo del comprobante no está disponible');
  }
  const extension = comprobante.archivoUrl.split('.').pop();
  return { ruta, mime: comprobante.archivoMime, nombre: `comprobante-${comprobante.id}.${extension}` };
}
