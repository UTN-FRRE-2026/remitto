// HU25: asistente de consultas, con la IA simulada (criterios: responde los
// ocho tipos de preguntas, accede a los datos solo mediante las herramientas
// habilitadas y cada consulta queda registrada). Cada respuesta se compara
// con una fuente independiente (SQL propio o los reportes existentes).

const DESFASE = '-03:00';
const inicioDia = (dia) => new Date(`${dia}T00:00:00${DESFASE}`);
const hoyAr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const restar = (dia, n) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const siguiente = (dia) => restar(dia, -1);

export default async function hu25({ api, check, db, dueño, empleado }) {
  const preguntar = (pregunta, token = dueño) => api('POST', '/asistente/consultas', { token, cuerpo: { pregunta } });
  const elegir = (id, productoId) => api('POST', `/asistente/consultas/${id}/eleccion`, { token: dueño, cuerpo: { productoId } });
  const registros = () => db.consultaAgente.count();
  const ultimoMovimiento = async (productoId) =>
    (await db.movimientoStock.findFirst({ where: { productoId }, orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
  const fijarStock = async (productoId, contado) => {
    const p = await db.producto.findUnique({ where: { id: productoId } });
    await api('POST', '/recuentos', {
      token: dueño,
      cuerpo: { lineas: [{ productoId, contado, stockRegistrado: Number(p.stockActual), ultimoMovimientoId: await ultimoMovimiento(productoId) }] },
    });
  };
  const crear = async (nombre, stock) => {
    const p = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre } })).body;
    if (stock) await fijarStock(p.id, stock);
    return p;
  };
  const sacar = (lineas, motivo = 'VENTA') => api('POST', '/salidas', { token: empleado, cuerpo: { motivo, lineas } });
  const proveedor = (await db.proveedor.findFirst()).id;
  const precio = (productoId, precioUnitario, fecha) =>
    db.precioCompra.create({ data: { productoId, proveedorId: proveedor, precioUnitario, fechaVigencia: new Date(`${fecha}T00:00:00Z`) } });
  const hoy = hoyAr();

  // --- Datos de prueba ---
  const gaseosa = await db.producto.findFirst({ where: { nombre: 'Gaseosa cola 500 ml' } });
  const yerbaConPalo = await db.producto.findFirst({ where: { nombre: 'Yerba mate con palo 1 kg' } });
  const yerbaSinPalo = await crear('Yerba mate sin palo 500 g', 20);
  const soloRoturas = await crear('Fideos solo roturas', 10);
  await sacar([{ productoId: gaseosa.id, cantidad: 5 }]);
  await sacar([{ productoId: gaseosa.id, cantidad: 2 }], 'ROTURA');
  await sacar([{ productoId: soloRoturas.id, cantidad: 1 }], 'ROTURA');
  // 25 productos vendidos este mes (más de 20 resultados).
  const muchos = [];
  for (let i = 1; i <= 25; i += 1) muchos.push(await crear(`Ranking ${String(i).padStart(2, '0')}`, 100));
  await sacar(muchos.map((p, i) => ({ productoId: p.id, cantidad: 30 - i })));
  // Ventas de octubre: tres productos con movimientos fechados en octubre.
  const octubre = [await crear('Octubre A', 50), await crear('Octubre B', 50), await crear('Octubre C', 50)];
  await sacar(octubre.map((p, i) => ({ productoId: p.id, cantidad: 3 + i })));
  await db.movimientoStock.updateMany({ where: { productoId: { in: octubre.map((p) => p.id) }, tipo: 'SALIDA' }, data: { fecha: new Date('2026-10-15T15:00:00Z') } });
  // Precios de compra.
  await precio(gaseosa.id, 500, restar(hoy, 60));
  await precio(gaseosa.id, 620, restar(hoy, 5));
  await precio(yerbaSinPalo.id, 1000, '2026-10-05');
  await precio(yerbaSinPalo.id, 1100, '2026-10-25');
  await precio(yerbaConPalo.id, 2000, '2026-10-10');

  // --- Permisos ---
  const antes = await registros();
  check((await api('POST', '/asistente/consultas', { cuerpo: { pregunta: '¿Qué me falta?' } })).status === 401, 'sin sesión: 401');
  check((await preguntar('¿Qué me falta?', empleado)).status === 403, 'el empleado no usa el asistente (403)');
  check((await api('GET', '/asistente/consultas', { token: empleado })).status === 403, 'el empleado no ve el historial (403)');
  check((await preguntar('   ')).status === 400 && (await preguntar('x'.repeat(501))).status === 400, 'pregunta vacía o de más de 500 caracteres: 400');
  check((await registros()) === antes, 'los pedidos rechazados no se registran');

  const rangoSql = (desde, hasta) => [inicioDia(desde), inicioDia(siguiente(hasta))];
  const filasDe = (r) => r.body.presentacion?.filas ?? [];

  // 1. Stock de un producto.
  const r1 = await preguntar('¿Cuánta gaseosa cola me queda?');
  const stockGaseosa = Number((await db.producto.findUnique({ where: { id: gaseosa.id } })).stockActual);
  check(r1.status === 200 && filasDe(r1)[0]?.stock === stockGaseosa, `1 stock: ${filasDe(r1)[0]?.stock} igual a la base (${stockGaseosa})`);

  // 2. Faltantes y alertas.
  const r2 = await preguntar('¿Qué me está faltando?');
  const alertas = (await api('GET', '/alertas', { token: dueño })).body;
  check(
    r2.body.presentacion?.totalFilas === alertas.totales.total &&
      JSON.stringify(filasDe(r2).map((f) => f.producto)) === JSON.stringify(alertas.activas.slice(0, 20).map((a) => a.producto.nombre)),
    `2 faltantes: ${alertas.totales.total} alertas, en el mismo orden que /alertas`,
  );

  // 3. Reposición.
  const r3 = await preguntar('¿Qué tengo que reponer?');
  const repo = (await api('GET', '/reportes/reposicion', { token: dueño })).body;
  check(
    r3.body.presentacion?.totales['Productos a reponer'] === repo.productos &&
      r3.body.presentacion.totales['Costo estimado (todos)'] === `$ ${repo.costoEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `3 reposición: ${repo.productos} productos y el costo igual a /reportes/reposicion`,
  );

  // 4. Salidas de un producto: todas las causas frente a solo ventas.
  const r4 = await preguntar('¿Cuánta gaseosa cola salió esta semana?');
  const r4v = await preguntar('¿Cuánta gaseosa cola vendí esta semana?');
  const desde4 = r4.body.presentacion?.titulo?.match(/del (\d\d)\/(\d\d)\/(\d{4})/);
  const [d4, h4] = rangoSql(`${desde4[3]}-${desde4[2]}-${desde4[1]}`, hoy);
  const [{ total, ventas }] = await db.$queryRaw`
    SELECT coalesce(sum(-cantidad), 0)::float AS total, coalesce(sum(-cantidad) FILTER (WHERE motivo = 'VENTA'), 0)::float AS ventas
    FROM movimientos_stock WHERE producto_id = ${gaseosa.id} AND tipo = 'SALIDA' AND fecha >= ${d4} AND fecha < ${h4}`;
  check(
    r4.body.presentacion.totales['Total de salidas'] === `${total} u.` && /todas las causas/.test(r4.body.presentacion.titulo),
    `4 salidas de la gaseosa esta semana: ${total} (todas las causas)`,
  );
  check(r4v.body.presentacion?.totales['Total vendido'] === `${ventas} u.` && /^Ventas/.test(r4v.body.presentacion.titulo), `4 solo ventas: ${ventas} (sin la rotura)`);

  // 5. Productos con más salidas (más vendidos): más de 20 resultados.
  const r5 = await preguntar('¿Cuáles fueron los 20 más vendidos este mes?');
  const [d5, h5] = rangoSql(`${hoy.slice(0, 7)}-01`, hoy);
  const ranking = await db.$queryRaw`
    SELECT p.unidad_medida::text AS unidad, sum(-m.cantidad)::float AS cantidad
    FROM movimientos_stock m JOIN productos p ON p.id = m.producto_id
    WHERE m.tipo = 'SALIDA' AND m.motivo = 'VENTA' AND m.fecha >= ${d5} AND m.fecha < ${h5}
    GROUP BY p.id ORDER BY sum(-m.cantidad) DESC, p.nombre, p.id`;
  // Total del conjunto completo, por unidad (kilos y unidades no se suman).
  const ABREV = { UNIDAD: 'u.', KILOGRAMO: 'kg', GRAMO: 'g', LITRO: 'l', MILILITRO: 'ml', METRO: 'm', PAQUETE: 'paq.' };
  const porUnidad = new Map();
  for (const f of ranking) porUnidad.set(f.unidad, Math.round(((porUnidad.get(f.unidad) ?? 0) + f.cantidad) * 1000) / 1000);
  const totalRanking = [...porUnidad].map(([u, c]) => `${c.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${ABREV[u]}`).join(' y ');
  check(
    filasDe(r5).length === 20 && r5.body.presentacion.totalFilas === ranking.length && /Se muestran 20 de/.test(r5.body.presentacion.nota),
    `5 ranking: muestra 20 de ${ranking.length} e informa el total`,
  );
  check(
    r5.body.presentacion.totales['Total vendido (todos)'] === totalRanking && filasDe(r5)[0].cantidad === ranking[0].cantidad,
    `5 el total (${totalRanking}) es del conjunto completo y el primero coincide`,
  );

  // 6. Sin ventas: un producto con roturas pero sin ventas aparece; en HU29 (sin salidas) no.
  const r6 = await preguntar('¿Qué no se vendió este mes?');
  const sinSalidas = (await api('GET', '/reportes/sin-movimiento', { token: dueño })).body;
  const nombres6 = filasDe(r6).map((f) => f.producto);
  check(
    nombres6.includes('Fideos solo roturas') && !sinSalidas.productos.some((p) => p.nombre === 'Fideos solo roturas'),
    '6 sin ventas: «Fideos solo roturas» aparece (solo tuvo roturas) y en HU29 (sin salidas) no',
  );
  check(!nombres6.includes('Gaseosa cola 500 ml') && /pudieron tener otras salidas/.test(r6.body.respuesta), '6 la gaseosa vendida no aparece y el texto aclara el criterio');

  // 7. Evolución del precio de un producto.
  const r7 = await preguntar('¿Cuánto me aumentó la gaseosa cola en los últimos tres meses?');
  const evolucion = (await api('GET', `/reportes/precios/${gaseosa.id}?desde=${restar(hoy, 89)}&hasta=${hoy}`, { token: dueño })).body;
  check(
    r7.body.presentacion?.tipo === 'grafico' &&
      JSON.stringify(r7.body.presentacion.series.map((s) => s.puntos)) === JSON.stringify(evolucion.proveedores.map((p) => p.puntos)) &&
      r7.body.presentacion.filas[0].variacion === evolucion.proveedores[0].variacion,
    `7 evolución del precio: gráfico igual a /reportes/precios/:id (${evolucion.proveedores[0]?.variacion} %)`,
  );

  // 8. Mayores aumentos.
  const r8 = await preguntar('¿Qué otros productos me aumentaron más del 15 % este trimestre?');
  const preciosPeriodo = (await api('GET', `/reportes/precios?desde=${restar(hoy, 89)}&hasta=${hoy}`, { token: dueño })).body;
  const esperados = preciosPeriodo.productos.filter((p) => p.variacion > 15).map((p) => p.nombre);
  check(
    JSON.stringify(filasDe(r8).map((f) => f.producto)) === JSON.stringify(esperados) && esperados.includes('Gaseosa cola 500 ml'),
    `8 mayores aumentos: ${esperados.join(', ')} (igual a /reportes/precios filtrado)`,
  );

  // --- Período nombrado: exactamente octubre ---
  const r9 = await preguntar('¿Qué fue lo más vendido en octubre?');
  const [d9, h9] = rangoSql('2026-10-01', '2026-10-31');
  const enOctubre = await db.$queryRaw`
    SELECT p.nombre, sum(-m.cantidad)::float AS cantidad FROM movimientos_stock m JOIN productos p ON p.id = m.producto_id
    WHERE m.tipo = 'SALIDA' AND m.motivo = 'VENTA' AND m.fecha >= ${d9} AND m.fecha < ${h9}
    GROUP BY p.id ORDER BY sum(-m.cantidad) DESC, p.nombre`;
  check(
    /del 01\/10\/2026 al 31\/10\/2026/.test(r9.body.presentacion?.titulo) &&
      JSON.stringify(filasDe(r9).map((f) => [f.producto, f.cantidad])) === JSON.stringify(enOctubre.map((f) => [f.nombre, f.cantidad])),
    `período nombrado: «en octubre» consulta exactamente octubre (${enOctubre.map((f) => f.nombre).join(', ')})`,
  );

  // --- Aclaración: dos yerbas; la elección conserva la herramienta y el período ---
  const r10 = await preguntar('¿Cuánto me aumentó la yerba mate en octubre?');
  const opciones = r10.body.opciones ?? [];
  check(
    r10.body.accion === 'aclaracion' && opciones.length === 2 && opciones.some((o) => o.id === yerbaSinPalo.id),
    'aclaración: «la yerba mate» con dos yerbas mate pide elegir entre las dos',
  );
  const ajeno = await elegir(r10.body.id, gaseosa.id);
  check(ajeno.status === 400, 'elegir un producto que no estaba entre las opciones: 400');
  const elegida = await elegir(r10.body.id, yerbaSinPalo.id);
  check(
    elegida.status === 200 && elegida.body.presentacion?.tipo === 'grafico' && /del 01\/10\/2026 al 31\/10\/2026/.test(elegida.body.presentacion.titulo),
    'la elección responde con la misma herramienta (evolución del precio) y el mismo período de octubre',
  );
  const regElegida = await db.consultaAgente.findUnique({ where: { id: elegida.body.id } });
  check(
    regElegida.herramientas.aclaracionDe === r10.body.id && regElegida.herramientas.planificador.intentos.length === 0 && regElegida.herramientas.herramienta.nombre === 'evolucion_precio',
    'la elección se registra vinculada a la consulta original, sin llamar al modelo',
  );
  check((await elegir(r10.body.id, yerbaSinPalo.id)).status === 409, 'una segunda elección: 409');

  // --- Fallas registradas como fallidas ---
  const fallas = [
    ['SIMULACION=error ¿qué me falta?', 'PROVEEDOR'],
    ['SIMULACION=json_invalido ¿qué me falta?', 'RESPUESTA_INVALIDA'],
    ['SIMULACION=herramienta_ajena ¿qué me falta?', 'HERRAMIENTA_NO_HABILITADA'],
    ['SIMULACION=argumentos_invalidos ¿qué me falta?', 'ARGUMENTOS_INVALIDOS'],
  ];
  for (const [pregunta, codigo] of fallas) {
    const r = await preguntar(pregunta);
    const reg = await db.consultaAgente.findUnique({ where: { id: r.body.id } });
    check(r.body.accion === 'error' && reg.exitosa === false && reg.herramientas.error === codigo && reg.duracionMs > 0, `falla ${codigo}: mensaje claro y registrada como fallida`);
  }
  const ajena = await db.consultaAgente.findFirst({ where: { pregunta: { contains: 'herramienta_ajena' } } });
  check(ajena.herramientas.herramienta.rechazada === true && ajena.herramientas.herramienta.nombre === 'borrar_productos', 'la herramienta no habilitada queda registrada como rechazada');
  const lenta = await preguntar('SIMULACION=lento ¿qué me falta?');
  const regLenta = await db.consultaAgente.findUnique({ where: { id: lenta.body.id } });
  check(lenta.body.accion === 'error' && regLenta.herramientas.error === 'TIEMPO' && regLenta.duracionMs >= 29_000, `tiempo agotado: se corta a los 30 s (${regLenta.duracionMs} ms) y se registra`);

  // --- Fuera de alcance ---
  const r11 = await preguntar('¿Va a llover mañana?');
  check(r11.body.accion === 'fuera_de_alcance' && /Puedo responder sobre/.test(r11.body.respuesta), 'fuera de alcance: dice qué se puede consultar');

  // --- Registro de todas las consultas ---
  const todas = await db.consultaAgente.findMany({ orderBy: { id: 'asc' } });
  check(
    todas.length === (await registros()) && todas.every((c) => c.usuarioId && c.pregunta && c.herramientas && c.duracionMs > 0),
    `registro: ${todas.length} consultas con pregunta, herramientas y duración (${todas.filter((c) => c.exitosa).length} exitosas, ${todas.filter((c) => !c.exitosa).length} fallidas)`,
  );
  const historial = await api('GET', '/asistente/consultas?limite=5', { token: dueño });
  check(historial.status === 200 && historial.body.length === 5 && historial.body[0].id === todas[todas.length - 1].id, 'historial: las más recientes primero');
}
