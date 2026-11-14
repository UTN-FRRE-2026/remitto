import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { rangoFechas } from '../movimientos/movimientos.service.js';

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

// ---------------------------------------------------------------------------
// HU27 (RF6.2): sugerencia de reposición.
// - Entran los productos activos con stock mínimo definido (> 0) y el stock en
//   el mínimo o por debajo: el mismo criterio de «stock bajo» que el resto de
//   la aplicación (Inicio, Productos).
// - La cantidad sugerida lleva el producto a su stock deseado (deseado −
//   actual). Las unidades y los paquetes se redondean hacia arriba; kilos y
//   litros, a 3 decimales.
// - Se agrupa por el proveedor del último precio de compra (el mismo «último»
//   que la valorización). Sin compras registradas: «Sin proveedor registrado».
// - Sin stock deseado (o con un deseado que no supera el stock) no se puede
//   calcular cuánto pedir: se informan aparte para completarlo.

const ENTERAS = new Set(['UNIDAD', 'PAQUETE']);
const SIN_PROVEEDOR = 'Sin proveedor registrado';

export function cantidadSugerida(stockActual, stockDeseado, unidadMedida) {
  if (stockDeseado == null) return null;
  const falta = new Prisma.Decimal(stockDeseado).minus(stockActual);
  if (falta.lte(0)) return null;
  return ENTERAS.has(unidadMedida)
    ? falta.toDecimalPlaces(0, Prisma.Decimal.ROUND_UP).toNumber()
    : falta.toDecimalPlaces(3, Prisma.Decimal.ROUND_UP).toNumber();
}

// Arma la sugerencia (pura). filas: productos activos con su último precio.
export function sugerir(filas) {
  const proveedores = new Map();
  const sinDeseado = [];
  let productos = 0;
  let costoTotal = cero;
  let productosSinPrecio = 0;

  for (const f of filas) {
    const stock = new Prisma.Decimal(f.stockActual);
    const minimo = new Prisma.Decimal(f.stockMinimo);
    if (minimo.lte(0) || stock.gt(minimo)) continue;
    const base = {
      id: f.id,
      nombre: f.nombre,
      unidadMedida: f.unidadMedida,
      categoria: f.categoriaNombre ?? SIN_CATEGORIA,
      stockActual: stock.toNumber(),
      stockMinimo: minimo.toNumber(),
      stockDeseado: f.stockDeseado == null ? null : new Prisma.Decimal(f.stockDeseado).toNumber(),
    };
    const cantidad = cantidadSugerida(stock, f.stockDeseado, f.unidadMedida);
    if (cantidad == null) {
      sinDeseado.push(base);
      continue;
    }
    const precio = f.precioUnitario == null ? null : new Prisma.Decimal(f.precioUnitario);
    const costo = precio ? aCentavos(precio.times(cantidad)) : null;
    const clave = f.proveedorId ?? 0;
    if (!proveedores.has(clave)) {
      proveedores.set(clave, { id: f.proveedorId ?? null, nombre: f.proveedor ?? SIN_PROVEEDOR, costo: cero, conPrecio: 0, productos: [] });
    }
    const grupo = proveedores.get(clave);
    grupo.productos.push({ ...base, cantidad, ultimoPrecio: precio?.toNumber() ?? null, costo: costo?.toNumber() ?? null });
    if (costo) {
      grupo.costo = grupo.costo.plus(costo);
      grupo.conPrecio += 1;
      costoTotal = costoTotal.plus(costo);
    } else {
      productosSinPrecio += 1;
    }
    productos += 1;
  }

  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  return {
    productos,
    // Costo estimado al último precio; no incluye los productos sin precio.
    costoEstimado: costoTotal.toNumber(),
    productosSinPrecio,
    proveedores: [...proveedores.values()]
      .map((g) => ({ ...g, costo: g.costo.toNumber(), productos: g.productos.sort(porNombre) }))
      // Proveedores con nombre primero; «Sin proveedor registrado» al final.
      .sort((a, b) => (a.id == null) - (b.id == null) || porNombre(a, b)),
    sinDeseado: sinDeseado.sort(porNombre),
  };
}

