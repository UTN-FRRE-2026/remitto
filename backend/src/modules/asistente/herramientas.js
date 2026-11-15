import { Prisma } from '@prisma/client';
import { rangoFechas } from '../movimientos/movimientos.service.js';
import { reposicion, sinMovimiento, preciosDeProducto, precios } from '../reportes/reportes.service.js';
import { alertasActivas } from '../tablero/tablero.service.js';
import { estadoStock } from '../productos/productos.service.js';
import { MAX_FILAS, resolverPeriodo, describirPeriodo } from './asistente.schema.js';

// HU25: herramientas de lectura habilitadas para el asistente. El modelo solo
// elige una y sus argumentos; acá se consultan los datos (con la transacción
// de solo lectura que recibe cada herramienta) y se arman el texto, la tabla
// o el gráfico. Los números y las etiquetas los controla el backend.
//
// «Ventas» son solo las salidas con motivo VENTA; «salidas» son todas
// (ventas, consumo interno, roturas, vencimientos y otras).

const UNIDAD = { UNIDAD: 'u.', KILOGRAMO: 'kg', GRAMO: 'g', LITRO: 'l', MILILITRO: 'ml', METRO: 'm', PAQUETE: 'paq.' };
const MOTIVO = { VENTA: 'Ventas', CONSUMO_INTERNO: 'Consumo interno', ROTURA: 'Roturas', VENCIMIENTO: 'Vencimientos', OTRO: 'Otras salidas' };
const ESTADO = { EN_STOCK: 'En stock', STOCK_BAJO: 'Stock bajo', SIN_STOCK: 'Sin stock' };
const ALERTA = { STOCK_NEGATIVO: 'Stock negativo', SIN_STOCK: 'Sin stock', STOCK_BAJO: 'Stock bajo' };

const num = (v) => (v == null ? null : new Prisma.Decimal(v).toNumber());
export const formatoNumero = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 });
export const formatoPesos = (n) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cantidadCon = (n, unidad) => `${formatoNumero(n)} ${UNIDAD[unidad] ?? ''}`.trim();
const porcentaje = (n) => `${n > 0 ? '+' : ''}${formatoNumero(n)} %`;

// Muestra hasta MAX_FILAS filas e informa cuántas hay en total.
export function limitar(lista, limite = MAX_FILAS) {
  const filas = lista.slice(0, Math.min(limite, MAX_FILAS));
  return { filas, totalFilas: lista.length, nota: lista.length > filas.length ? `Se muestran ${filas.length} de ${lista.length}.` : null };
}

const tabla = ({ titulo, columnas, lista, limite, totales = null, nota = null }) => {
  const { filas, totalFilas, nota: notaLimite } = limitar(lista, limite);
  return { tipo: 'tabla', titulo, columnas, filas, totalFilas, totales, nota: [notaLimite, nota].filter(Boolean).join(' ') || null };
};

// --- Productos ----------------------------------------------------------

export const normalizar = (t) =>
  String(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Busca el producto nombrado entre los activos (pura). Devuelve
// { producto } o { opciones } (varias o ninguna coincidencia).
export function elegirProducto(texto, activos) {
  const buscado = normalizar(texto);
  const palabras = buscado.split(' ').filter((p) => p.length > 1);
  const exacto = activos.filter((p) => normalizar(p.nombre) === buscado);
  if (exacto.length === 1) return { producto: exacto[0] };
  const conTodas = activos.filter((p) => palabras.every((w) => normalizar(p.nombre).split(' ').some((n) => n.startsWith(w))));
  if (conTodas.length === 1) return { producto: conTodas[0] };
  const candidatos = conTodas.length ? conTodas : activos.filter((p) => palabras.some((w) => normalizar(p.nombre).includes(w)));
  return { opciones: candidatos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, 5) };
}

async function resolverProducto(args, ctx) {
  const activos = await ctx.tx.producto.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, unidadMedida: true, stockActual: true, stockMinimo: true, categoria: { select: { nombre: true } } },
    orderBy: { nombre: 'asc' },
  });
  // Elección de una aclaración: el producto ya está identificado (y validado).
  if (ctx.productoId) {
    const elegido = activos.find((p) => p.id === ctx.productoId);
    return elegido ? { producto: elegido } : { opciones: [] };
  }
  return elegirProducto(args.producto, activos);
}

