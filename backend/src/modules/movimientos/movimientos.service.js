import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { estadoStock } from '../productos/productos.service.js';
import { productosDescuadrados } from '../stock/stock.service.js';

// HU12: consulta de existencias e historial de movimientos de stock.
// Solo lectura: el stock cambia únicamente en stock.service.js. Cada
// movimiento guarda el stock anterior, así se muestra "antes → después" y
// se comprueba que stock_actual = SUMA(movimientos).

// Argentina no usa horario de verano: el día local empieza a las 03:00 UTC.
const DESFASE_AR = '-03:00';

export function rangoFechas(desde, hasta) {
  if (!desde && !hasta) return undefined;
  const rango = {};
  if (desde) rango.gte = new Date(`${desde}T00:00:00${DESFASE_AR}`);
  if (hasta) {
    const fin = new Date(`${hasta}T00:00:00${DESFASE_AR}`);
    fin.setUTCDate(fin.getUTCDate() + 1);
    rango.lt = fin;
  }
  return rango;
}

// De dónde viene el movimiento: un comprobante (entrada), una salida o un ajuste.
function origen(m) {
  const c = m.detalleComprobante?.comprobante;
  if (c) {
    return {
      tipo: 'COMPROBANTE',
      id: c.id,
      tipoComprobante: c.tipo,
      numero: c.numero,
      proveedor: c.proveedor?.razonSocial ?? null,
    };
  }
  if (m.salida) {
    return {
      tipo: 'SALIDA',
      id: m.salida.id,
      origenSalida: m.salida.origen,
      integracion: m.salida.claveIntegracion?.nombre ?? null,
    };
  }
  return { tipo: 'AJUSTE' };
}

export function mapearMovimiento(m) {
  const cantidad = new Prisma.Decimal(m.cantidad);
  const stockAnterior = new Prisma.Decimal(m.stockAnterior);
  return {
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    motivo: m.motivo,
    cantidad: cantidad.toNumber(),
    stockAnterior: stockAnterior.toNumber(),
    stockNuevo: stockAnterior.plus(cantidad).toNumber(),
    observacion: m.observacion,
    producto: m.producto
      ? { id: m.producto.id, nombre: m.producto.nombre, unidadMedida: m.producto.unidadMedida }
      : null,
    usuario: m.usuario ? { id: m.usuario.id, nombre: m.usuario.nombre } : null,
    origen: origen(m),
  };
}

const incluir = {
  producto: { select: { id: true, nombre: true, unidadMedida: true } },
  usuario: { select: { id: true, nombre: true } },
  detalleComprobante: {
    select: {
      comprobante: {
        select: { id: true, tipo: true, numero: true, proveedor: { select: { razonSocial: true } } },
      },
    },
  },
  salida: { select: { id: true, origen: true, claveIntegracion: { select: { nombre: true } } } },
};

// Existencias del producto y comprobación de que coinciden con sus movimientos.
async function resumenProducto(productoId) {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: {
      id: true,
      nombre: true,
      unidadMedida: true,
      stockActual: true,
      stockMinimo: true,
      activo: true,
      categoria: { select: { nombre: true } },
    },
  });
  if (!producto) throw ApiError.noEncontrado('Producto no encontrado');

  const porTipo = await prisma.movimientoStock.groupBy({
    by: ['tipo'],
    where: { productoId },
    _sum: { cantidad: true },
    _count: { _all: true },
  });
  const totales = { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
  let suma = new Prisma.Decimal(0);
  let cantidadMovimientos = 0;
  for (const g of porTipo) {
    const parcial = new Prisma.Decimal(g._sum.cantidad ?? 0);
    totales[g.tipo] = parcial.toNumber();
    suma = suma.plus(parcial);
    cantidadMovimientos += g._count._all;
  }

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: producto.categoria?.nombre ?? null,
    unidadMedida: producto.unidadMedida,
    activo: producto.activo,
    stockActual: Number(producto.stockActual),
    stockMinimo: Number(producto.stockMinimo),
    estadoStock: estadoStock(producto.stockActual, producto.stockMinimo),
    sumaMovimientos: suma.toNumber(),
    coherente: suma.equals(producto.stockActual),
    cantidadMovimientos,
    totales: { entradas: totales.ENTRADA, salidas: totales.SALIDA, ajustes: totales.AJUSTE },
  };
}

export async function listar({ productoId, tipo, desde, hasta, pagina = 1, limite = 30 } = {}) {
  const producto = productoId ? await resumenProducto(productoId) : null;

  const where = {};
  if (productoId) where.productoId = productoId;
  if (tipo) where.tipo = tipo;
  const fecha = rangoFechas(desde, hasta);
  if (fecha) where.fecha = fecha;

  const [total, filas] = await prisma.$transaction([
    prisma.movimientoStock.count({ where }),
    prisma.movimientoStock.findMany({
      where,
      include: incluir,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ]);

  return {
    movimientos: filas.map(mapearMovimiento),
    total,
    pagina,
    limite,
    hayMas: pagina * limite < total,
    producto,
  };
}

// Criterio de HU12: el stock de cada producto es la suma de sus movimientos.
export async function conciliacion() {
  const filas = await productosDescuadrados(prisma);
  const descuadrados = filas.map((p) => {
    const stockActual = new Prisma.Decimal(p.stockActual);
    const sumaMovimientos = new Prisma.Decimal(p.sumaMovimientos);
    return {
      id: p.id,
      nombre: p.nombre,
      stockActual: stockActual.toNumber(),
      sumaMovimientos: sumaMovimientos.toNumber(),
      diferencia: stockActual.minus(sumaMovimientos).toNumber(),
    };
  });
  return { coherente: descuadrados.length === 0, descuadrados };
}
