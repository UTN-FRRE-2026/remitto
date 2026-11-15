// HU24: alertas de stock (criterios: como máximo una alerta activa por
// producto y tipo, la alerta se resuelve sola al recuperarse el stock y las
// salidas del endpoint también generan alertas).
import { tipoAlerta } from '../src/modules/alertas/alertas.service.js';

export default async function hu24({ api, check, db, dueño, empleado }) {
  const activasDe = (productoId) =>
    db.alertaStock.findMany({ where: { productoId, estado: 'ACTIVA' }, orderBy: { id: 'asc' } });
  const tiposActivos = async (productoId) => (await activasDe(productoId)).map((a) => a.tipo).join(',');
  const ultimoMovimiento = async (productoId) =>
    (await db.movimientoStock.findFirst({ where: { productoId }, orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
  const contar = async (productoId, contado) => {
    const p = await db.producto.findUnique({ where: { id: productoId } });
    return api('POST', '/recuentos', {
      token: dueño,
      cuerpo: {
        lineas: [{ productoId, contado, stockRegistrado: Number(p.stockActual), ultimoMovimientoId: await ultimoMovimiento(productoId) }],
      },
    });
  };
  const sacar = (productoId, cantidad) => api('POST', '/salidas', { token: empleado, cuerpo: { lineas: [{ productoId, cantidad }] } });

  // --- Permisos ---
  check((await api('GET', '/alertas')).status === 401, 'sin sesión: 401');
  const delEmpleado = await api('GET', '/alertas', { token: empleado });
  check(delEmpleado.status === 200, 'el empleado ve las alertas');

  // --- Datos del seed: coinciden con los indicadores del tablero ---
  const inicial = await api('GET', '/alertas', { token: dueño });
  const resumen = (await api('GET', '/productos/resumen', { token: dueño })).body;
  const t = inicial.body.totales;
  check(
    inicial.status === 200 && t.STOCK_BAJO === resumen.stockBajo && t.SIN_STOCK + t.STOCK_NEGATIVO === resumen.sinStock,
    `las alertas del seed coinciden con el tablero (bajo ${t.STOCK_BAJO}/${resumen.stockBajo}, sin stock ${t.SIN_STOCK + t.STOCK_NEGATIVO}/${resumen.sinStock})`,
  );
  const nombres = inicial.body.activas.map((a) => a.producto.nombre);
  check(
    nombres.includes('Pan lactal grande') && nombres.includes('Leche entera 1 l') && nombres.indexOf('Pan lactal grande') < nombres.indexOf('Leche entera 1 l'),
    'sin stock se lista antes que stock bajo',
  );
  const leche = inicial.body.activas.find((a) => a.producto.nombre === 'Leche entera 1 l');
  check(
    leche?.tipo === 'STOCK_BAJO' && leche.producto.stockActual === 3 && leche.producto.stockMinimo === 12 && leche.producto.categoria === 'Lácteos',
    'la alerta trae el producto con su stock, mínimo y categoría',
  );

  // --- Ciclo de vida con el carrito y el recuento ---
  const prod = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre: 'Fideos HU24', stockMinimo: 5, codigoBarras: '7790024000001' } })).body;
  check((await tiposActivos(prod.id)) === 'SIN_STOCK', 'un producto nuevo abre su alerta de sin stock');
  await contar(prod.id, 10);
  check((await tiposActivos(prod.id)) === '', 'criterio: con el recuento a 10 la alerta se resuelve sola');
  const resuelta = await db.alertaStock.findFirst({ where: { productoId: prod.id, tipo: 'SIN_STOCK' } });
  check(resuelta.estado === 'RESUELTA' && resuelta.resueltaEn instanceof Date, 'queda resuelta con su fecha (historia)');
  await sacar(prod.id, 3);
  check((await tiposActivos(prod.id)) === '', 'con 7 (mínimo 5) no hay alerta');
  await sacar(prod.id, 2);
  const baja = await activasDe(prod.id);
  check(baja.length === 1 && baja[0].tipo === 'STOCK_BAJO' && Number(baja[0].stockAlGenerar) === 5, 'en el mínimo (5) se abre stock bajo con el stock del momento');
  await sacar(prod.id, 1);
  check((await activasDe(prod.id)).length === 1 && (await activasDe(prod.id))[0].id === baja[0].id, 'otra salida sin cambiar de situación no abre otra alerta');
  await sacar(prod.id, 4);
  check((await tiposActivos(prod.id)) === 'SIN_STOCK', 'al llegar a 0 pasa a sin stock (la de stock bajo se resuelve)');

  // --- Criterio: las salidas del endpoint también generan alertas ---
  const clave = (await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: 'Caja HU24' } })).body.clave;
  const vender = (referencia, cantidad, productoId = prod.id) =>
    api('POST', '/v1/integracion/salidas', {
      cuerpo: { referencia, lineas: [{ productoId, cantidad }] },
      headers: { Authorization: `Bearer ${clave}` },
    });
  check((await vender('HU24-1', 2)).status === 201, 'venta del endpoint con el producto en 0');
  check((await tiposActivos(prod.id)) === 'STOCK_NEGATIVO', 'criterio: la venta del endpoint abre la alerta de stock negativo');
  const reenvio = await vender('HU24-1', 2);
  check(reenvio.status === 200 && (await activasDe(prod.id)).length === 1, 'el reenvío no descuenta ni abre otra alerta');
  await contar(prod.id, 20);
  check((await tiposActivos(prod.id)) === '', 'el recuento a 20 resuelve la alerta de stock negativo');
  const historia = await db.alertaStock.findMany({ where: { productoId: prod.id }, orderBy: { id: 'asc' } });
  check(
    historia.map((a) => `${a.tipo}:${a.estado}`).join(' ') === 'SIN_STOCK:RESUELTA STOCK_BAJO:RESUELTA SIN_STOCK:RESUELTA STOCK_NEGATIVO:RESUELTA',
    'la historia del producto registra cada situación una vez',
  );
  const listado = (await api('GET', '/alertas', { token: dueño })).body;
  check(listado.resueltas.length > 0 && listado.resueltas[0].producto.id === prod.id, 'el listado muestra las últimas resueltas, la más reciente primero');

  // --- Catálogo: mínimo, desactivación y reactivación ---
  await api('PATCH', `/productos/${prod.id}`, { token: dueño, cuerpo: { stockMinimo: 25 } });
  check((await tiposActivos(prod.id)) === 'STOCK_BAJO', 'subir el mínimo por encima del stock abre stock bajo');
  await api('PATCH', `/productos/${prod.id}`, { token: dueño, cuerpo: { stockMinimo: 0 } });
  check((await tiposActivos(prod.id)) === '', 'bajar el mínimo la resuelve');
  await sacar(prod.id, 20);
  check((await tiposActivos(prod.id)) === 'SIN_STOCK', 'sin stock aunque no tenga mínimo (como el tablero)');
  await api('DELETE', `/productos/${prod.id}`, { token: dueño });
  check((await tiposActivos(prod.id)) === '', 'desactivar el producto resuelve su alerta');
  await api('PATCH', `/productos/${prod.id}`, { token: dueño, cuerpo: { activo: true } });
  check((await tiposActivos(prod.id)) === 'SIN_STOCK', 'al reactivarlo la alerta vuelve a abrirse');
  const empleadoEdita = await api('PATCH', `/productos/${prod.id}`, { token: empleado, cuerpo: { stockMinimo: 99 } });
  check(empleadoEdita.status === 403 && (await tiposActivos(prod.id)) === 'SIN_STOCK', 'el empleado no cambia el mínimo (403) ni las alertas');

  // --- Concurrencia: 30 ventas simultáneas del endpoint y 10 del carrito ---
  const otro = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre: 'Arroz HU24', stockMinimo: 15 } })).body;
  await contar(otro.id, 20);
  const previa = (await db.alertaStock.aggregate({ _max: { id: true } }))._max.id ?? 0;
  const respuestas = await Promise.all([
    ...Array.from({ length: 30 }, (_, i) => vender(`HU24-C${i}`, 1, otro.id)),
    ...Array.from({ length: 10 }, () => api('POST', '/salidas', { token: dueño, cuerpo: { lineas: [{ productoId: otro.id, cantidad: 1 }] } })),
  ]);
  const ventasOk = respuestas.slice(0, 30).filter((r) => r.status === 201).length;
  const carritoOk = respuestas.slice(30).filter((r) => r.status === 201).length;
  const final = Number((await db.producto.findUnique({ where: { id: otro.id } })).stockActual);
  check(ventasOk === 30 && final === 20 - 30 - carritoOk, `40 salidas simultáneas: stock ${final} (30 del endpoint y ${carritoOk} del carrito)`);
  check((await tiposActivos(otro.id)) === 'STOCK_NEGATIVO', 'después de las salidas simultáneas queda una sola alerta, la de stock negativo');
  // El stock baja de a 1 desde 20: pasa una vez por el mínimo, una por 0 y queda negativo.
  const durante = await db.alertaStock.findMany({ where: { productoId: otro.id, id: { gt: previa } }, orderBy: { id: 'asc' } });
  check(
    durante.map((a) => a.tipo).join(' ') === 'STOCK_BAJO SIN_STOCK STOCK_NEGATIVO',
    `cada situación atravesada se registró una sola vez (${durante.map((a) => a.tipo).join(' ')})`,
  );

  // --- La base respalda el criterio ---
  let rechazo = false;
  try {
    await db.alertaStock.create({ data: { productoId: otro.id, tipo: 'STOCK_NEGATIVO', stockAlGenerar: -1 } });
  } catch (e) {
    rechazo = e.code === 'P2002';
  }
  check(rechazo, 'criterio: la base rechaza una segunda alerta activa del mismo producto y tipo (uq_alerta_activa)');

  const duplicadas = await db.$queryRaw`
    SELECT producto_id, tipo, count(*)::int AS n FROM alertas_stock WHERE estado = 'ACTIVA' GROUP BY 1, 2 HAVING count(*) > 1`;
  check(duplicadas.length === 0, 'ningún producto tiene dos alertas activas del mismo tipo');

  // --- Invariante final: las alertas activas reflejan el stock de cada producto ---
  const productos = await db.producto.findMany({ include: { alertas: { where: { estado: 'ACTIVA' } } } });
  const desajustes = productos.filter((p) => {
    const esperado = tipoAlerta(p.stockActual, p.stockMinimo, p.activo);
    return p.alertas.map((a) => a.tipo).join(',') !== (esperado ?? '');
  });
  check(desajustes.length === 0, `las alertas activas coinciden con el stock de los ${productos.length} productos`);
  const descuadre = await db.$queryRaw`
    SELECT p.id FROM productos p LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)`;
  check(descuadre.length === 0, 'el stock sigue igual a la suma de movimientos');
}