// Productos activos con su último precio y proveedor: una sola sentencia, así
// stock y precio salen de la misma foto de la base (como la valorización).
function consultaProductos(condicion, columnasExtra = Prisma.empty) {
  return Prisma.sql`
    SELECT p.id, p.nombre, p.unidad_medida::text AS "unidadMedida", p.stock_actual AS "stockActual",
           p.stock_minimo AS "stockMinimo", p.stock_deseado AS "stockDeseado", p.creado_en AS "creadoEn",
           c.nombre AS "categoriaNombre",
           u.precio_unitario AS "precioUnitario", u.fecha_vigencia AS "fechaVigencia",
           u.proveedor_id AS "proveedorId", u.proveedor,
           now() AS "generadoEn" ${columnasExtra}
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN LATERAL (
      SELECT pc.precio_unitario, pc.fecha_vigencia, pr.id AS proveedor_id, pr.razon_social AS proveedor
      FROM precios_compra pc
      JOIN proveedores pr ON pr.id = pc.proveedor_id
      WHERE pc.producto_id = p.id
      ORDER BY pc.fecha_vigencia DESC, pc.creado_en DESC, pc.id DESC
      LIMIT 1
    ) u ON true
    WHERE p.activo ${condicion}`;
}

export async function reposicion(db = prisma) {
  const filas = await db.$queryRaw(consultaProductos(Prisma.sql`AND p.stock_minimo > 0 AND p.stock_actual <= p.stock_minimo`));
  return { generadoEn: filas[0]?.generadoEn ?? new Date(), ...sugerir(filas) };
}

// ---------------------------------------------------------------------------
// HU29 (RF8.2): productos sin movimiento.
// - Productos activos con stock que no tuvieron ninguna SALIDA (venta, consumo,
//   rotura, vencimiento…) entre «desde» y «hasta» (días en hora de Argentina,
//   «hasta» inclusivo). Los ajustes por recuento y los ingresos no cuentan.
// - Cada uno muestra su stock, su valor a último precio de compra (si tiene) y
//   la fecha de su última salida (puede ser anterior al período o no existir).

const DIA_MS = 24 * 60 * 60 * 1000;

export function inmovilizados(filas, { hasta }) {
  let total = cero;
  let sinPrecio = 0;
  const productos = filas
    .map((f) => {
      const stock = new Prisma.Decimal(f.stockActual);
      const precio = f.precioUnitario == null ? null : new Prisma.Decimal(f.precioUnitario);
      const valor = precio ? aCentavos(stock.times(precio)) : null;
      if (valor) total = total.plus(valor);
      else sinPrecio += 1;
      const ultima = f.ultimaSalida ? new Date(f.ultimaSalida) : null;
      return {
        id: f.id,
        nombre: f.nombre,
        unidadMedida: f.unidadMedida,
        categoria: f.categoriaNombre ?? SIN_CATEGORIA,
        stockActual: stock.toNumber(),
        ultimoPrecio: precio?.toNumber() ?? null,
        valor: valor?.toNumber() ?? null,
        ultimaSalida: ultima,
        // Días desde la última salida hasta el fin del período (null: nunca salió).
        diasSinSalida: ultima ? Math.max(0, Math.floor((hasta.getTime() - ultima.getTime()) / DIA_MS)) : null,
        creadoEn: f.creadoEn,
      };
    })
    // Mayor capital inmovilizado primero; sin precio al final, por nombre.
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1) || a.nombre.localeCompare(b.nombre, 'es'));
  return { productos, valorTotal: total.toNumber(), productosSinPrecio: sinPrecio };
}

export async function sinMovimiento({ desde, hasta }, db = prisma) {
  const rango = rangoFechas(desde, hasta);
  const filas = await db.$queryRaw(
    consultaProductos(
      Prisma.sql`AND p.stock_actual > 0 AND NOT EXISTS (
        SELECT 1 FROM movimientos_stock m
        WHERE m.producto_id = p.id AND m.tipo = 'SALIDA' AND m.fecha >= ${rango.gte} AND m.fecha < ${rango.lt})`,
      Prisma.sql`, (SELECT max(m.fecha) FROM movimientos_stock m WHERE m.producto_id = p.id AND m.tipo = 'SALIDA') AS "ultimaSalida"`,
    ),
  );
  return { desde, hasta, generadoEn: filas[0]?.generadoEn ?? new Date(), ...inmovilizados(filas, { hasta: rango.lt }) };
}

// ---------------------------------------------------------------------------
// HU20 (RF8.3): evolución de los precios de compra.
// - Historial de precios_compra por producto y proveedor dentro del período
//   (fecha de vigencia = fecha de emisión del comprobante), ordenado por fecha;
//   ante la misma fecha, el registrado último va al final (como el «último
//   precio» de la valorización).
// - Por proveedor: primer y último precio del período y su variación.
// - Comparación entre proveedores: el último precio de cada uno y cuánto más
//   caro es que el más barato.

const variacion = (desde, hasta) =>
  desde.gt(0) ? hasta.minus(desde).div(desde).times(100).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP).toNumber() : null;

