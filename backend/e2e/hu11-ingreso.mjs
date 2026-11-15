// HU8 a HU11: el flujo central de ingreso, con la IA simulada. Cargar el
// comprobante, leerlo, revisarlo (corregir, descartar, asociar) y confirmar.
// Criterios de HU11: el stock sube con cada línea confirmada, todo o nada si
// algo falla, y confirmar dos veces (o a la vez) no duplica las entradas.
export default async function hu11({ api, check, db, dueño, empleado, base }) {
  const proveedor = (await db.proveedor.findFirst({ orderBy: { id: 'asc' } })).id;
  let marca = 0;
  const subir = async ({ contenido, tipo = 'application/pdf', nombre, token = empleado } = {}) => {
    marca += 1;
    const form = new FormData();
    const cuerpo = contenido ?? `%PDF-1.4\n% SIMULACION=ok ingreso-${marca}\n%%EOF\n`;
    form.append('archivo', new Blob([Buffer.from(cuerpo, 'latin1')], { type: tipo }), nombre ?? `ingreso-${marca}.pdf`);
    form.append('proveedorId', String(proveedor));
    const res = await fetch(`${base}/comprobantes`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const leer = async (id) => {
    await api('POST', `/comprobantes/${id}/procesar`, { token: empleado });
    for (let i = 0; i < 60; i += 1) {
      const estado = (await api('GET', `/comprobantes/${id}/estado`, { token: empleado })).body.estado;
      if (estado === 'EN_REVISION') return estado;
      await new Promise((r) => setTimeout(r, 150));
    }
    return 'SIN_LECTURA';
  };
  const stock = async (id) => Number((await db.producto.findUnique({ where: { id } })).stockActual);
  const prod = (prefijo) => db.producto.findFirst({ where: { nombre: { startsWith: prefijo } } });
  const gaseosa = await prod('Gaseosa cola');
  const yerba = await prod('Yerba mate con palo');
  const galletita = await prod('Galletitas');

  // --- HU8: carga ---
  check((await subir({ contenido: 'hola', tipo: 'text/plain', nombre: 'nota.txt' })).status === 400, 'HU8: un formato no admitido da 400');
  check((await subir({ tipo: 'image/png', nombre: 'foto.png' })).status === 400, 'HU8: un PDF con nombre y tipo de imagen da 400 (extensión, tipo y contenido tienen que coincidir)');
  const cargado = await subir();
  check(cargado.status === 201 && cargado.body.estado === 'PENDIENTE', 'HU8: el empleado carga el comprobante y queda PENDIENTE');
  const id = cargado.body.id;

  // --- HU9: lectura ---
  const antes = { gaseosa: await stock(gaseosa.id), yerba: await stock(yerba.id), galletita: await stock(galletita.id) };
  check((await leer(id)) === 'EN_REVISION', 'HU9: la lectura deja el comprobante en revisión');
  let c = (await api('GET', `/comprobantes/${id}`, { token: empleado })).body;
  check(c.detalles.length === 3 && Number(c.totalDeclarado) === 72000, `HU9: se leen las 3 líneas y el total impreso (${c.detalles.length} líneas, número ${c.numero}, total ${c.totalDeclarado})`);
  check((await stock(gaseosa.id)) === antes.gaseosa, 'HU10: leer no cambia el stock (la lectura es solo una propuesta)');

  // --- HU10: revisión ---
  const [l1, l2, l3] = c.detalles.sort((a, b) => a.nroLinea - b.nroLinea);
  await api('PATCH', `/comprobantes/${id}/detalles/${l1.id}`, { token: empleado, cuerpo: { productoId: gaseosa.id, cantidad: 40 } });
  await api('PATCH', `/comprobantes/${id}/detalles/${l2.id}`, { token: empleado, cuerpo: { productoId: yerba.id } });
  await api('PATCH', `/comprobantes/${id}/detalles/${l3.id}`, { token: empleado, cuerpo: { descartada: true } });
  const fila1 = await db.detalleComprobante.findUnique({ where: { id: l1.id } });
  check(Number(fila1.cantidad) === 40 && Number(fila1.cantidadExtraida) === 36, 'HU10: la corrección (40) se guarda aparte de lo leído (36)');
  await api('PATCH', `/comprobantes/${id}/cabecera`, { token: empleado, cuerpo: { numero: '0001-00099111', fechaEmision: '2026-11-02' } });
  const val = (await api('POST', `/comprobantes/${id}/validar`, { token: empleado })).body;
  check(val.completo === true && val.resumen.aIngresar === 2 && val.resumen.descartadas === 1, 'HU10: validar informa 2 líneas a ingresar y 1 descartada');
  check(val.resumen.coincideTotal === false && val.avisos.some((a) => a.campo === 'totalDeclarado'), 'HU10: la diferencia con el total impreso es un aviso, no impide confirmar');

  // --- HU11: todo o nada ---
  await db.producto.update({ where: { id: yerba.id }, data: { activo: false } });
  const fallida = await api('POST', `/comprobantes/${id}/confirmar`, { token: empleado });
  const estadoTrasFalla = (await db.comprobante.findUnique({ where: { id } })).estado;
  check(
    fallida.status === 400 && estadoTrasFalla === 'EN_REVISION' && (await stock(gaseosa.id)) === antes.gaseosa,
    'criterio HU11: con una línea inválida (producto desactivado) no entra ninguna y el comprobante sigue en revisión',
  );
  await db.producto.update({ where: { id: yerba.id }, data: { activo: true } });

  // --- HU11: confirmación simultánea ---
  const intentos = await Promise.all(Array.from({ length: 6 }, (_, i) => api('POST', `/comprobantes/${id}/confirmar`, { token: i % 2 ? dueño : empleado })));
  const ok = intentos.filter((r) => r.status === 200).length;
  const conflictos = intentos.filter((r) => r.status === 409).length;
  check(ok === 1 && conflictos === 5, `criterio HU11: 6 confirmaciones simultáneas, una correcta y 5 rechazadas (${ok} y ${conflictos})`);
  check(
    (await stock(gaseosa.id)) === antes.gaseosa + 40 && (await stock(yerba.id)) === antes.yerba + 12 && (await stock(galletita.id)) === antes.galletita,
    'criterio HU11: el stock sube una sola vez con lo corregido (gaseosa +40, yerba +12) y la línea descartada no entra',
  );
  const movimientos = await db.movimientoStock.findMany({ where: { detalleComprobante: { comprobanteId: id } } });
  check(movimientos.length === 2 && movimientos.every((m) => m.tipo === 'ENTRADA' && m.motivo === 'COMPRA'), 'un movimiento de entrada por línea, vinculado a su línea del comprobante');
  const precios = await db.precioCompra.findMany({ where: { detalleComprobante: { comprobanteId: id } } });
  check(
    precios.length === 2 && precios.every((p) => p.fechaVigencia.toISOString().startsWith('2026-11-02')),
    'el precio de compra de cada línea se registra con la fecha de emisión',
  );
  const otra = await api('POST', `/comprobantes/${id}/confirmar`, { token: dueño });
  check(otra.status === 409 && (await stock(gaseosa.id)) === antes.gaseosa + 40, 'confirmar de nuevo da 409 y no vuelve a sumar');
  check((await api('PATCH', `/comprobantes/${id}/detalles/${l1.id}`, { token: dueño, cuerpo: { cantidad: 1 } })).status === 409, 'un comprobante confirmado ya no se edita');

  // --- Mismo número del mismo proveedor ---
  const segundo = (await subir()).body.id;
  await leer(segundo);
  await api('PATCH', `/comprobantes/${segundo}/cabecera`, { token: empleado, cuerpo: { numero: '0001-00099111' } });
  const v2 = (await api('POST', `/comprobantes/${segundo}/validar`, { token: empleado })).body;
  check(v2.avisos.some((a) => a.campo === 'numero' && a.mensaje.includes(`#${id}`)), 'un número ya confirmado del mismo proveedor se avisa como posible duplicado');

  const descuadre = await db.$queryRaw`
    SELECT p.id FROM productos p LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)`;
  check(descuadre.length === 0, 'el stock sigue igual a la suma de movimientos');
}
