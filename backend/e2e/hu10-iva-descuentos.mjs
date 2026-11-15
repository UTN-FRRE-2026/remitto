// HU10: factura con bonificación general e IVA discriminado (IA simulada,
// escenario factura_iva: 72.000 − 3.600 + 14.364 + 2.052 = 84.816). El total
// impreso tiene que cuadrar con suma − descuentos + impuestos, al leer y al
// validar, y los dos importes se pueden corregir en la revisión.
export default async function hu10({ api, check, db, dueño, empleado, base }) {
  const proveedor = (await db.proveedor.findFirst({ orderBy: { id: 'asc' } })).id;
  let marca = 0;
  const subir = async (escenario) => {
    marca += 1;
    const form = new FormData();
    form.append('archivo', new Blob([Buffer.from(`%PDF-1.4\n% SIMULACION=${escenario} iva-${marca}\n%%EOF\n`, 'latin1')], { type: 'application/pdf' }), `f${marca}.pdf`);
    form.append('proveedorId', String(proveedor));
    const res = await fetch(`${base}/comprobantes`, { method: 'POST', headers: { Authorization: `Bearer ${empleado}` }, body: form });
    const id = (await res.json()).id;
    await api('POST', `/comprobantes/${id}/procesar`, { token: empleado });
    for (let i = 0; i < 60; i += 1) {
      if ((await api('GET', `/comprobantes/${id}/estado`, { token: empleado })).body.estado === 'EN_REVISION') break;
      await new Promise((r) => setTimeout(r, 150));
    }
    return id;
  };
  const prod = (prefijo) => db.producto.findFirst({ where: { nombre: { startsWith: prefijo } } });
  const productos = [await prod('Gaseosa cola'), await prod('Yerba mate con palo'), await prod('Galletitas')];
  const asociar = async (id) => {
    const c = (await api('GET', `/comprobantes/${id}`, { token: empleado })).body;
    for (const d of c.detalles.sort((a, b) => a.nroLinea - b.nroLinea)) {
      await api('PATCH', `/comprobantes/${id}/detalles/${d.id}`, { token: empleado, cuerpo: { productoId: productos[d.nroLinea - 1].id } });
    }
  };
  const validar = async (id) => (await api('POST', `/comprobantes/${id}/validar`, { token: empleado })).body;
  const cabecera = (id, cuerpo, token = empleado) => api('PATCH', `/comprobantes/${id}/cabecera`, { token, cuerpo });

  // --- Lectura ---
  const id = await subir('factura_iva');
  const c = (await api('GET', `/comprobantes/${id}`, { token: empleado })).body;
  check(
    Number(c.totalDeclarado) === 84816 && Number(c.descuentoDeclarado) === 3600 && Number(c.impuestosDeclarados) === 16416,
    `la lectura guarda total, descuento e impuestos (${c.totalDeclarado}, ${c.descuentoDeclarado}, ${c.impuestosDeclarados})`,
  );
  check(c.tipo === 'FACTURA', `el tipo leído (FACTURA) se precarga en la revisión (${c.tipo})`);
  const norm = c.respuestaIa.normalizada;
  check(norm.ajustes.length === 3 && norm.ajustes.map((a) => a.tipo).join(',') === 'DESCUENTO,IMPUESTO,IMPUESTO', 'los renglones de bonificación, IVA y percepción quedan en la lectura');
  check(
    norm.motivosRevision.length === 0 && c.requiereRevision === false,
    `una factura que cuadra con IVA y descuento no se marca para revisar (${norm.motivosRevision.join(' | ') || 'sin motivos'})`,
  );

  // --- Validación de la revisión ---
  await asociar(id);
  await cabecera(id, { numero: '0003-00012345', fechaEmision: '2026-11-05' });
  let v = await validar(id);
  check(
    v.completo && v.resumen.coincideTotal === true && v.resumen.totalCalculado === 84816 && !v.avisos.some((a) => a.campo === 'totalDeclarado'),
    'criterio: suma de líneas − descuentos + impuestos coincide con el total, sin aviso',
  );

  // --- Corrección en la revisión ---
  check((await cabecera(id, { impuestosDeclarados: null })).status === 200, 'el empleado corrige los impuestos (borrarlos)');
  v = await validar(id);
  const aviso = v.avisos.find((a) => a.campo === 'totalDeclarado');
  check(v.resumen.coincideTotal === false && /Lo calculado/.test(aviso?.mensaje ?? ''), 'sin los impuestos ya no cuadra, y el aviso muestra la cuenta');
  check(v.completo === true, 'la diferencia sigue siendo un aviso: no impide confirmar');
  const r = await cabecera(id, { impuestosDeclarados: 16416, descuentoDeclarado: 3600 });
  check(r.status === 200 && Number(r.body.impuestosDeclarados) === 16416, 'la respuesta de la cabecera trae los importes corregidos');
  check((await validar(id)).resumen.coincideTotal === true, 'con los impuestos de nuevo, vuelve a cuadrar');
  check((await cabecera(id, { descuentoDeclarado: -5 })).status === 400 && (await cabecera(id, { impuestosDeclarados: 1.234 })).status === 400, 'negativos o con más de 2 decimales: 400');
  let rechazo = false;
  try {
    await db.$executeRaw`UPDATE comprobantes SET descuento_declarado = -1 WHERE id = ${id}`;
  } catch {
    rechazo = true;
  }
  check(rechazo, 'la base rechaza un descuento negativo (chk_comprobante_descuento_impuestos)');

  // --- Confirmación ---
  const antes = Number((await db.producto.findUnique({ where: { id: productos[0].id } })).stockActual);
  const conf = await api('POST', `/comprobantes/${id}/confirmar`, { token: dueño });
  const despues = Number((await db.producto.findUnique({ where: { id: productos[0].id } })).stockActual);
  check(conf.status === 200 && despues === antes + 36, 'la factura se confirma y el stock sube con las cantidades de las líneas');
  const precio = await db.precioCompra.findFirst({ where: { detalleComprobante: { comprobanteId: id }, productoId: productos[0].id } });
  check(Number(precio.precioUnitario) === 690, 'el precio de compra registrado es el de la línea, sin IVA ni descuento general');
  const guardado = await db.comprobante.findUnique({ where: { id } });
  check(Number(guardado.descuentoDeclarado) === 3600 && Number(guardado.impuestosDeclarados) === 16416, 'el comprobante confirmado conserva descuento e impuestos');

  // --- Un remito sin ajustes sigue igual ---
  const remito = await subir('ok');
  const cr = (await api('GET', `/comprobantes/${remito}`, { token: empleado })).body;
  check(cr.descuentoDeclarado === null && cr.impuestosDeclarados === null && cr.tipo === 'REMITO', 'un remito sin descuentos ni impuestos los deja vacíos (y queda como remito)');
  await asociar(remito);
  check((await validar(remito)).resumen.coincideTotal === true, 'y su total (72.000) sigue coincidiendo con la suma de las líneas');
}
