import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { observarMovimientos } from '../stock/stock.observadores.js';

// HU24 (RF6.1): alertas de stock bajo, sin stock y negativo.
// - Mismas reglas que estadoStock() de productos, separando el negativo, para
//   que las alertas coincidan con los indicadores del tablero.
// - Un producto tiene a lo sumo una alerta activa: cuando su situación cambia,
//   la anterior se resuelve y se abre la nueva; cuando se recupera, se
//   resuelve sola. La base lo respalda con el índice parcial uq_alerta_activa
//   (una ACTIVA por producto y tipo).
// - Los productos desactivados no tienen alertas activas.

export const TIPOS = ['STOCK_NEGATIVO', 'SIN_STOCK', 'STOCK_BAJO']; // de más a menos grave

export function tipoAlerta(stockActual, stockMinimo, activo = true) {
  if (!activo) return null;
  const stock = new Prisma.Decimal(stockActual);
  const minimo = new Prisma.Decimal(stockMinimo ?? 0);
  if (stock.lt(0)) return 'STOCK_NEGATIVO';
  if (stock.eq(0)) return 'SIN_STOCK';
  if (minimo.gt(0) && stock.lte(minimo)) return 'STOCK_BAJO';
  return null;
}

// Crea o resuelve la alerta de un producto según su stock actual. Se llama
// dentro de la transacción que cambió el producto; bloquea su fila, así dos
// evaluaciones del mismo producto se aplican una detrás de la otra.
export async function evaluarAlertas(tx, productoId, ahora = new Date()) {
  const [p] = await tx.$queryRaw`
    SELECT stock_actual, stock_minimo, activo FROM productos WHERE id = ${productoId} FOR UPDATE`;
  if (!p) return null;
  const tipo = tipoAlerta(p.stock_actual, p.stock_minimo, p.activo);
  const activas = await tx.alertaStock.findMany({
    where: { productoId, estado: 'ACTIVA' },
    select: { id: true, tipo: true },
  });
  const aResolver = activas.filter((a) => a.tipo !== tipo).map((a) => a.id);
  if (aResolver.length > 0) {
    await tx.alertaStock.updateMany({
      where: { id: { in: aResolver }, estado: 'ACTIVA' },
      data: { estado: 'RESUELTA', resueltaEn: ahora },
    });
  }
  if (tipo && !activas.some((a) => a.tipo === tipo)) {
    await tx.alertaStock.create({ data: { productoId, tipo, stockAlGenerar: p.stock_actual } });
  }
  return tipo;
}

// Observador de movimientos: todo lo que pasa por registrarMovimiento
// (comprobantes, carrito, recuento y ventas del endpoint de integración)
// recalcula la alerta del producto. Se activa al crear la app.
const alMoverStock = (tx, { productoId }) => evaluarAlertas(tx, productoId);

export function activarAlertas() {
  return observarMovimientos(alMoverStock);
}

// Recalcula las alertas de todos los productos (lo usa el seed, que crea
// productos sin pasar por la API).
export async function sincronizarAlertas(db = prisma) {
  const productos = await db.producto.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  for (const { id } of productos) await db.$transaction((tx) => evaluarAlertas(tx, id));
  return productos.length;
}

const num = (d) => (d === null || d === undefined ? null : Number(d));

function mapear(a) {
  return {
    id: a.id,
    tipo: a.tipo,
    estado: a.estado,
    stockAlGenerar: num(a.stockAlGenerar),
    creadaEn: a.creadaEn,
    resueltaEn: a.resueltaEn,
    producto: {
      id: a.producto.id,
      nombre: a.producto.nombre,
      unidadMedida: a.producto.unidadMedida,
      stockActual: num(a.producto.stockActual),
      stockMinimo: num(a.producto.stockMinimo),
      categoria: a.producto.categoria?.nombre ?? null,
    },
  };
}

// Ordena las activas por gravedad y, dentro de cada tipo, la más reciente primero.
export function ordenarActivas(alertas) {
  return [...alertas].sort(
    (a, b) => TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo) || new Date(b.creadaEn) - new Date(a.creadaEn) || b.id - a.id,
  );
}

export function contar(activas) {
  const totales = { total: activas.length, STOCK_NEGATIVO: 0, SIN_STOCK: 0, STOCK_BAJO: 0 };
  for (const a of activas) totales[a.tipo] += 1;
  return totales;
}

const PRODUCTO = {
  select: { id: true, nombre: true, unidadMedida: true, stockActual: true, stockMinimo: true, categoria: { select: { nombre: true } } },
};

// Alertas activas y las últimas resueltas (historia breve).
export async function listar({ resueltas = 20 } = {}, db = prisma) {
  const [activas, ultimas] = await Promise.all([
    db.alertaStock.findMany({ where: { estado: 'ACTIVA' }, include: { producto: PRODUCTO } }),
    db.alertaStock.findMany({
      where: { estado: 'RESUELTA' },
      include: { producto: PRODUCTO },
      orderBy: [{ resueltaEn: 'desc' }, { id: 'desc' }],
      take: resueltas,
    }),
  ]);
  const lista = ordenarActivas(activas.map(mapear));
  return { totales: contar(lista), activas: lista, resueltas: ultimas.map(mapear) };
}
