// HU22: ventas informadas por un sistema externo (criterios: una venta
// reenviada con la misma referencia no se descuenta dos veces, un pedido sin
// clave válida es rechazado y el contrato queda publicado).
// Incluye permisos, atomicidad, stock negativo, reenvíos simultáneos,
// concurrencia con el carrito (HU13) y revocación con ventas en curso.

const numero = (v) => Number(v);

export default async function hu22({ api, check, db, dueño, empleado }) {
  const nuevaClave = async (nombre) => (await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre } })).body;
  const vender = (clave, cuerpo) =>
    api('POST', '/v1/integracion/salidas', { cuerpo, headers: clave ? { Authorization: `Bearer ${clave}` } : {} });
  const stock = async (id) => numero((await db.producto.findUnique({ where: { id } })).stockActual);
  const salidasDe = (claveId) => db.salida.count({ where: { claveIntegracionId: claveId } });
  const totalSalidas = () => db.salida.count();

  const k1 = await nuevaClave('Caja 1');
  const k2 = await nuevaClave('Caja 2');
  const gaseosa = await db.producto.findFirst({ where: { codigoBarras: '7790001000012' } });
  const yerba = await db.producto.findFirst({ where: { codigoBarras: '7790001000029' } });
  const alfajor = await db.producto.findFirst({ where: { nombre: 'Alfajor triple chocolate' } });
  const leche = await db.producto.findFirst({ where: { nombre: 'Leche entera 1 l' } });

  // --- Contrato publicado ---
  const contrato = await api('GET', '/v1/integracion/openapi.json');
  check(
    contrato.status === 200 && contrato.body.openapi?.startsWith('3.') && contrato.body.paths['/salidas']?.post,
    'criterio: el contrato OpenAPI se publica sin clave (GET /v1/integracion/openapi.json)',
  );

  // --- Autenticación ---
  const venta1 = { referencia: 'T-0001', lineas: [{ codigoBarras: '7790001000012', cantidad: 2 }] };
  check((await vender(null, venta1)).status === 401, 'criterio: sin clave → 401');
  check((await vender(`rmt_live_${'f'.repeat(64)}`, venta1)).status === 401, 'clave inexistente → 401');
  check((await api('POST', '/v1/integracion/salidas', { token: empleado, cuerpo: venta1 })).status === 401, 'token de una persona → 401');
  check((await totalSalidas()) === 0, 'los pedidos rechazados no registraron nada');

  // --- Validación y atomicidad ---
  const stockGaseosa0 = await stock(gaseosa.id);
  const malJson = await api('POST', '/v1/integracion/salidas', { cuerpo: '{"referencia": ', headers: { Authorization: `Bearer ${k1.clave}` } });
  check(malJson.status === 400, `JSON mal formado → 400 (antes daba 500): ${malJson.status}`);
  check((await vender(k1.clave, { referencia: 'T-X', lineas: [] })).status === 400, 'sin líneas → 400');
  check((await vender(k1.clave, { lineas: venta1.lineas })).status === 400, 'sin referencia → 400');
  check(
    (await vender(k1.clave, { referencia: 'T-X', lineas: [{ codigoBarras: '779', productoId: 1, cantidad: 1 }] })).status === 400,
    'línea con código y id a la vez → 400',
  );
  const desconocido = await vender(k1.clave, {
    referencia: 'T-X',
    lineas: [{ codigoBarras: '7790001000012', cantidad: 1 }, { codigoBarras: '7790000000000', cantidad: 1 }],
  });
  check(
    desconocido.status === 400 && desconocido.body.detalles?.[0]?.campo === 'lineas.1.codigoBarras',
    'código de barras desconocido → 400 que indica la línea',
  );
  const fraccion = await vender(k1.clave, { referencia: 'T-X', lineas: [{ productoId: gaseosa.id, cantidad: 1.5 }] });
  check(fraccion.status === 400 && /unidades enteras/.test(JSON.stringify(fraccion.body)), 'fracción de un producto por unidad → 400');
  const inactivo = await db.producto.create({ data: { nombre: 'Producto discontinuado', activo: false } });
  check(
    (await vender(k1.clave, { referencia: 'T-X', lineas: [{ productoId: gaseosa.id, cantidad: 1 }, { productoId: inactivo.id, cantidad: 1 }] })).status === 400,
    'producto desactivado → 400',
  );
  check(
    (await vender(k1.clave, { referencia: 'T-X', lineas: [{ productoId: 999999, cantidad: 1 }] })).status === 400,
    'producto inexistente → 400',
  );
  check((await stock(gaseosa.id)) === stockGaseosa0 && (await totalSalidas()) === 0, 'atomicidad: ninguna venta rechazada descontó stock');

  // --- Venta correcta ---
  const usoAntes = (await db.claveIntegracion.findUnique({ where: { id: k1.id } })).ultimoUsoEn;
  const stockAlfajor0 = await stock(alfajor.id);
  const ticket = {
    referencia: 'T-0001',
    fecha: '2026-11-14T18:32:05-03:00',
    lineas: [
      { codigoBarras: '7790001000012', cantidad: 2 },
      { productoId: alfajor.id, cantidad: 1 },
      { codigoBarras: '7790001000012', cantidad: 1 },
    ],
  };
  const r1 = await vender(k1.clave, ticket);
  check(r1.status === 201 && r1.body.repetida === false, 'venta: 201');
  check(
    r1.body.lineas?.length === 2 && r1.body.lineas.find((l) => l.producto.id === gaseosa.id)?.cantidad === 3,
    'las líneas del mismo producto se suman (gaseosa 2 + 1 = 3)',
  );
  check((await stock(gaseosa.id)) === stockGaseosa0 - 3 && (await stock(alfajor.id)) === stockAlfajor0 - 1, 'el stock se descontó');
  const cabecera = await db.salida.findUnique({ where: { id: r1.body.id }, include: { movimientos: true } });
  check(
    cabecera.origen === 'INTEGRACION' && cabecera.claveIntegracionId === k1.id && cabecera.usuarioId === null && cabecera.motivo === 'VENTA',
    'salida con origen INTEGRACION, la clave y sin usuario',
  );
  check(
    cabecera.referenciaExterna === 'T-0001' && cabecera.fechaExterna?.toISOString() === '2026-11-14T21:32:05.000Z',
    'se guardan la referencia y la fecha de la caja',
  );
  check(
    cabecera.movimientos.length === 2 && cabecera.movimientos.every((m) => m.tipo === 'SALIDA' && m.usuarioId === null && numero(m.cantidad) < 0),
    'un movimiento SALIDA por producto, sin usuario',
  );
  const usoDespues = (await db.claveIntegracion.findUnique({ where: { id: k1.id } })).ultimoUsoEn;
  check(usoDespues && (!usoAntes || usoDespues > usoAntes), 'la venta registra el último uso de la clave (HU21)');
  const movimientos = await api('GET', `/movimientos?productoId=${alfajor.id}`, { token: empleado });
  const ultimo = (movimientos.body.movimientos ?? movimientos.body.items ?? movimientos.body)[0];
  check(
    movimientos.status === 200 && ultimo?.origen?.origenSalida === 'INTEGRACION' && ultimo.origen.integracion === 'Caja 1',
    'Movimientos muestra la venta como «Punto de venta (Caja 1)»',
  );

  // --- Reenvíos ---
  const reenvio = await vender(k1.clave, { ...ticket, lineas: [...ticket.lineas].reverse() });
  check(reenvio.status === 200 && reenvio.body.repetida === true && reenvio.body.id === r1.body.id, 'criterio: reenvío (otro orden) → 200, misma venta');
  check((await stock(gaseosa.id)) === stockGaseosa0 - 3 && (await totalSalidas()) === 1, 'criterio: el reenvío no descontó de nuevo');
  const distinta = await vender(k1.clave, { referencia: 'T-0001', lineas: [{ codigoBarras: '7790001000012', cantidad: 5 }] });
  check(distinta.status === 409 && (await stock(gaseosa.id)) === stockGaseosa0 - 3, 'misma referencia con otro contenido → 409, sin descontar');
  const conEspacios = await vender(k1.clave, { ...ticket, referencia: '  T-0001 ' });
  check(conEspacios.status === 200 && conEspacios.body.id === r1.body.id, 'la referencia se compara sin espacios de los extremos');
  const otraCaja = await vender(k2.clave, { referencia: 'T-0001', lineas: [{ productoId: alfajor.id, cantidad: 1 }] });
  check(otraCaja.status === 201 && otraCaja.body.id !== r1.body.id, 'la referencia es única por clave: otra caja puede usar T-0001');

  // --- Stock insuficiente: la venta ya ocurrió ---
  const stockYerba0 = await stock(yerba.id);
  const negativa = await vender(k1.clave, { referencia: 'T-0002', lineas: [{ codigoBarras: '7790001000029', cantidad: stockYerba0 + 2 }] });
  check(
    negativa.status === 201 && negativa.body.lineas[0].stockNuevo === -2 && (await stock(yerba.id)) === -2,
    'stock insuficiente: la venta se registra y el stock queda en -2',
  );
  check(negativa.body.advertencias?.length === 1 && negativa.body.advertencias[0].productoId === yerba.id, 'la respuesta avisa el stock negativo');
  const valorizacion = (await api('GET', '/reportes/valorizacion', { token: dueño })).body;
  check(
    valorizacion.stockNegativo?.some((p) => p.id === yerba.id && p.stockActual === -2) &&
      !valorizacion.categorias.some((c) => c.productos.some((p) => p.id === yerba.id)),
    'HU28: la valorización informa aparte el producto con stock negativo y no lo suma',
  );

  // --- Producto por kilo ---
  const queso = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre: 'Queso cremoso', unidadMedida: 'KILOGRAMO' } })).body;
  await api('POST', '/recuentos', { token: dueño, cuerpo: { lineas: [{ productoId: queso.id, contado: 10, stockRegistrado: 0, ultimoMovimientoId: null }] } });
  const kilo = await vender(k1.clave, { referencia: 'T-0003', lineas: [{ productoId: queso.id, cantidad: 1.255 }] });
  check(kilo.status === 201 && (await stock(queso.id)) === 8.745, 'producto por kilo: 1,255 kg descontados (10 → 8,745)');

  // --- El carrito (HU13) no cambió ---
  const stockLeche0 = await stock(leche.id);
  const carritoCorto = await api('POST', '/salidas', { token: empleado, cuerpo: { lineas: [{ productoId: leche.id, cantidad: stockLeche0 + 1 }] } });
  check(carritoCorto.status === 400 && (await stock(leche.id)) === stockLeche0, 'carrito: sin stock suficiente sigue rechazándose (400)');
  const idOperacion = crypto.randomUUID();
  const carrito = await api('POST', '/salidas', { token: empleado, cuerpo: { idOperacion, lineas: [{ productoId: leche.id, cantidad: 1 }] } });
  const carritoOtra = await api('POST', '/salidas', { token: empleado, cuerpo: { idOperacion, lineas: [{ productoId: leche.id, cantidad: 1 }] } });
  check(
    carrito.status === 201 && carritoOtra.status === 200 && carritoOtra.body.repetida && (await stock(leche.id)) === stockLeche0 - 1,
    'carrito: registra y su reenvío no descuenta de nuevo',
  );

  // --- Reenvíos simultáneos de la misma venta ---
  const stockAlfajorA = await stock(alfajor.id);
  const simultaneos = await Promise.all(
    Array.from({ length: 25 }, () => vender(k1.clave, { referencia: 'T-SIM', lineas: [{ productoId: alfajor.id, cantidad: 1 }] })),
  );
  const estados = simultaneos.map((r) => r.status);
  check(
    estados.filter((s) => s === 201).length === 1 && estados.filter((s) => s === 200).length === 24,
    `25 envíos simultáneos de T-SIM: un 201 y 24 × 200 (${[...new Set(estados)].join(', ')})`,
  );
  check(new Set(simultaneos.map((r) => r.body.id)).size === 1, 'todas las respuestas devuelven la misma venta');
  check((await stock(alfajor.id)) === stockAlfajorA - 1, 'criterio: se descontó una sola vez');

  // --- Reenvíos con el catálogo cambiado ---
  // Un reenvío exacto devuelve la venta original aunque el código de barras
  // haya cambiado, desaparecido o pasado a otro producto, o el producto se
  // haya desactivado. Se comparan las líneas normalizadas con sus
  // identificadores originales; la fecha no participa.
  const crearConStock = async (nombre, codigoBarras) => {
    const p = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre, codigoBarras } })).body;
    await api('POST', '/recuentos', { token: dueño, cuerpo: { lineas: [{ productoId: p.id, contado: 50, stockRegistrado: 0, ultimoMovimientoId: null }] } });
    return p;
  };
  const cambiarProducto = (id, datos) => api('PATCH', `/productos/${id}`, { token: dueño, cuerpo: datos });
  const ventasDe = (referencia) => db.salida.count({ where: { claveIntegracionId: k1.id, referenciaExterna: referencia } });
  const [pa, pb, pc, pd] = [
    await crearConStock('Reenvío A', '7790009990001'),
    await crearConStock('Reenvío B', '7790009990002'),
    await crearConStock('Reenvío C', '7790009990003'),
    await crearConStock('Reenvío D', '7790009990004'),
  ];
  const pedidoA = { referencia: 'RC-1', fecha: '2026-11-14T10:00:00-03:00', lineas: [{ codigoBarras: '7790009990001', cantidad: 2 }] };
  const ventaA = await vender(k1.clave, pedidoA);
  check(ventaA.status === 201 && (await stock(pa.id)) === 48, 'catálogo: venta RC-1 por código de barras (stock 50 → 48)');
  check((await cambiarProducto(pa.id, { codigoBarras: '7790009990011' })).status === 200, 'catálogo: se cambia el código de barras del producto');
  const reA = await vender(k1.clave, pedidoA);
  check(
    reA.status === 200 && reA.body.repetida === true && reA.body.id === ventaA.body.id && (await stock(pa.id)) === 48,
    `criterio: reenvío exacto con el código cambiado → 200, misma venta, stock igual (${reA.status})`,
  );
  const reFecha = await vender(k1.clave, { ...pedidoA, fecha: '2026-11-15T09:00:00-03:00' });
  check(reFecha.status === 200 && reFecha.body.id === ventaA.body.id, 'la fecha no participa en la comparación del reenvío');
  check(
    (await vender(k1.clave, { ...pedidoA, referencia: 'RC-1-NUEVA' })).status === 400,
    'una venta nueva con el código viejo → 400 (código desconocido)',
  );
  const otraCantidad = await vender(k1.clave, { ...pedidoA, lineas: [{ codigoBarras: '7790009990001', cantidad: 3 }] });
  const porId = await vender(k1.clave, { ...pedidoA, lineas: [{ productoId: pa.id, cantidad: 2 }] });
  const otroProducto = await vender(k1.clave, { ...pedidoA, lineas: [{ codigoBarras: '7790009990002', cantidad: 2 }] });
  check(
    otraCantidad.status === 409 && porId.status === 409 && otroProducto.status === 409,
    `misma referencia con otra cantidad, por productoId u otro producto → 409 (${otraCantidad.status}, ${porId.status}, ${otroProducto.status})`,
  );
  check((await stock(pa.id)) === 48 && (await stock(pb.id)) === 50, 'los 409 no tocaron el stock');
  const paralelos = await Promise.all(Array.from({ length: 10 }, () => vender(k1.clave, pedidoA)));
  check(
    paralelos.every((r) => r.status === 200 && r.body.id === ventaA.body.id) && (await ventasDe('RC-1')) === 1 && (await stock(pa.id)) === 48,
    `10 reenvíos exactos simultáneos con el código cambiado: todos 200, una sola venta (${[...new Set(paralelos.map((r) => r.status))].join(', ')})`,
  );

  const pedidoB = { referencia: 'RC-2', lineas: [{ codigoBarras: '7790009990002', cantidad: 1 }] };
  const ventaB = await vender(k1.clave, pedidoB);
  await cambiarProducto(pb.id, { codigoBarras: null });
  const reB = await vender(k1.clave, pedidoB);
  check(
    ventaB.status === 201 && reB.status === 200 && reB.body.id === ventaB.body.id && (await stock(pb.id)) === 49,
    `reenvío exacto con el código borrado → 200, misma venta (${reB.status})`,
  );

  const pedidoC = { referencia: 'RC-3', lineas: [{ codigoBarras: '7790009990003', cantidad: 1 }, { codigoBarras: '7790009990003', cantidad: 1 }] };
  const ventaC = await vender(k1.clave, pedidoC);
  await cambiarProducto(pc.id, { activo: false });
  const reC = await vender(k1.clave, { ...pedidoC, lineas: [{ codigoBarras: '7790009990003', cantidad: 2.0 }] });
  check(
    ventaC.status === 201 && reC.status === 200 && reC.body.id === ventaC.body.id && (await stock(pc.id)) === 48,
    `reenvío con el producto desactivado (líneas 1 + 1 enviadas como 2) → 200, misma venta (${reC.status})`,
  );

  const pedidoD = { referencia: 'RC-4', lineas: [{ codigoBarras: '7790009990004', cantidad: 1 }] };
  const ventaD = await vender(k1.clave, pedidoD);
  await cambiarProducto(pd.id, { codigoBarras: '7790009990014' });
  await cambiarProducto(pa.id, { codigoBarras: '7790009990004' });
  const reD = await vender(k1.clave, pedidoD);
  check(
    ventaD.status === 201 && reD.status === 200 && reD.body.id === ventaD.body.id && (await stock(pd.id)) === 49 && (await stock(pa.id)) === 48,
    `reenvío con el código pasado a otro producto → 200, la venta original y ningún descuento al otro (${reD.status})`,
  );

  // Colisión de firmas (revisión): una línea con el código «a=1|c:b» no puede
  // confundirse con dos líneas «a» y «b», que los esquemas también permiten.
  const pc1 = await crearConStock('Colisión A', 'COL-a');
  const pc2 = await crearConStock('Colisión B', 'COL-b');
  const pc3 = await crearConStock('Colisión AB', 'COL-a=1|c:COL-b');
  const pedidoUno = { referencia: 'RC-COL', lineas: [{ codigoBarras: 'COL-a=1|c:COL-b', cantidad: 1 }] };
  const pedidoDos = { referencia: 'RC-COL', lineas: [{ codigoBarras: 'COL-a', cantidad: 1 }, { codigoBarras: 'COL-b', cantidad: 1 }] };
  const foto = async () => JSON.stringify([await stock(pc1.id), await stock(pc2.id), await stock(pc3.id), await db.movimientoStock.count()]);
  const ventaUno = await vender(k1.clave, pedidoUno);
  const fotoUno = await foto();
  check(ventaUno.status === 201 && (await stock(pc3.id)) === 49, 'colisión: venta RC-COL con una línea de código «COL-a=1|c:COL-b»');
  const conDos = await vender(k1.clave, pedidoDos);
  check(conDos.status === 409, `colisión: la misma referencia con las líneas «COL-a» y «COL-b» → 409 (${conDos.status})`);
  check((await foto()) === fotoUno, 'colisión: el 409 no cambió stock ni movimientos');
  const reUno = await vender(k1.clave, pedidoUno);
  check(
    reUno.status === 200 && reUno.body.id === ventaUno.body.id && (await foto()) === fotoUno,
    `colisión: el reenvío original sigue dando 200, misma venta, sin cambios (${reUno.status})`,
  );

  const guardado = (await db.salida.findUnique({ where: { id: ventaC.body.id } })).pedidoExterno;
  check(
    Array.isArray(guardado) && guardado.length === 1 && guardado[0].codigoBarras === '7790009990003' && guardado[0].cantidad === '2',
    'la venta guarda su petición normalizada (código original y 1 + 1 = 2)',
  );
  let sinPedido = false;
  try {
    await db.$executeRaw`INSERT INTO salidas (origen, motivo, clave_integracion_id, referencia_externa) VALUES ('INTEGRACION', 'VENTA', ${k1.id}, 'SIN-PEDIDO')`;
  } catch {
    sinPedido = true;
  }
  check(sinPedido, 'CHECK chk_pedido_externo: la base rechaza una venta de integración sin petición');

  // --- Concurrencia: ventas de dos cajas y carritos sobre los mismos productos ---
  const productos = [];
  for (const nombre of ['Prueba A', 'Prueba B', 'Prueba C', 'Prueba D']) {
    const p = (await api('POST', '/productos', { token: dueño, cuerpo: { nombre } })).body;
    await api('POST', '/recuentos', { token: dueño, cuerpo: { lineas: [{ productoId: p.id, contado: 1000, stockRegistrado: 0, ultimoMovimientoId: null }] } });
    productos.push(p.id);
  }
  let semilla = 11;
  const azar = (n) => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return Math.floor((semilla / 2147483648) * n);
  };
  const lineasAzar = () => {
    // 2 a 4 productos en orden aleatorio (para provocar bloqueos cruzados).
    const elegidos = [...productos].sort(() => azar(3) - 1).slice(0, 2 + azar(3));
    return elegidos.map((productoId) => ({ productoId, cantidad: 1 + azar(5) }));
  };
  const pedidos = [];
  for (let i = 0; i < 40; i += 1) {
    const lineas = lineasAzar();
    pedidos.push({ tipo: 'venta', lineas, envio: () => vender(i % 2 ? k1.clave : k2.clave, { referencia: `C-${i}`, lineas }) });
  }
  for (let i = 0; i < 12; i += 1) {
    const lineas = lineasAzar();
    pedidos.push({ tipo: 'carrito', lineas, envio: () => api('POST', '/salidas', { token: empleado, cuerpo: { lineas } }) });
  }
  const respuestas = await Promise.all(pedidos.map((p) => p.envio()));
  check(respuestas.every((r) => r.status === 201), `52 operaciones simultáneas (40 ventas y 12 carritos): todas 201 (${[...new Set(respuestas.map((r) => r.status))].join(', ')})`);
  const esperado = new Map(productos.map((id) => [id, 1000]));
  pedidos.forEach((p, i) => {
    if (respuestas[i].status !== 201) return;
    for (const l of p.lineas) esperado.set(l.productoId, esperado.get(l.productoId) - l.cantidad);
  });
  const finales = await Promise.all(productos.map(stock));
  check(
    productos.every((id, i) => finales[i] === esperado.get(id)),
    `stock esperado igual al registrado en los 4 productos (${finales.join(', ')})`,
  );

  // --- Revocación con ventas en curso ---
  // 240 ventas en paralelo; la revocación sale apenas termina la primera, así
  // cae con ventas en curso. (Con 120 ventas y la revocación después de 10, en
  // algunas máquinas todas terminaban antes de que llegara.) Que se
  // superpongan depende de los tiempos: si en una ronda la revocación llega
  // tarde, se repite con otra clave (hasta 3). Las
  // garantías se comprueban en todas las rondas; el orden exacto venta →
  // revocación lo prueba el caso determinístico que sigue.
  let rondas = 0;
  let superpuestas = false;
  let sinErrores = true;
  let coinciden = true;
  let rechazadasDespues = true;
  let resumen = '';
  while (!superpuestas && rondas < 3) {
    rondas += 1;
    const k3 = await nuevaClave(`Caja 3 (ronda ${rondas})`);
    let terminadas = 0;
    let revocacion;
    const enCurso = Array.from({ length: 240 }, (_, i) =>
      vender(k3.clave, { referencia: `R-${i}`, lineas: [{ productoId: productos[i % 4], cantidad: 1 }] }).then((r) => {
        terminadas += 1;
        if (terminadas === 1) revocacion = api('DELETE', `/claves-integracion/${k3.id}`, { token: dueño });
        return r;
      }),
    );
    const durante = await Promise.all(enCurso);
    const revocada = await revocacion;
    const registradasK3 = await salidasDe(k3.id);
    const despues = await Promise.all(
      Array.from({ length: 10 }, (_, i) => vender(k3.clave, { referencia: `R-POST-${i}`, lineas: [{ productoId: productos[0], cantidad: 1 }] })),
    );
    const exitos = durante.filter((r) => r.status === 201).length;
    sinErrores &&= revocada.status === 200 && durante.every((r) => r.status === 201 || r.status === 401);
    coinciden &&= registradasK3 === exitos;
    rechazadasDespues &&= despues.every((r) => r.status === 401) && (await salidasDe(k3.id)) === registradasK3;
    superpuestas = exitos >= 1 && exitos < durante.length;
    resumen += `${resumen ? '; ' : ''}ronda ${rondas}: ${exitos} × 201 y ${durante.length - exitos} × 401`;
  }
  check(sinErrores, `ventas durante la revocación: solo 201 o 401, sin errores (${resumen})`);
  check(superpuestas, `la revocación cayó con ventas en curso en ${rondas} ${rondas === 1 ? 'ronda' : 'rondas'}`);
  check(coinciden, 'cada 201 corresponde a una venta registrada y ningún 401 dejó una');
  check(rechazadasDespues, 'criterio: con la clave revocada, 10 de 10 ventas rechazadas y nada registrado');

  // --- Una venta que ya validó la clave no puede confirmarse después de la revocación ---
  // Determinístico: se bloquea un producto desde otra conexión, la venta queda
  // esperando a mitad de su transacción (ya con la clave comprobada) y se
  // revoca la clave. La revocación tiene que esperar a que la venta termine.
  const k4 = await nuevaClave('Caja 4');
  let liberar;
  const bloqueo = new Promise((r) => (liberar = r));
  const tomado = db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM productos WHERE id = ${productos[1]} FOR UPDATE`;
      await bloqueo;
    },
    { timeout: 20_000 },
  );
  const orden = [];
  await new Promise((r) => setTimeout(r, 200));
  const ventaEnEspera = vender(k4.clave, { referencia: 'B-1', lineas: [{ productoId: productos[1], cantidad: 1 }] }).then((r) => {
    orden.push(`venta ${r.status}`);
    return r;
  });
  await new Promise((r) => setTimeout(r, 400));
  const revocacionK4 = api('DELETE', `/claves-integracion/${k4.id}`, { token: dueño }).then((r) => {
    orden.push(`revocación ${r.status}`);
    return r;
  });
  await new Promise((r) => setTimeout(r, 400));
  const activaMientras = (await db.claveIntegracion.findUnique({ where: { id: k4.id } })).activa;
  liberar();
  await tomado;
  await Promise.all([ventaEnEspera, revocacionK4]);
  check(activaMientras, 'la revocación espera a la venta en curso (la clave sigue activa mientras tanto)');
  check(
    orden.join(' → ') === 'venta 201 → revocación 200',
    `la venta en curso termina antes de que la revocación se confirme (${orden.join(' → ')})`,
  );

  // --- Consistencia final ---
  const descuadrados = await db.$queryRaw`
    SELECT p.id FROM productos p LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)`;
  check(descuadrados.length === 0, 'stock = suma de movimientos en todos los productos');
  const sinCabecera = await db.$queryRaw`
    SELECT count(*)::int AS n FROM salidas s WHERE NOT EXISTS (SELECT 1 FROM movimientos_stock m WHERE m.salida_id = s.id)`;
  check(sinCabecera[0].n === 0, 'ninguna salida quedó sin movimientos');
}
