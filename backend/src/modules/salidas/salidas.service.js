import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { registrarMovimiento } from '../stock/stock.service.js';

// HU13: salida de stock desde el carrito. Todo en una transacción: la
// cabecera Salida y un MovimientoStock SALIDA (cantidad negativa) por
// producto. Si una línea no se puede descontar, no se descuenta ninguna.
// HU22 reutiliza el mismo núcleo (registrarSalida) para las ventas que
// informa un sistema externo.

// Unidades que no se fraccionan: no se saca media unidad ni medio paquete.
const UNIDADES_ENTERAS = new Set(['UNIDAD', 'PAQUETE']);

const numero = (d) => new Prisma.Decimal(d).toNumber().toLocaleString('es-AR', { maximumFractionDigits: 3 });

// Revisa el carrito contra los productos bloqueados (pura, sin base de datos).
// productos: Map id → { id, nombre, activo, unidadMedida, stockActual }.
// permitirNegativo (HU22): una venta informada por la caja ya ocurrió, así que
// se registra aunque el stock no alcance; el stock queda negativo y se avisa.
export function problemasDelCarrito(lineas, productos, { permitirNegativo = false } = {}) {
  const problemas = [];
  lineas.forEach((l, i) => {
    const p = productos.get(l.productoId);
    const agregar = (mensaje) => problemas.push({ campo: `lineas.${i}.cantidad`, productoId: l.productoId, mensaje });
    if (!p) return agregar(`El producto #${l.productoId} no existe.`);
    if (!p.activo) return agregar(`${p.nombre} está desactivado.`);
    const cantidad = new Prisma.Decimal(l.cantidad);
    if (UNIDADES_ENTERAS.has(p.unidadMedida) && !cantidad.isInteger()) {
      return agregar(`${p.nombre} se cuenta en unidades enteras.`);
    }
    if (!permitirNegativo && cantidad.gt(p.stockActual)) {
      const hay = new Prisma.Decimal(p.stockActual);
      return agregar(
        hay.lte(0)
          ? `No hay stock de ${p.nombre}.`
          : `No alcanza el stock de ${p.nombre}: hay ${numero(hay)} y se quieren sacar ${numero(cantidad)}.`,
      );
    }
    return undefined;
  });
  return problemas;
}

export const incluirSalida = {
  usuario: { select: { id: true, nombre: true } },
  claveIntegracion: { select: { id: true, nombre: true } },
  movimientos: {
    include: { producto: { select: { id: true, nombre: true, unidadMedida: true } } },
    orderBy: { id: 'asc' },
  },
};

export function mapearSalida(s) {
  const lineas = s.movimientos.map((m) => {
    const cantidad = new Prisma.Decimal(m.cantidad);
    const stockAnterior = new Prisma.Decimal(m.stockAnterior);
    return {
      producto: m.producto,
      // Cantidad sacada (positiva); el movimiento la guarda negativa.
      cantidad: cantidad.negated().toNumber(),
      stockAnterior: stockAnterior.toNumber(),
      stockNuevo: stockAnterior.plus(cantidad).toNumber(),
    };
  });
  return {
    id: s.id,
    origen: s.origen,
    motivo: s.motivo,
    observacion: s.observacion,
    registradaEn: s.registradaEn,
    usuario: s.usuario,
    integracion: s.claveIntegracion ? s.claveIntegracion.nombre : null,
    lineas,
    totalCantidad: lineas.reduce((t, l) => t.plus(l.cantidad), new Prisma.Decimal(0)).toNumber(),
  };
}

function porOperacion(usuarioId, idOperacion) {
  return prisma.salida.findFirst({
    where: { origen: 'CARRITO', usuarioId, referenciaExterna: idOperacion },
    include: incluirSalida,
  });
}

// Opciones de las transacciones de salida. maxWait: cuánto se espera una
// conexión libre para empezar. Con muchas operaciones simultáneas sobre los
// mismos productos, cada transacción ocupa una conexión mientras espera el
// bloqueo de la fila; con la espera por defecto de Prisma (2 s) una ráfaga
// terminaba en error (P2028). Verificado con las pruebas de punta a punta.
export const OPCIONES_TRANSACCION = { maxWait: 10_000, timeout: 20_000 };

export const esUnico = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

// Núcleo de una salida, dentro de la transacción del llamador (HU13 y HU22).
// Bloquea los productos en orden de id (igual que la confirmación de ingresos,
// HU11, y el recuento, HU14): dos operaciones sobre los mismos productos se
// aplican una detrás de la otra sin trabarse. Si alguna línea tiene un
// problema, no se registra nada.
// cabecera: datos de la Salida (origen, motivo, usuario o clave, referencia).
export async function registrarSalida(
  tx,
  { cabecera, lineas, permitirNegativo = false, mensajeProblemas, include = incluirSalida },
) {
  const ids = lineas.map((l) => l.productoId).sort((a, b) => a - b);
  const filas = await tx.$queryRaw`
    SELECT id, nombre, activo, unidad_medida::text AS "unidadMedida", stock_actual AS "stockActual"
    FROM productos WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  const problemas = problemasDelCarrito(lineas, new Map(filas.map((f) => [f.id, f])), { permitirNegativo });
  if (problemas.length > 0) throw ApiError.invalido(mensajeProblemas, problemas);

  const salida = await tx.salida.create({ data: cabecera });
  for (const l of [...lineas].sort((a, b) => a.productoId - b.productoId)) {
    await registrarMovimiento(tx, {
      productoId: l.productoId,
      tipo: 'SALIDA',
      motivo: cabecera.motivo,
      cantidad: new Prisma.Decimal(l.cantidad).negated(),
      usuarioId: cabecera.usuarioId ?? null,
      salidaId: salida.id,
      fecha: salida.registradaEn,
    });
  }
  return tx.salida.findUnique({ where: { id: salida.id }, include });
}

export async function crear({ motivo, observacion, idOperacion, lineas }, usuarioId) {
  // Reenvío de un carrito ya registrado: se devuelve el mismo resultado.
  if (idOperacion) {
    const previa = await porOperacion(usuarioId, idOperacion);
    if (previa) return { salida: mapearSalida(previa), repetida: true };
  }

  try {
    const salida = await prisma.$transaction(
      (tx) =>
        registrarSalida(tx, {
          cabecera: { origen: 'CARRITO', motivo, observacion, usuarioId, referenciaExterna: idOperacion ?? null },
          lineas,
          mensajeProblemas: 'Revisá el carrito: no se descontó ningún producto.',
        }),
      OPCIONES_TRANSACCION,
    );
    return { salida: mapearSalida(salida), repetida: false };
  } catch (err) {
    // Dos envíos simultáneos del mismo carrito: el segundo choca con el
    // índice único y devuelve la salida que registró el primero.
    if (idOperacion && esUnico(err)) {
      const previa = await porOperacion(usuarioId, idOperacion);
      if (previa) return { salida: mapearSalida(previa), repetida: true };
    }
    throw err;
  }
}

export async function obtener(id) {
  const s = await prisma.salida.findUnique({ where: { id }, include: incluirSalida });
  if (!s) throw ApiError.noEncontrado('Salida no encontrada');
  return mapearSalida(s);
}

export async function listar({ limite = 20 } = {}) {
  const salidas = await prisma.salida.findMany({
    include: incluirSalida,
    orderBy: [{ registradaEn: 'desc' }, { id: 'desc' }],
    take: limite,
  });
  return salidas.map(mapearSalida);
}
