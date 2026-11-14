import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// HU28 (RF8.1): valorización de existencias a precio de compra.
// - Se valorizan los productos activos con stock positivo: stock × último
//   precio de compra (el de fecha de vigencia más reciente, de cualquier
//   proveedor; ante la misma fecha, el registrado último).
// - Cada producto se redondea a centavos y los totales se suman en centavos,
//   así el total coincide exactamente con la suma por categoría.
// - Los productos con stock y sin precio registrado se informan aparte y no
//   entran en el total.

const SIN_CATEGORIA = 'Sin categoría';
const cero = new Prisma.Decimal(0);
const aCentavos = (d) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

// Arma el reporte (pura, sin base de datos).
// productos: [{ id, nombre, unidadMedida, stockActual, categoria: { id, nombre } | null }]
// precios: Map productoId → { precioUnitario, fechaVigencia, proveedor }
export function valorizar(productos, precios) {
  const categorias = new Map();
  const sinPrecio = [];
  let total = cero;
  let productosValorizados = 0;

  for (const p of productos) {
    const stock = new Prisma.Decimal(p.stockActual);
    if (stock.lte(0)) continue;
    const precio = precios.get(p.id);
    if (!precio) {
      sinPrecio.push({
        id: p.id,
        nombre: p.nombre,
        unidadMedida: p.unidadMedida,
        stockActual: stock.toNumber(),
        categoria: p.categoria?.nombre ?? SIN_CATEGORIA,
      });
      continue;
    }
    const valor = aCentavos(stock.times(precio.precioUnitario));
    const clave = p.categoria?.id ?? 0;
    if (!categorias.has(clave)) {
      categorias.set(clave, { id: p.categoria?.id ?? null, nombre: p.categoria?.nombre ?? SIN_CATEGORIA, valor: cero, productos: [] });
    }
    const categoria = categorias.get(clave);
    categoria.valor = categoria.valor.plus(valor);
    categoria.productos.push({
      id: p.id,
      nombre: p.nombre,
      unidadMedida: p.unidadMedida,
      stockActual: stock.toNumber(),
      ultimoPrecio: new Prisma.Decimal(precio.precioUnitario).toNumber(),
      fechaPrecio: precio.fechaVigencia,
      proveedor: precio.proveedor ?? null,
      valor: valor.toNumber(),
    });
    total = total.plus(valor);
    productosValorizados += 1;
  }

  const lista = [...categorias.values()]
    .map((c) => ({
      ...c,
      valor: c.valor.toNumber(),
      porcentaje: total.isZero() ? 0 : c.valor.div(total).times(100).toDecimalPlaces(1).toNumber(),
      productos: c.productos.sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es')),
    }))
    // Mayor valor primero; "Sin categoría" al final si empata.
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    total: total.toNumber(),
    productosValorizados,
    categorias: lista,
    sinPrecio: sinPrecio.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}

export async function valorizacion() {
  const [productos, ultimos] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true, stockActual: { gt: 0 } },
      select: { id: true, nombre: true, unidadMedida: true, stockActual: true, categoria: { select: { id: true, nombre: true } } },
    }),
    // Último precio de cada producto (DISTINCT ON se queda con la primera fila
    // de cada producto según el orden).
    prisma.$queryRaw`
      SELECT DISTINCT ON (pc.producto_id)
        pc.producto_id AS "productoId", pc.precio_unitario AS "precioUnitario",
        pc.fecha_vigencia AS "fechaVigencia", pr.razon_social AS "proveedor"
      FROM precios_compra pc
      JOIN proveedores pr ON pr.id = pc.proveedor_id
      ORDER BY pc.producto_id, pc.fecha_vigencia DESC, pc.creado_en DESC, pc.id DESC`,
  ]);
  const precios = new Map(ultimos.map((u) => [u.productoId, u]));
  return { generadoEn: new Date(), ...valorizar(productos, precios) };
}
