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

// Stock y último precio se leen en UNA sola sentencia: PostgreSQL le da a cada
// sentencia una única foto de la base, así que un ingreso que se confirma
// mientras tanto entra completo o no entra (nunca stock viejo con precio
// nuevo). Dos consultas separadas, aun dentro de una transacción con el
// aislamiento predeterminado (READ COMMITTED), podrían ver estados distintos.
export async function valorizacion(db = prisma) {
  const filas = await db.$queryRaw`
    SELECT p.id, p.nombre, p.unidad_medida::text AS "unidadMedida", p.stock_actual AS "stockActual",
           c.id AS "categoriaId", c.nombre AS "categoriaNombre",
           u.precio_unitario AS "precioUnitario", u.fecha_vigencia AS "fechaVigencia", u.proveedor,
           now() AS "generadoEn"
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    -- Último precio de compra del producto (fecha de vigencia más reciente;
    -- ante la misma fecha, el registrado último).
    LEFT JOIN LATERAL (
      SELECT pc.precio_unitario, pc.fecha_vigencia, pr.razon_social AS proveedor
      FROM precios_compra pc
      JOIN proveedores pr ON pr.id = pc.proveedor_id
      WHERE pc.producto_id = p.id
      ORDER BY pc.fecha_vigencia DESC, pc.creado_en DESC, pc.id DESC
      LIMIT 1
    ) u ON true
    WHERE p.activo AND p.stock_actual > 0`;
  const productos = filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    unidadMedida: f.unidadMedida,
    stockActual: f.stockActual,
    categoria: f.categoriaId == null ? null : { id: f.categoriaId, nombre: f.categoriaNombre },
  }));
  const precios = new Map(
    filas
      .filter((f) => f.precioUnitario != null)
      .map((f) => [f.id, { precioUnitario: f.precioUnitario, fechaVigencia: f.fechaVigencia, proveedor: f.proveedor }]),
  );
  return { generadoEn: filas[0]?.generadoEn ?? new Date(), ...valorizar(productos, precios) };
}
