// HU26: tablero de situación (criterios: muestra alertas activas,
// comprobantes pendientes y valor del stock, y los datos coinciden con los
// registrados). Incluye la prueba determinística de la foto única
// (REPEATABLE READ frente a READ COMMITTED) y una ráfaga complementaria de
// lectores con un escritor.
import { tablero } from '../src/modules/tablero/tablero.service.js';

const PRECIO = 250;
const STOCK_A = 10;

export default async function hu26({ api, check, db, dueño, empleado, base }) {
  const ver = async (token = dueño) => api('GET', '/tablero', { token });
  const ultimoMovimiento = async (productoId) =>
    (await db.movimientoStock.findFirst({ where: { productoId }, orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
  const contar = async (productoId, contado) => {
    const p = await db.producto.findUnique({ where: { id: productoId } });
    const r = await api('POST', '/recuentos', {
      token: dueño,
      cuerpo: { lineas: [{ productoId, contado, stockRegistrado: Number(p.stockActual), ultimoMovimientoId: await ultimoMovimiento(productoId) }] },
    });
    if (![200, 201].includes(r.status)) throw new Error(`recuento ${r.status} ${JSON.stringify(r.body)}`);
  };

  // --- Cálculos propios en SQL para comparar ---
  const esperadoSql = async () => {
    const [stock] = await db.$queryRaw`
      SELECT count(*)::int AS "totalProductos",
             count(*) FILTER (WHERE stock_actual <= 0)::int AS "sinStock",
             count(*) FILTER (WHERE stock_actual > 0 AND stock_minimo > 0 AND stock_actual <= stock_minimo)::int AS "stockBajo",
             count(*) FILTER (WHERE stock_actual > 0 AND NOT (stock_minimo > 0 AND stock_actual <= stock_minimo))::int AS "enStock"
      FROM productos WHERE activo`;
    const alertas = Object.fromEntries(
      (await db.$queryRaw`SELECT tipo::text, count(*)::int AS n FROM alertas_stock WHERE estado = 'ACTIVA' GROUP BY tipo`).map((f) => [f.tipo, f.n]),
    );
    const comprobantes = Object.fromEntries(
      (await db.$queryRaw`SELECT estado::text, count(*)::int AS n FROM comprobantes GROUP BY estado`).map((f) => [f.estado, f.n]),
    );
    const reponer = (
      await db.$queryRaw`
        SELECT id FROM productos WHERE activo AND (stock_actual <= 0 OR (stock_minimo > 0 AND stock_actual <= stock_minimo))
        ORDER BY (stock_actual > 0), nombre, id LIMIT 4`
    ).map((f) => f.id);
    return { stock, alertas, comprobantes, reponer };
  };
  const coincide = async (t, rotulo) => {
    const e = await esperadoSql();
    const a = t.alertas.totales;
    const pend = t.comprobantes.porEstado;
    const valor = (await api('GET', '/reportes/valorizacion', { token: dueño })).body;
    check(
      JSON.stringify(t.stock) === JSON.stringify({ totalProductos: e.stock.totalProductos, enStock: e.stock.enStock, stockBajo: e.stock.stockBajo, sinStock: e.stock.sinStock }),
      `${rotulo}: productos por estado iguales al cálculo SQL (${JSON.stringify(t.stock)})`,
    );
    check(
      a.STOCK_NEGATIVO === (e.alertas.STOCK_NEGATIVO ?? 0) && a.SIN_STOCK === (e.alertas.SIN_STOCK ?? 0) && a.STOCK_BAJO === (e.alertas.STOCK_BAJO ?? 0),
      `${rotulo}: alertas activas por tipo iguales al SQL (${a.total})`,
    );
    check(
      ['PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'ERROR'].every((s) => pend[s] === (e.comprobantes[s] ?? 0)) &&
        t.comprobantes.total === ['PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'ERROR'].reduce((s, x) => s + (e.comprobantes[x] ?? 0), 0),
      `${rotulo}: comprobantes pendientes por estado iguales al SQL (${JSON.stringify(pend)})`,
    );
    check(JSON.stringify(t.reponer.map((p) => p.id)) === JSON.stringify(e.reponer), `${rotulo}: «Para reponer» igual al SQL`);
    check(t.valorStock?.total === valor.total, `${rotulo}: valor del stock igual al de HU28 ($${t.valorStock?.total})`);
  };

  // --- Comprobantes en los cuatro estados pendientes y uno confirmado ---
  const proveedor = (await db.proveedor.findFirst()).id;
  let marca = 0;
  async function cargar() {
    marca += 1;
    const form = new FormData();
    form.append('archivo', new Blob([Buffer.from(`%PDF-1.4\n% SIMULACION=ok tablero-${marca}\n%%EOF\n`, 'latin1')], { type: 'application/pdf' }), `t${marca}.pdf`);
    form.append('proveedorId', String(proveedor));
    const res = await fetch(`${base}/comprobantes`, { method: 'POST', headers: { Authorization: `Bearer ${dueño}` }, body: form });
    return (await res.json()).id;
  }
  async function leer(id) {
    await api('POST', `/comprobantes/${id}/procesar`, { token: dueño });
    for (let i = 0; i < 60; i += 1) {
      if ((await api('GET', `/comprobantes/${id}/estado`, { token: dueño })).body.estado === 'EN_REVISION') return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`el comprobante ${id} no llegó a revisión`);
  }
  await cargar(); // PENDIENTE
  const procesando = await cargar();
  const conError = await cargar();
  // Estados intermedios preparados en la base descartable (la API los deja pasar enseguida).
  await db.comprobante.update({
    where: { id: procesando },
    data: { estado: 'PROCESANDO', iaTrabajoId: crypto.randomUUID(), iaSolicitadoEn: new Date(), iaVigenteHasta: new Date(Date.now() + 86_400_000) },
  });
  await db.comprobante.update({ where: { id: conError }, data: { estado: 'ERROR' } });
  const enRevision = [await cargar(), await cargar()];
  for (const id of enRevision) await leer(id);

  const productoAlternativo = (await db.producto.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } })).id;
  async function confirmar(id) {
    const c = (await api('GET', `/comprobantes/${id}`, { token: dueño })).body;
    for (const d of c.detalles.filter((x) => !x.productoId)) {
      await api('PATCH', `/comprobantes/${id}/detalles/${d.id}`, { token: dueño, cuerpo: { productoId: productoAlternativo } });
    }
    await api('PATCH', `/comprobantes/${id}/cabecera`, { token: dueño, cuerpo: { numero: `0007-${String(id).padStart(8, '0')}`, fechaEmision: '2026-11-10' } });
    return api('POST', `/comprobantes/${id}/confirmar`, { token: dueño });
  }

  // --- Permisos ---
  check((await api('GET', '/tablero')).status === 401, 'sin sesión: 401');
  const delEmpleado = await ver(empleado);
  check(
    delEmpleado.status === 200 && !('valorStock' in delEmpleado.body) && !/precio|valor/i.test(JSON.stringify(delEmpleado.body)),
    'el empleado recibe el tablero sin el valor del stock ni precios',
  );

  // --- Coincidencia con lo registrado ---
  const t1 = await ver();
  check(t1.status === 200 && t1.body.comprobantes.total === 5, `pendientes: PENDIENTE, PROCESANDO, ERROR y 2 en revisión (${t1.body.comprobantes.total})`);
  check(t1.body.comprobantes.enRevision.length === 2 && t1.body.comprobantes.enRevision.every((c) => c.destino === 'REVISAR'), 'los en revisión se listan para retomarlos');
  await coincide(t1.body, 'inicial');

  // --- Cambios: confirmar un comprobante, una salida y un recuento ---
  const confirmado = await confirmar(enRevision[0]);
  check(confirmado.status === 200, `se confirma un comprobante (${confirmado.status} ${confirmado.status === 200 ? '' : JSON.stringify(confirmado.body)})`);
  const leche = await db.producto.findFirst({ where: { nombre: 'Leche entera 1 l' } });
  await api('POST', '/salidas', { token: empleado, cuerpo: { lineas: [{ productoId: leche.id, cantidad: 1 }] } });
  const agua = await db.producto.findFirst({ where: { nombre: 'Agua sin gas 1,5 l' } });
  await contar(agua.id, 0);
  const t2 = (await ver()).body;
  check(t2.comprobantes.porEstado.EN_REVISION === 1 && t2.comprobantes.total === 4, 'después de confirmar, un pendiente menos');
  // (El total por tipo puede compensarse: el comprobante confirmado repone la yerba, que estaba sin stock.)
  check(
    t2.alertas.principales.some((a) => a.producto.id === agua.id && a.tipo === 'SIN_STOCK') &&
      t2.reponer.some((p) => p.id === agua.id),
    'el recuento a 0 abre la alerta sin stock del agua y la pasa a «Para reponer»',
  );
  await coincide(t2, 'después de los cambios');

  // --- Foto única, determinística ---
  // Producto de prueba con precio: A = stock 10 (sin alerta, valor 10 × p);
  // B = stock 0 (alerta SIN_STOCK, valor 0).
  const prueba = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre: 'Tablero prueba', stockMinimo: 0 } })).body;
  await db.precioCompra.create({ data: { productoId: prueba.id, proveedorId: proveedor, precioUnitario: PRECIO, fechaVigencia: new Date('2026-11-01') } });
  await contar(prueba.id, STOCK_A);
  const usuario = { rol: 'PROPIETARIO' };
  const sinFecha = (t) => JSON.stringify({ ...t, generadoEn: undefined });
  const fotoA = await tablero(usuario, db);
  const invariante = (t) =>
    t.stock.sinStock === t.alertas.totales.SIN_STOCK + t.alertas.totales.STOCK_NEGATIVO && t.stock.stockBajo === t.alertas.totales.STOCK_BAJO;
  check(invariante(fotoA), 'estado A: el resumen de stock coincide con las alertas');

  const conRepeatable = await tablero(usuario, db, { entreLecturas: () => contar(prueba.id, 0) });
  check(sinFecha(conRepeatable) === sinFecha(fotoA), 'REPEATABLE READ: con un recuento confirmado entre lecturas, todo el tablero corresponde a la foto inicial (A)');
  const despues = await tablero(usuario, db);
  check(
    despues.alertas.totales.SIN_STOCK === fotoA.alertas.totales.SIN_STOCK + 1 && despues.valorStock.total === fotoA.valorStock.total - STOCK_A * PRECIO && invariante(despues),
    'una lectura nueva ya ve el estado B',
  );

  await contar(prueba.id, STOCK_A);
  const conReadCommitted = await tablero(usuario, db, { aislamiento: 'ReadCommitted', entreLecturas: () => contar(prueba.id, 0) });
  const mezclado =
    JSON.stringify(conReadCommitted.stock) === JSON.stringify(fotoA.stock) &&
    conReadCommitted.alertas.totales.SIN_STOCK === fotoA.alertas.totales.SIN_STOCK + 1 &&
    conReadCommitted.valorStock.total === fotoA.valorStock.total - STOCK_A * PRECIO &&
    !invariante(conReadCommitted);
  check(mezclado, 'READ COMMITTED (variante de control): el mismo procedimiento mezcla estados (resumen en A, alertas y valor en B)');

  // --- Complementaria: ráfaga de lectores con un escritor ---
  await contar(prueba.id, STOCK_A);
  const valorA = fotoA.valorStock.total;
  const sinA = fotoA.alertas.totales.SIN_STOCK;
  let seguir = true;
  let cambios = 0;
  const escritor = (async () => {
    while (seguir) {
      await contar(prueba.id, 0);
      await contar(prueba.id, STOCK_A);
      cambios += 2;
    }
  })();
  const fin = Date.now() + 4000;
  const vistos = { A: 0, B: 0, mezclados: 0 };
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (Date.now() < fin) {
        const t = (await ver()).body;
        const enB = t.alertas.totales.SIN_STOCK === sinA + 1;
        const valorOk = t.valorStock.total === (enB ? valorA - STOCK_A * PRECIO : valorA);
        const enStockOk = t.stock.sinStock === (enB ? fotoA.stock.sinStock + 1 : fotoA.stock.sinStock);
        if (invariante(t) && valorOk && enStockOk) vistos[enB ? 'B' : 'A'] += 1;
        else vistos.mezclados += 1;
      }
    }),
  );
  seguir = false;
  await escritor;
  check(
    vistos.mezclados === 0 && vistos.A > 0 && vistos.B > 0,
    `ráfaga: ${vistos.A + vistos.B + vistos.mezclados} lecturas del endpoint con ${cambios} recuentos; ${vistos.A} en A, ${vistos.B} en B, ${vistos.mezclados} mezcladas`,
  );
}
