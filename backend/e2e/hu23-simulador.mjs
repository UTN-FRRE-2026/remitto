// HU23: simulador de ventas contra la API de integración (HU22), en la base
// descartable del ejecutor. Criterios: al menos cien operaciones de salida y,
// al finalizar, ninguna diferencia entre el stock esperado y el registrado.
//
// Dos bloques separados:
// 1. Corrida válida: ventas, reenvíos y comparación. Los criterios se evalúan
//    solo acá, antes de introducir ningún error.
// 2. Control negativo: después se registra a propósito un descuento adicional
//    (una venta reenviada con referencia nueva) y se exige que el comparador
//    lo detecte con las diferencias exactas.
import {
  aMilesimas,
  generarVentas,
  stockEsperado,
  compararStock,
  descuentosDeVenta,
  simular,
  verificarRespuestas,
} from '../../simulador/simulador.mjs';

const SEMILLA = Number(process.env.SIM_SEMILLA ?? 2026);
const VENTAS = Number(process.env.SIM_VENTAS ?? 120);
const REENVIOS = Number(process.env.SIM_REENVIOS ?? 30);
const STOCK_INICIAL = 500;

const formato = (m) => (m / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3 });

export default async function hu23({ api, check, db, dueño, base }) {
  // --- Catálogo y clave de prueba ---
  const definiciones = [
    ['Simulador gaseosa', 'UNIDAD'],
    ['Simulador agua', 'UNIDAD'],
    ['Simulador galletitas', 'UNIDAD'],
    ['Simulador yerba', 'UNIDAD'],
    ['Simulador alfajor', 'PAQUETE'],
    ['Simulador queso', 'KILOGRAMO'],
  ];
  const catalogo = [];
  for (const [i, [nombre, unidadMedida]] of definiciones.entries()) {
    const codigoBarras = `SIM-779-${String(i + 1).padStart(4, '0')}`;
    const p = await api('POST', '/productos', { token: dueño, cuerpo: { nombre, unidadMedida, codigoBarras } });
    const recuento = await api('POST', '/recuentos', {
      token: dueño,
      cuerpo: { lineas: [{ productoId: p.body.id, contado: STOCK_INICIAL, stockRegistrado: 0, ultimoMovimientoId: null }] },
    });
    if (p.status !== 201 || recuento.status !== 201) throw new Error(`No se pudo preparar ${nombre} (${p.status}, ${recuento.status})`);
    catalogo.push({ productoId: p.body.id, codigoBarras, unidadMedida, nombre });
  }
  const clave = (await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: 'Simulador HU23' } })).body;
  const ids = catalogo.map((p) => p.productoId);
  // Stock leído de la base como texto decimal (sin pasar por Number).
  const stockEnBase = async () =>
    new Map(
      (await db.$queryRaw`SELECT id, stock_actual::text AS stock FROM productos WHERE id = ANY(${ids}::int[])`).map((f) => [f.id, aMilesimas(f.stock)]),
    );
  const inicial = await stockEnBase();
  check([...inicial.values()].every((m) => m === STOCK_INICIAL * 1000), `catálogo de prueba: ${catalogo.length} productos con stock ${STOCK_INICIAL}`);

  // --- 1. Corrida válida ---
  console.log(`\n  -- Corrida válida (semilla ${SEMILLA}, ${VENTAS} ventas, ${REENVIOS} reenvíos)`);
  const { ventas, tandas } = generarVentas({ semilla: SEMILLA, catalogo, ventas: VENTAS, reenvios: REENVIOS });
  const resultado = await simular({ base, clave: clave.clave, tandas });
  const creadas = resultado.registros.filter((r) => r.status === 201).length;
  const repetidas = resultado.registros.filter((r) => r.status === 200 && r.repetida).length;
  console.log(
    `  envíos lógicos ${resultado.enviosLogicos} (ventas únicas ${resultado.ventasUnicas}, reenvíos ${resultado.enviosLogicos - resultado.ventasUnicas}) · ` +
      `intentos HTTP ${resultado.intentosHttp} · 201: ${creadas} · 200 repetida: ${repetidas} · incompletos: ${resultado.incompletos.length}`,
  );
  const completa = resultado.incompletos.length === 0;
  check(completa, `ningún envío quedó incompleto${completa ? '' : `: ${resultado.incompletos.map((r) => `${r.referencia} (${r.status ?? r.error})`).join(', ')}`}`);
  const problemas = verificarRespuestas(resultado.registros);
  check(problemas.length === 0, `por referencia: un 201, el resto 200 con repetida y el mismo id; ids distintos entre referencias${problemas.length ? ` · ${problemas.slice(0, 3).join('; ')}` : ''}`);
  check(creadas === VENTAS && repetidas === REENVIOS, `${creadas} respuestas 201 y ${repetidas} respuestas 200 de reenvío (se esperaban ${VENTAS} y ${REENVIOS})`);

  const salidasClave = await db.salida.findMany({ where: { claveIntegracionId: clave.id }, include: { movimientos: true } });
  const movimientosEsperados = ventas.reduce((n, v) => n + descuentosDeVenta(v, catalogo).size, 0);
  const movimientosRegistrados = salidasClave.reduce((n, s) => n + s.movimientos.length, 0);
  check(
    salidasClave.length === VENTAS && movimientosRegistrados === movimientosEsperados,
    `en la base: ${salidasClave.length} salidas de la clave y ${movimientosRegistrados} movimientos (uno por producto y venta: ${movimientosEsperados})`,
  );

  const esperado = stockEsperado(inicial, ventas, catalogo);
  const registrado = await stockEnBase();
  const diferencias = compararStock(esperado, registrado);
  console.log('  producto                 esperado   registrado');
  for (const p of catalogo) {
    console.log(`  ${p.nombre.padEnd(22)} ${formato(esperado.get(p.productoId)).padStart(10)} ${formato(registrado.get(p.productoId)).padStart(12)}`);
  }
  const descuadrados = await db.$queryRaw`
    SELECT p.id FROM productos p LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)`;
  check(descuadrados.length === 0, 'stock igual a la suma de movimientos en todos los productos');

  check(
    completa && resultado.enviosLogicos >= 100 && creadas >= 100,
    `CRITERIO 1: ${resultado.enviosLogicos} operaciones de salida (${creadas} ventas registradas y ${repetidas} reenvíos), al menos cien`,
  );
  check(
    completa && problemas.length === 0 && diferencias.length === 0 && descuadrados.length === 0,
    `CRITERIO 2: ${diferencias.length} diferencias entre el stock esperado y el registrado${diferencias.length ? ` · ${JSON.stringify(diferencias)}` : ''}`,
  );

  // --- 2. Control negativo: descuento adicional introducido a propósito ---
  // Se evalúa aparte: sus diferencias no forman parte de la corrida válida.
  console.log('\n  -- Control negativo (descuento adicional introducido después de la corrida válida)');
  const original = ventas[Math.min(6, ventas.length - 1)];
  const duplicada = await simular({
    base,
    clave: clave.clave,
    tandas: [[{ venta: original, referencia: `${original.referencia}-BIS`, tipo: 'control' }]],
  });
  check(duplicada.registros[0]?.status === 201, `se registra la venta ${original.referencia} otra vez con la referencia ${original.referencia}-BIS (descuento real en la base descartable)`);
  const conError = compararStock(esperado, await stockEnBase());
  const inyectadas = [...descuentosDeVenta(original, catalogo)].map(([productoId, m]) => ({ productoId, diferencia: -m })).sort((a, b) => a.productoId - b.productoId);
  console.log(`  diferencias detectadas: ${conError.map((d) => `#${d.productoId} ${formato(d.diferencia)}`).join(', ') || 'ninguna'}`);
  check(
    JSON.stringify(conError.map((d) => ({ productoId: d.productoId, diferencia: d.diferencia }))) === JSON.stringify(inyectadas),
    `el comparador detecta exactamente el descuento adicional (${inyectadas.length} ${inyectadas.length === 1 ? 'producto' : 'productos'}), como debía`,
  );
}
