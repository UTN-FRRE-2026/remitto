import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { evaluarAlertas } from '../alertas/alertas.service.js';

// Traduce las restricciones de la base a mensajes que la pantalla puede mostrar.
export function traducirErrorProducto(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // El único campo único de productos es el código de barras (HU4).
    if (err.code === 'P2002') return ApiError.conflicto('Ya existe un producto con ese código de barras.');
    // La única clave foránea que se informa al crear o modificar es la categoría.
    if (err.code === 'P2003') return ApiError.invalido('La categoría elegida no existe.');
  }
  return err;
}

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

// db: el cliente o una transacción (el tablero de HU26 lee en una sola foto).
export async function listar({ q, codigo, categoriaId, estado = 'TODOS', incluirInactivos = false } = {}, db = prisma) {
  const where = {};
  if (!incluirInactivos) where.activo = true;
  if (categoriaId) where.categoriaId = categoriaId;
  if (codigo) where.codigoBarras = codigo;
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { codigoBarras: { contains: q } },
    ];
  }

  const productos = await db.producto.findMany({
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
  try {
    // HU24: un producto nuevo empieza sin stock y su alerta se abre con él.
    const producto = await prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({ data: datos, include: { categoria: true } });
      await evaluarAlertas(tx, creado.id);
      return creado;
    });
    return mapear(producto);
  } catch (err) {
    throw traducirErrorProducto(err);
  }
}

export async function actualizar(id, datos) {
  const actual = await obtener(id);
  try {
    if (datos.unidadMedida && datos.unidadMedida !== actual.unidadMedida) {
      return mapear(await cambiarUnidad(id, datos));
    }
    // HU24: cambiar el mínimo o reactivar el producto puede abrir o resolver su alerta.
    const producto = await prisma.$transaction(async (tx) => {
      const modificado = await tx.producto.update({ where: { id }, data: datos, include: { categoria: true } });
      await evaluarAlertas(tx, id);
      return modificado;
    });
    return mapear(producto);
  } catch (err) {
    throw traducirErrorProducto(err);
  }
}

// La unidad solo se cambia si el producto no tiene movimientos: con historial,
// cambiarla alteraría el sentido de las cantidades ya registradas. Se bloquea
// la fila (como registrarMovimiento) para que no entre un movimiento en medio.
async function cambiarUnidad(id, datos) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM productos WHERE id = ${id} FOR UPDATE`;
    const movimientos = await tx.movimientoStock.count({ where: { productoId: id } });
    if (movimientos > 0) {
      throw ApiError.invalido('No se puede cambiar la unidad de un producto que ya tiene movimientos.');
    }
    const modificado = await tx.producto.update({ where: { id }, data: datos, include: { categoria: true } });
    await evaluarAlertas(tx, id);
    return modificado;
  });
}

// HU4: un producto con movimientos no se elimina, se desactiva.
export async function desactivar(id) {
  await obtener(id);
  // HU24: un producto desactivado no deja alertas activas.
  const producto = await prisma.$transaction(async (tx) => {
    const desactivado = await tx.producto.update({ where: { id }, data: { activo: false }, include: { categoria: true } });
    await evaluarAlertas(tx, id);
    return desactivado;
  });
  return mapear(producto);
}

// Indicadores del tablero (HU26) y encabezado de la pantalla de productos.
export async function resumen(db = prisma) {
  const productos = await db.producto.findMany({
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