// Agrupa las filas (ya ordenadas por fecha) por producto y proveedor (pura).
export function evolucion(filas) {
  const productos = new Map();
  for (const [orden, f] of filas.entries()) {
    if (!productos.has(f.productoId)) {
      productos.set(f.productoId, { id: f.productoId, nombre: f.nombre, unidadMedida: f.unidadMedida, proveedores: new Map() });
    }
    const p = productos.get(f.productoId);
    if (!p.proveedores.has(f.proveedorId)) p.proveedores.set(f.proveedorId, { id: f.proveedorId, nombre: f.proveedor, puntos: [] });
    const proveedor = p.proveedores.get(f.proveedorId);
    proveedor.puntos.push({ fecha: f.fechaVigencia, precio: new Prisma.Decimal(f.precioUnitario) });
    proveedor.orden = orden; // posición de su último precio en el orden por fecha

  }

  return [...productos.values()].map((p) => {
    const proveedores = [...p.proveedores.values()].map((pr) => {
      const primero = pr.puntos[0];
      const ultimo = pr.puntos[pr.puntos.length - 1];
      return {
        ...pr,
        primero,
        ultimo,
        variacion: pr.puntos.length > 1 ? variacion(primero.precio, ultimo.precio) : null,
      };
    });
    const mejor = proveedores.reduce((m, pr) => (pr.ultimo.precio.lt(m) ? pr.ultimo.precio : m), proveedores[0].ultimo.precio);
    // El último precio del producto: el de fecha más reciente entre todos los proveedores.
    const masReciente = proveedores.reduce((a, b) => (b.orden > a.orden ? b : a));
    const numero = (punto) => ({ fecha: punto.fecha, precio: punto.precio.toNumber() });
    return {
      id: p.id,
      nombre: p.nombre,
      unidadMedida: p.unidadMedida,
      precios: proveedores.reduce((s, pr) => s + pr.puntos.length, 0),
      ultimo: { ...numero(masReciente.ultimo), proveedor: masReciente.nombre },
      // Variación del período con el proveedor del último precio.
      variacion: masReciente.variacion,
      proveedores: proveedores
        .map((pr) => ({
          id: pr.id,
          nombre: pr.nombre,
          puntos: pr.puntos.map(numero),
          primero: numero(pr.primero),
          ultimo: numero(pr.ultimo),
          variacion: pr.variacion,
          // Cuánto más caro que el más barato (0 = es el más barato).
          sobreMejor: proveedores.length > 1 ? variacion(mejor, pr.ultimo.precio) : null,
        }))
        .sort((a, b) => a.ultimo.precio - b.ultimo.precio || a.nombre.localeCompare(b.nombre, 'es')),
    };
  });
}

function consultaPrecios({ desde, hasta }, productoId) {
  return Prisma.sql`
    SELECT pc.producto_id AS "productoId", p.nombre, p.unidad_medida::text AS "unidadMedida",
           pc.proveedor_id AS "proveedorId", pr.razon_social AS proveedor,
           pc.precio_unitario AS "precioUnitario", pc.fecha_vigencia AS "fechaVigencia",
           now() AS "generadoEn"
    FROM precios_compra pc
    JOIN productos p ON p.id = pc.producto_id
    JOIN proveedores pr ON pr.id = pc.proveedor_id
    WHERE pc.fecha_vigencia BETWEEN ${desde}::date AND ${hasta}::date
      ${productoId ? Prisma.sql`AND pc.producto_id = ${productoId}` : Prisma.empty}
    ORDER BY pc.fecha_vigencia, pc.creado_en, pc.id`;
}

// Productos con precios en el período: los que más aumentaron primero.
export async function precios(periodo, db = prisma) {
  const filas = await db.$queryRaw(consultaPrecios(periodo));
  const productos = evolucion(filas)
    .map(({ proveedores, ...p }) => ({ ...p, proveedores: proveedores.length }))
    .sort((a, b) => (b.variacion ?? -Infinity) - (a.variacion ?? -Infinity) || a.nombre.localeCompare(b.nombre, 'es'));
  return { ...periodo, generadoEn: filas[0]?.generadoEn ?? new Date(), productos };
}

// Historial de un producto, para el gráfico y la comparación entre proveedores.
export async function preciosDeProducto(productoId, periodo, db = prisma) {
  const producto = await db.producto.findUnique({ where: { id: productoId }, select: { id: true, nombre: true, unidadMedida: true } });
  if (!producto) throw ApiError.noEncontrado('Producto no encontrado');
  const [resultado] = evolucion(await db.$queryRaw(consultaPrecios(periodo, productoId)));
  return { ...periodo, producto, precios: resultado?.precios ?? 0, ultimo: resultado?.ultimo ?? null, proveedores: resultado?.proveedores ?? [] };
}
