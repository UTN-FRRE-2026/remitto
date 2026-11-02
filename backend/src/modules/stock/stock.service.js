import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/errors.js';

// HU11 (RNF5): toda variación de stock pasa por acá, dentro de la transacción
// del llamador. El movimiento y el nuevo stockActual se escriben juntos, así
// el stock mostrado siempre coincide con la suma de los movimientos.
// Reutilizable por HU13 (salidas), HU14 (recuento) y HU22.

const STOCK_MAXIMO = new Prisma.Decimal('1e9');

// Bloquea la fila del producto hasta el fin de la transacción: dos ingresos
// simultáneos del mismo producto se aplican uno detrás del otro.
async function bloquearProducto(tx, productoId) {
  const filas = await tx.$queryRaw`SELECT stock_actual FROM productos WHERE id = ${productoId} FOR UPDATE`;
  if (filas.length === 0) throw new Error(`Producto ${productoId} inexistente`);
  return new Prisma.Decimal(filas[0].stock_actual);
}

export async function registrarMovimiento(
  tx,
  {
    productoId,
    tipo,
    motivo,
    cantidad,
    usuarioId = null,
    observacion = null,
    detalleComprobanteId = null,
    salidaId = null,
    fecha,
  },
) {
  const delta = new Prisma.Decimal(cantidad);
  const stockAnterior = await bloquearProducto(tx, productoId);
  const stockNuevo = stockAnterior.plus(delta);
  // Columnas Decimal(12, 3): se avisa antes de que la base lo rechace.
  if (stockNuevo.abs().gte(STOCK_MAXIMO)) {
    throw ApiError.invalido(`El stock del producto ${productoId} superaría el máximo admitido.`, [
      { campo: 'cantidad', mensaje: 'La cantidad hace que el stock supere el máximo admitido.' },
    ]);
  }
  const movimiento = await tx.movimientoStock.create({
    data: {
      productoId,
      tipo,
      motivo,
      cantidad: delta,
      stockAnterior,
      observacion,
      usuarioId,
      detalleComprobanteId,
      salidaId,
      ...(fecha ? { fecha } : {}),
    },
  });
  await tx.producto.update({ where: { id: productoId }, data: { stockActual: stockNuevo } });
  // Punto de enganche para el observador de alertas de stock (HU24, Sprint 2).
  return { movimiento, stockAnterior, stockNuevo };
}

// Productos cuyo stockActual no coincide con la suma de sus movimientos.
// Lo usan la conciliación y las pruebas (criterio de HU12).
export function productosDescuadrados(db) {
  return db.$queryRaw`
    SELECT p.id, p.nombre, p.stock_actual AS "stockActual", COALESCE(SUM(m.cantidad), 0) AS "sumaMovimientos"
    FROM productos p
    LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id
    HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)
    ORDER BY p.id`;
}