function aclaracionProducto(texto, opciones) {
  if (opciones.length === 0) {
    return { aclaracion: { mensaje: `No encontré un producto activo que coincida con «${texto}». ¿Podés escribir su nombre?`, opciones: [] } };
  }
  return {
    aclaracion: {
      mensaje: `Encontré varios productos para «${texto}». ¿Cuál querés consultar?`,
      opciones: opciones.map((p) => ({ id: p.id, nombre: p.nombre })),
    },
  };
}

const conPeriodo = (args, porDefecto, ctx) => resolverPeriodo(args.periodo, porDefecto, ctx.hoy);

// --- Herramientas -------------------------------------------------------

export const HERRAMIENTAS = {
  // 1. Stock de un producto.
  stock_producto: {
    descripcion: 'Stock actual de un producto',
    async ejecutar(args, ctx) {
      const r = await resolverProducto(args, ctx);
      if (!r.producto) return aclaracionProducto(args.producto, r.opciones);
      const p = r.producto;
      const stock = num(p.stockActual);
      const minimo = num(p.stockMinimo);
      const estado = estadoStock(stock, minimo);
      return {
        texto: `Tenés ${cantidadCon(stock, p.unidadMedida)} de ${p.nombre}${minimo > 0 ? ` (mínimo ${cantidadCon(minimo, p.unidadMedida)})` : ''}: ${ESTADO[estado].toLowerCase()}.`,
        presentacion: tabla({
          titulo: `Stock de ${p.nombre}`,
          columnas: [
            { clave: 'producto', titulo: 'Producto' },
            { clave: 'stock', titulo: 'Stock', tipo: 'numero' },
            { clave: 'minimo', titulo: 'Mínimo', tipo: 'numero' },
            { clave: 'unidad', titulo: 'Unidad' },
            { clave: 'estado', titulo: 'Estado' },
          ],
          lista: [{ producto: p.nombre, stock, minimo, unidad: UNIDAD[p.unidadMedida], estado: ESTADO[estado] }],
        }),
        filas: 1,
        productoId: p.id,
      };
    },
  },

  // 2. Faltantes y alertas (HU24).
  faltantes: {
    descripcion: 'Productos con alerta de stock (negativo, sin stock o bajo)',
    async ejecutar(args, ctx) {
      const { totales, todas } = await alertasActivas(ctx.tx);
      const texto =
        totales.total === 0
          ? 'No hay alertas de stock: ningún producto está sin stock ni por debajo de su mínimo.'
          : `Hay ${totales.total} ${totales.total === 1 ? 'producto con alerta' : 'productos con alerta'}: ${totales.STOCK_NEGATIVO} con stock negativo, ${totales.SIN_STOCK} sin stock y ${totales.STOCK_BAJO} con stock bajo.`;
      return {
        texto,
        presentacion: tabla({
          titulo: 'Faltantes y alertas de stock',
          columnas: [
            { clave: 'producto', titulo: 'Producto' },
            { clave: 'situacion', titulo: 'Situación' },
            { clave: 'stock', titulo: 'Stock', tipo: 'numero' },
            { clave: 'minimo', titulo: 'Mínimo', tipo: 'numero' },
          ],
          lista: todas.map((a) => ({ producto: a.producto.nombre, situacion: ALERTA[a.tipo], stock: a.producto.stockActual, minimo: a.producto.stockMinimo })),
          totales: { 'Productos con alerta': totales.total },
        }),
        filas: todas.length,
      };
    },
  },

  // 3. Reposición (HU27).
  reposicion: {
    descripcion: 'Qué pedir y cuánto, agrupado por último proveedor',
    async ejecutar(args, ctx) {
      const r = await reposicion(ctx.tx);
      const lista = r.proveedores.flatMap((g) =>
        g.productos.map((p) => ({ proveedor: g.nombre, producto: p.nombre, cantidad: p.cantidad, unidad: UNIDAD[p.unidadMedida], costo: p.costo })),
      );
      const texto =
        r.productos === 0
          ? 'No hay productos para reponer con stock deseado definido.'
          : `Conviene reponer ${r.productos} ${r.productos === 1 ? 'producto' : 'productos'}, con un costo estimado de ${formatoPesos(r.costoEstimado)} al último precio de compra${r.productosSinPrecio ? ` (${r.productosSinPrecio} sin precio)` : ''}.`;
      return {
        texto,
        presentacion: tabla({
          titulo: 'Sugerencia de reposición',
          columnas: [
            { clave: 'proveedor', titulo: 'Proveedor' },
            { clave: 'producto', titulo: 'Producto' },
            { clave: 'cantidad', titulo: 'A pedir', tipo: 'numero' },
            { clave: 'unidad', titulo: 'Unidad' },
            { clave: 'costo', titulo: 'Costo', tipo: 'pesos' },
          ],
          lista,
          totales: { 'Productos a reponer': r.productos, 'Costo estimado (todos)': formatoPesos(r.costoEstimado) },
          nota: r.sinDeseado.length ? `${r.sinDeseado.length} sin stock deseado definido.` : null,
        }),
        filas: lista.length,
      };
    },
  },

  // 4. Salidas (o ventas) de un producto en un período.
  salidas_producto: {
    descripcion: 'Salidas de un producto en un período, por motivo (o solo ventas)',
    async ejecutar(args, ctx) {
      const periodo = conPeriodo(args, 30, ctx);
      const r = await resolverProducto(args, ctx);
      if (!r.producto) return { ...aclaracionProducto(args.producto, r.opciones), periodo };
      const p = r.producto;
      const rango = rangoFechas(periodo.desde, periodo.hasta);
      const filas = await ctx.tx.$queryRaw`
        SELECT m.motivo::text AS motivo, sum(-m.cantidad) AS cantidad, count(*)::int AS movimientos
        FROM movimientos_stock m
        WHERE m.producto_id = ${p.id} AND m.tipo = 'SALIDA' AND m.fecha >= ${rango.gte} AND m.fecha < ${rango.lt}
          ${args.soloVentas ? Prisma.sql`AND m.motivo = 'VENTA'` : Prisma.empty}
        GROUP BY m.motivo ORDER BY sum(-m.cantidad) DESC, m.motivo`;
      const total = filas.reduce((s, f) => s.plus(f.cantidad), new Prisma.Decimal(0)).toNumber();
      const que = args.soloVentas ? 'Ventas' : 'Salidas (todas las causas)';
      const texto = args.soloVentas
        ? `${describirPeriodo(periodo).replace(/^d/, 'D')} se vendieron ${cantidadCon(total, p.unidadMedida)} de ${p.nombre}.`
        : `${describirPeriodo(periodo).replace(/^d/, 'D')} salieron ${cantidadCon(total, p.unidadMedida)} de ${p.nombre} (todas las causas)${filas.length ? `: ${filas.map((f) => `${MOTIVO[f.motivo].toLowerCase()} ${formatoNumero(num(f.cantidad))}`).join(', ')}` : ''}.`;
      return {
        texto,
        presentacion: tabla({
          titulo: `${que} de ${p.nombre} · ${describirPeriodo(periodo)}`,
          columnas: [
            { clave: 'motivo', titulo: 'Motivo' },
            { clave: 'cantidad', titulo: `Cantidad (${UNIDAD[p.unidadMedida]})`, tipo: 'numero' },
            { clave: 'movimientos', titulo: 'Movimientos', tipo: 'numero' },
          ],
          lista: filas.map((f) => ({ motivo: MOTIVO[f.motivo], cantidad: num(f.cantidad), movimientos: f.movimientos })),
          totales: { [args.soloVentas ? 'Total vendido' : 'Total de salidas']: cantidadCon(total, p.unidadMedida) },
        }),
        filas: filas.length,
        productoId: p.id,
        periodo,
      };
    },
  },

  // 5. Productos con más salidas (o más vendidos) en un período.
  mas_salidas: {
    descripcion: 'Ranking de productos por cantidad de salidas (o solo ventas) en un período',
    async ejecutar(args, ctx) {
      const periodo = conPeriodo(args, 30, ctx);
      const rango = rangoFechas(periodo.desde, periodo.hasta);
      const filas = await ctx.tx.$queryRaw`
        SELECT p.id, p.nombre, p.unidad_medida::text AS "unidadMedida", sum(-m.cantidad) AS cantidad
        FROM movimientos_stock m JOIN productos p ON p.id = m.producto_id
        WHERE m.tipo = 'SALIDA' AND m.fecha >= ${rango.gte} AND m.fecha < ${rango.lt}
          ${args.soloVentas ? Prisma.sql`AND m.motivo = 'VENTA'` : Prisma.empty}
        GROUP BY p.id ORDER BY sum(-m.cantidad) DESC, p.nombre, p.id`;
      // Totales del conjunto completo, por unidad (no se suman kilos con unidades).
      const porUnidad = new Map();
      for (const f of filas) porUnidad.set(f.unidadMedida, (porUnidad.get(f.unidadMedida) ?? new Prisma.Decimal(0)).plus(f.cantidad));
      const totalTexto = [...porUnidad].map(([u, c]) => cantidadCon(c.toNumber(), u)).join(' y ') || '0';
      const lista = filas.map((f, i) => ({ puesto: i + 1, producto: f.nombre, cantidad: num(f.cantidad), unidad: UNIDAD[f.unidadMedida] }));
      const que = args.soloVentas ? 'Productos más vendidos' : 'Productos con más salidas (todas las causas)';
      const presentacion = tabla({
        titulo: `${que} · ${describirPeriodo(periodo)}`,
        columnas: [
          { clave: 'puesto', titulo: '#', tipo: 'numero' },
          { clave: 'producto', titulo: 'Producto' },
          { clave: 'cantidad', titulo: args.soloVentas ? 'Vendido' : 'Salidas', tipo: 'numero' },
          { clave: 'unidad', titulo: 'Unidad' },
        ],
        lista,
        limite: args.limite,
        totales: { 'Productos con movimiento': filas.length, [args.soloVentas ? 'Total vendido (todos)' : 'Total de salidas (todos)']: totalTexto },
      });
      const primero = lista[0];
      return {
        texto: primero
          ? `${describirPeriodo(periodo).replace(/^d/, 'D')}, ${args.soloVentas ? 'el más vendido' : 'el producto con más salidas'} fue ${primero.producto} (${formatoNumero(primero.cantidad)} ${primero.unidad}). En total hubo ${filas.length} ${filas.length === 1 ? 'producto' : 'productos'} con ${args.soloVentas ? 'ventas' : 'salidas'}.`
          : `${describirPeriodo(periodo).replace(/^d/, 'D')} no hubo ${args.soloVentas ? 'ventas' : 'salidas'}.`,
        presentacion: { ...presentacion, grafico: 'barras' },
        filas: filas.length,
        periodo,
      };
    },
  },

  // 6. Productos sin ventas (motivo VENTA) en un período.
  sin_ventas: {
    descripcion: 'Productos con stock que no tuvieron ventas en un período',
    async ejecutar(args, ctx) {
      const periodo = conPeriodo(args, 30, ctx);
      const r = await sinMovimiento({ desde: periodo.desde, hasta: periodo.hasta, soloVentas: true }, ctx.tx);
      const lista = r.productos.map((p) => ({
        producto: p.nombre,
        stock: p.stockActual,
        unidad: UNIDAD[p.unidadMedida],
        valor: p.valor,
        ultimaVenta: p.ultimaSalida ? p.ultimaSalida.toISOString().slice(0, 10) : null,
      }));
      return {
        texto:
          lista.length === 0
            ? `${describirPeriodo(periodo).replace(/^d/, 'D')} todos los productos con stock tuvieron ventas.`
            : `${describirPeriodo(periodo).replace(/^d/, 'D')}, ${lista.length} ${lista.length === 1 ? 'producto con stock no tuvo' : 'productos con stock no tuvieron'} ventas (pudieron tener otras salidas, como roturas o consumo interno). Valen ${formatoPesos(r.valorTotal)} a último precio de compra.`,
        presentacion: tabla({
          titulo: `Productos sin ventas · ${describirPeriodo(periodo)}`,
          columnas: [
            { clave: 'producto', titulo: 'Producto' },
            { clave: 'stock', titulo: 'Stock', tipo: 'numero' },
            { clave: 'unidad', titulo: 'Unidad' },
            { clave: 'valor', titulo: 'Valor', tipo: 'pesos' },
            { clave: 'ultimaVenta', titulo: 'Última venta', tipo: 'fecha' },
          ],
          lista,
          totales: { 'Productos sin ventas': lista.length, 'Valor (todos)': formatoPesos(r.valorTotal) },
          nota: 'Solo cuentan las ventas; otras salidas no las excluyen.',
        }),
        filas: lista.length,
        periodo,
      };
    },
  },

  // 7. Evolución del precio de compra de un producto (HU20).
  evolucion_precio: {
    descripcion: 'Evolución del precio de compra de un producto, por proveedor',
    async ejecutar(args, ctx) {
      const periodo = conPeriodo(args, 90, ctx);
      const r = await resolverProducto(args, ctx);
      if (!r.producto) return { ...aclaracionProducto(args.producto, r.opciones), periodo };
      const p = r.producto;
      const datos = await preciosDeProducto(p.id, { desde: periodo.desde, hasta: periodo.hasta }, ctx.tx);
      if (datos.precios === 0) {
        return {
          texto: `No hay precios de compra de ${p.nombre} ${describirPeriodo(periodo)}.`,
          presentacion: { tipo: 'texto', titulo: `Precio de ${p.nombre}` },
          filas: 0,
          productoId: p.id,
          periodo,
        };
      }
      const conProveedor = datos.proveedores.find((pr) => pr.nombre === datos.ultimo.proveedor) ?? datos.proveedores[0];
      const variacion = conProveedor.variacion;
      return {
        texto:
          variacion == null
            ? `${describirPeriodo(periodo).replace(/^d/, 'D')} hay un solo precio de ${p.nombre} con ${conProveedor.nombre}: ${formatoPesos(conProveedor.ultimo.precio)}.`
            : `${describirPeriodo(periodo).replace(/^d/, 'D')}, ${p.nombre} pasó de ${formatoPesos(conProveedor.primero.precio)} a ${formatoPesos(conProveedor.ultimo.precio)} con ${conProveedor.nombre} (${porcentaje(variacion)}).`,
        presentacion: {
          tipo: 'grafico',
          grafico: 'precios',
          titulo: `Precio de compra de ${p.nombre} · ${describirPeriodo(periodo)}`,
          series: datos.proveedores.map((pr) => ({ id: pr.id, nombre: pr.nombre, puntos: pr.puntos })),
          columnas: [
            { clave: 'proveedor', titulo: 'Proveedor' },
            { clave: 'primero', titulo: 'Primer precio', tipo: 'pesos' },
            { clave: 'ultimo', titulo: 'Último precio', tipo: 'pesos' },
            { clave: 'variacion', titulo: 'Variación', tipo: 'porcentaje' },
          ],
          filas: datos.proveedores.map((pr) => ({ proveedor: pr.nombre, primero: pr.primero.precio, ultimo: pr.ultimo.precio, variacion: pr.variacion })),
          totalFilas: datos.proveedores.length,
        },
        filas: datos.precios,
        productoId: p.id,
        periodo,
      };
    },
  },

  // 8. Productos con mayores aumentos de precio (HU20).
  mayores_aumentos: {
    descripcion: 'Productos cuyo precio de compra más aumentó en un período',
    async ejecutar(args, ctx) {
      const periodo = conPeriodo(args, 90, ctx);
      const r = await precios({ desde: periodo.desde, hasta: periodo.hasta }, ctx.tx);
      const minimo = args.minimoPorcentaje;
      const aumentos = r.productos
        .filter((p) => p.variacion != null && p.variacion > 0 && (minimo == null || p.variacion > minimo))
        .sort((a, b) => b.variacion - a.variacion || a.nombre.localeCompare(b.nombre, 'es'));
      const lista = aumentos.map((p) => ({ producto: p.nombre, variacion: p.variacion, ultimo: p.ultimo.precio, proveedor: p.ultimo.proveedor }));
      const criterio = minimo == null ? 'aumentaron' : `aumentaron más del ${formatoNumero(minimo)} %`;
      return {
        texto:
          lista.length === 0
            ? `${describirPeriodo(periodo).replace(/^d/, 'D')} ningún producto ${criterio}.`
            : `${describirPeriodo(periodo).replace(/^d/, 'D')}, ${lista.length} ${lista.length === 1 ? 'producto' : 'productos'} ${criterio}. El mayor aumento fue ${lista[0].producto} (${porcentaje(lista[0].variacion)}).`,
        presentacion: tabla({
          titulo: `Mayores aumentos de precio · ${describirPeriodo(periodo)}`,
          columnas: [
            { clave: 'producto', titulo: 'Producto' },
            { clave: 'variacion', titulo: 'Aumento', tipo: 'porcentaje' },
            { clave: 'ultimo', titulo: 'Último precio', tipo: 'pesos' },
            { clave: 'proveedor', titulo: 'Proveedor' },
          ],
          lista,
          limite: args.limite,
          totales: { 'Productos con aumento': lista.length },
          nota: 'Variación con el proveedor del último precio, entre su primer y su último precio del período.',
        }),
        filas: lista.length,
        periodo,
      };
    },
  },
};
