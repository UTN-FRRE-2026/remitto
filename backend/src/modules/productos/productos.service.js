import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

// Deriva el estado de stock a partir de las existencias y el mínimo.
export function estadoStock(stockActual, stockMinimo) {
  const actual = Number(stockActual);
  const minimo = Number(stockMinimo);
  if (actual <= 0) return 'SIN_STOCK';
  if (minimo > 0 && actual <= minimo) return 'STOCK_BAJO';
  return 'EN_STOCK';
}

// Convierte los Decimal de Prisma a números y agrega el estado derivado.
function mapear(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    codigoBarras: p.codigoBarras,
    categoriaId: p.categoriaId,
    categoria: p.categoria ? { id: p.categoria.id, nombre: p.categoria.nombre } : null,
    unidadMedida: p.unidadMedida,
    stockActual: Number(p.stockActual),
    stockMinimo: Number(p.stockMinimo),
    stockDeseado: p.stockDeseado === null ? null : Number(p.stockDeseado),
    estadoStock: estadoStock(p.stockActual, p.stockMinimo),
    activo: p.activo,
    creadoEn: p.creadoEn,
  };
}

export async function listar({ q, categoriaId, estado = 'TODOS', incluirInactivos = false } = {}) {
  const where = {};
  if (!incluirInactivos) where.activo = true;
  if (categoriaId) where.categoriaId = categoriaId;
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { codigoBarras: { contains: q } },
    ];
  }

  const productos = await prisma.producto.findMany({
    where,
    include: { categoria: true },
    orderBy: { nombre: 'asc' },
  });

  const mapeados = productos.map(mapear);
  if (estado === 'TODOS') return mapeados;
  return mapeados.filter((p) => p.estadoStock === estado);
}

export async function obtener(id) {
  const producto = await prisma.producto.findUnique({
    where: { id },
    include: { categoria: true },
  });
  if (!producto) throw ApiError.noEncontrado('Producto no encontrado');
  return mapear(producto);
}

export async function crear(datos) {
  const producto = await prisma.producto.create({
    data: datos,
    include: { categoria: true },
  });
  return mapear(producto);
}

export async function actualizar(id, datos) {
  await obtener(id);
  const producto = await prisma.producto.update({
    where: { id },
    data: datos,
    include: { categoria: true },
  });
  return mapear(producto);
}

// HU4: un producto con movimientos no se elimina, se desactiva.
export async function desactivar(id) {
  await obtener(id);
  const producto = await prisma.producto.update({
    where: { id },
    data: { activo: false },
    include: { categoria: true },
  });
  return mapear(producto);
}

// Indicadores del tablero (HU26) y encabezado de la pantalla de productos.
export async function resumen() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    select: { stockActual: true, stockMinimo: true },
  });

  let enStock = 0;
  let stockBajo = 0;
  let sinStock = 0;
  for (const p of productos) {
    const estado = estadoStock(p.stockActual, p.stockMinimo);
    if (estado === 'SIN_STOCK') sinStock += 1;
    else if (estado === 'STOCK_BAJO') stockBajo += 1;
    else enStock += 1;
  }

  return {
    totalProductos: productos.length,
    enStock,
    stockBajo,
    sinStock,
  };
}
