import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { argumentosSchema, resolverPeriodo, ErrorPeriodo, consultaSchema, HERRAMIENTAS_HABILITADAS } from '../src/modules/asistente/asistente.schema.js';
import { planSimulado } from '../src/ia/planSimulado.js';
import { elegirProducto, limitar, HERRAMIENTAS } from '../src/modules/asistente/herramientas.js';
import { consultar, PRESUPUESTO_MS } from '../src/modules/asistente/asistente.service.js';
import { interpretarPlan } from '../src/ia/asistente.js';

// HU25: asistente de consultas.
const HOY = '2026-11-15'; // domingo

test('los ocho tipos de preguntas llegan a su herramienta con sus argumentos', () => {
  const casos = [
    ['¿Cuánta yerba me queda?', 'stock_producto', { producto: 'yerba' }],
    ['¿Qué me está faltando?', 'faltantes', {}],
    ['¿Qué tengo que reponer?', 'reposicion', {}],
    ['¿Cuánta gaseosa salió esta semana?', 'salidas_producto', { producto: 'gaseosa', soloVentas: false, periodo: { desde: '2026-11-09', hasta: HOY } }],
    ['¿Qué fue lo más vendido este mes?', 'mas_salidas', { soloVentas: true, periodo: { desde: '2026-11-01', hasta: HOY } }],
    ['¿Qué no se vendió este mes?', 'sin_ventas', { periodo: { desde: '2026-11-01', hasta: HOY } }],
    ['¿Cuánto me aumentó la yerba en los últimos tres meses?', 'evolucion_precio', { producto: 'yerba', periodo: { dias: 90 } }],
    ['¿Qué otros productos me aumentaron más del 15 % este trimestre?', 'mayores_aumentos', { minimoPorcentaje: 15, periodo: { dias: 90 } }],
  ];
  assert.equal(new Set(casos.map((c) => c[1])).size, 8);
  for (const [pregunta, herramienta, argumentos] of casos) {
    const plan = planSimulado(pregunta, HOY);
    assert.deepEqual([plan.accion, plan.herramienta, plan.argumentos], ['herramienta', herramienta, argumentos], pregunta);
    assert.equal(argumentosSchema[herramienta].safeParse(plan.argumentos).success, true, pregunta);
  }
});

test('períodos nombrados: octubre y la semana pasada exactos; sin período, el valor por defecto', () => {
  assert.deepEqual(planSimulado('¿Qué fue lo más vendido en octubre?', HOY).argumentos.periodo, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(planSimulado('¿Cuánto vendí de gaseosa la semana pasada?', HOY).argumentos, {
    producto: 'gaseosa',
    soloVentas: true,
    periodo: { desde: '2026-11-02', hasta: '2026-11-08' },
  });
  assert.equal(planSimulado('¿Qué fue lo más vendido?', HOY).argumentos.periodo, undefined);
  assert.deepEqual(resolverPeriodo(undefined, 30, HOY), { desde: '2026-10-17', hasta: HOY, dias: 30 });
  assert.deepEqual(resolverPeriodo({ dias: 7 }, 30, HOY), { desde: '2026-11-09', hasta: HOY, dias: 7 });
  assert.deepEqual(resolverPeriodo({ desde: '2026-10-01', hasta: '2026-10-31' }, 30, HOY), { desde: '2026-10-01', hasta: '2026-10-31', dias: 31 });
  const rechaza = (periodo, motivo) => assert.throws(() => resolverPeriodo(periodo, 30, HOY), ErrorPeriodo, motivo);
  rechaza({ desde: '2026-02-30', hasta: '2026-03-10' }, 'fecha inexistente');
  rechaza({ desde: '2026-11-10', hasta: '2026-11-01' }, 'desde > hasta');
  rechaza({ desde: '2026-11-10', hasta: '2026-11-20' }, 'fecha futura');
  rechaza({ desde: '2025-01-01', hasta: '2026-01-01' }, 'más de 365 días');
  rechaza({ dias: 0 }, 'cero días');
  rechaza({ dias: 400 }, 'más de 365 días');
  // «en 2024» se traduce a un año que no es válido: se pedirá precisión, no se cambia.
  assert.deepEqual(planSimulado('¿Cuánta gaseosa salió en 2024?', HOY).argumentos.periodo, { desde: '2024-01-01', hasta: '2024-12-31' });
});

test('argumentos de las herramientas: valores por defecto y rechazos', () => {
  assert.deepEqual(argumentosSchema.mas_salidas.parse({}), { soloVentas: false, limite: 10 });
  const falla = (h, a) => assert.equal(argumentosSchema[h].safeParse(a).success, false, `${h} ${JSON.stringify(a)}`);
  falla('mas_salidas', { limite: 21 });
  falla('mas_salidas', { limite: 0 });
  falla('stock_producto', {});
  falla('stock_producto', { producto: 'y' });
  falla('stock_producto', { producto: 'yerba', sql: 'DROP' });
  falla('faltantes', { algo: 1 });
  falla('mayores_aumentos', { minimoPorcentaje: -5 });
  falla('salidas_producto', { producto: 'yerba', periodo: { mes: 'octubre' } });
  assert.deepEqual(HERRAMIENTAS_HABILITADAS.sort(), Object.keys(HERRAMIENTAS).sort());
  assert.equal(consultaSchema.safeParse({ pregunta: '   ' }).success, false);
  assert.equal(consultaSchema.safeParse({ pregunta: 'x'.repeat(501) }).success, false);
});

test('preguntas sin producto o fuera de alcance', () => {
  assert.equal(planSimulado('¿Cuánto aumentó?', HOY).accion, 'aclaracion');
  assert.equal(planSimulado('¿Cuál es el clima mañana?', HOY).accion, 'fuera_de_alcance');
  assert.throws(() => interpretarPlan('no es json'), /./);
  assert.throws(() => interpretarPlan(JSON.stringify({ accion: 'otra' })), /./);
});

test('resolución de productos: exacta, única, ambigua y sin coincidencia', () => {
  const activos = [
    { id: 1, nombre: 'Yerba mate con palo 1 kg' },
    { id: 2, nombre: 'Yerba mate sin palo 500 g' },
    { id: 3, nombre: 'Gaseosa cola 500 ml' },
  ];
  assert.equal(elegirProducto('gaseosa', activos).producto.id, 3);
  assert.equal(elegirProducto('Yerba mate con palo 1 kg', activos).producto.id, 1);
  assert.equal(elegirProducto('yerba sin palo', activos).producto.id, 2);
  assert.deepEqual(elegirProducto('yerba', activos).opciones.map((p) => p.id), [1, 2]);
  assert.deepEqual(elegirProducto('fideos', activos).opciones, []);
});

// Transacción simulada: devuelve filas fijas a $queryRaw.
const txCon = (filas) => ({ $queryRaw: async () => filas, $executeRawUnsafe: async () => {} });

test('más de 20 resultados: se muestran 20, se informa el total y los totales son del conjunto completo', async () => {
  const filas = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, nombre: `P${String(i + 1).padStart(2, '0')}`, unidadMedida: 'UNIDAD', cantidad: new Prisma.Decimal(30 - i) }));
  const r = await HERRAMIENTAS.mas_salidas.ejecutar({ soloVentas: false, limite: 20 }, { tx: txCon(filas), hoy: HOY });
  assert.equal(r.presentacion.filas.length, 20);
  assert.equal(r.presentacion.totalFilas, 25);
  assert.match(r.presentacion.nota, /Se muestran 20 de 25/);
  const total = filas.reduce((s, f) => s + f.cantidad.toNumber(), 0); // 30 + 29 + … + 6 = 450
  assert.equal(r.presentacion.totales['Total de salidas (todos)'], `${total.toLocaleString('es-AR')} u.`);
  assert.equal(r.presentacion.totales['Productos con movimiento'], 25);
  assert.deepEqual(limitar([1, 2, 3], 10), { filas: [1, 2, 3], totalFilas: 3, nota: null });
});

test('ventas y salidas se rotulan distinto', async () => {
  const filas = [{ id: 1, nombre: 'Gaseosa', unidadMedida: 'UNIDAD', cantidad: new Prisma.Decimal(5) }];
  const salidas = await HERRAMIENTAS.mas_salidas.ejecutar({ soloVentas: false, limite: 10 }, { tx: txCon(filas), hoy: HOY });
  const ventas = await HERRAMIENTAS.mas_salidas.ejecutar({ soloVentas: true, limite: 10 }, { tx: txCon(filas), hoy: HOY });
  assert.match(salidas.presentacion.titulo, /más salidas \(todas las causas\)/);
  assert.match(ventas.presentacion.titulo, /más vendidos/);
  assert.match(ventas.texto, /el más vendido/);
  assert.match(salidas.texto, /con más salidas/);
});

// --- Flujo del servicio con base, adaptador y reloj simulados ---------------

function entorno({ respuestas, demoras = [] }) {
  let ahora = 1_000_000;
  const llamadas = [];
  const registros = [];
  let transacciones = 0;
  const adaptador = {
    async planificar(args) {
      llamadas.push(args);
      ahora += demoras[llamadas.length - 1] ?? 10;
      const r = respuestas[llamadas.length - 1];
      if (r instanceof Error) throw r;
      return { texto: typeof r === 'string' ? r : JSON.stringify(r), modelo: 'falso' };
    },
  };
  const tx = { $executeRawUnsafe: async () => {}, alertaStock: { findMany: async () => [] } };
  const db = {
    $transaction: async (fn) => {
      transacciones += 1;
      return fn(tx);
    },
    consultaAgente: { create: async ({ data }) => (registros.push(data), { id: registros.length }) },
  };
  const deps = { db, adaptador, reloj: () => ahora, hoy: HOY, disponible: true, modelo: 'falso' };
  return { deps, llamadas, registros, transacciones: () => transacciones };
}
const usuario = { id: 1, rol: 'PROPIETARIO' };
const planFaltantes = { accion: 'herramienta', herramienta: 'faltantes', argumentos: {}, mensaje: null };

test('flujo: plan válido, herramienta, respuesta y registro; el adaptador no reintenta', async () => {
  const e = entorno({ respuestas: [planFaltantes] });
  const r = await consultar({ pregunta: '¿Qué me falta?', usuario }, e.deps);
  assert.equal(r.accion, 'respuesta');
  assert.match(r.respuesta, /No hay alertas/);
  assert.equal(e.llamadas[0].reintentos, false);
  assert.equal(e.llamadas[0].timeoutMs, PRESUPUESTO_MS);
  const reg = e.registros[0];
  assert.equal(reg.exitosa, true);
  assert.equal(reg.herramientas.herramienta.nombre, 'faltantes');
  assert.equal(reg.herramientas.planificador.intentos.length, 1);
  assert.ok(reg.duracionMs > 0);
});

test('flujo: JSON inválido se reintenta una vez; dos inválidos fallan y se registran', async () => {
  const bien = entorno({ respuestas: ['no es json', planFaltantes] });
  assert.equal((await consultar({ pregunta: 'x', usuario }, bien.deps)).accion, 'respuesta');
  assert.equal(bien.llamadas.length, 2);
  const mal = entorno({ respuestas: ['no', 'tampoco', planFaltantes] });
  const r = await consultar({ pregunta: 'x', usuario }, mal.deps);
  assert.equal(r.accion, 'error');
  assert.equal(mal.llamadas.length, 2, 'nunca más de 2 intentos');
  assert.equal(mal.registros[0].exitosa, false);
  assert.equal(mal.registros[0].herramientas.error, 'RESPUESTA_INVALIDA');
});

test('flujo: error del proveedor, herramienta no habilitada y argumentos inválidos quedan registrados como fallidos', async () => {
  const proveedor = entorno({ respuestas: [Object.assign(new Error('500'), { status: 500 })] });
  const r1 = await consultar({ pregunta: 'x', usuario }, proveedor.deps);
  assert.equal(r1.accion, 'error');
  assert.equal(proveedor.registros[0].herramientas.error, 'PROVEEDOR');

  const ajena = entorno({ respuestas: [{ accion: 'herramienta', herramienta: 'borrar_productos', argumentos: {}, mensaje: null }] });
  await consultar({ pregunta: 'x', usuario }, ajena.deps);
  assert.deepEqual(ajena.registros[0].herramientas.herramienta, { nombre: 'borrar_productos', rechazada: true, motivo: 'no habilitada' });
  assert.equal(ajena.registros[0].exitosa, false);
  assert.equal(ajena.transacciones(), 0, 'no se consultó nada');

  const args = entorno({ respuestas: [{ accion: 'herramienta', herramienta: 'stock_producto', argumentos: { producto: 'yerba', sql: 'x' }, mensaje: null }] });
  await consultar({ pregunta: 'x', usuario }, args.deps);
  assert.equal(args.registros[0].herramientas.herramienta.motivo, 'argumentos inválidos');
  assert.equal(args.transacciones(), 0);
});

test('presupuesto global de tiempo: compartido entre intentos y ejecución', async () => {
  // 25 s y JSON inválido: el segundo intento recibe como tope los 5 s restantes.
  const a = entorno({ respuestas: ['no', planFaltantes], demoras: [25_000, 100] });
  await consultar({ pregunta: 'x', usuario }, a.deps);
  assert.deepEqual(a.llamadas.map((l) => l.timeoutMs), [30_000, 5_000]);
  assert.ok(a.llamadas.every((l) => l.reintentos === false));

  // 31 s en el primer intento: no hay segundo y la consulta falla por tiempo.
  const b = entorno({ respuestas: ['no', planFaltantes], demoras: [31_000] });
  const rb = await consultar({ pregunta: 'x', usuario }, b.deps);
  assert.equal(b.llamadas.length, 1);
  assert.equal(rb.accion, 'error');
  assert.equal(b.registros[0].herramientas.error, 'TIEMPO');

  // Plan válido a los 29,9 s: no queda tiempo para la herramienta y no se ejecuta.
  const c = entorno({ respuestas: [planFaltantes], demoras: [29_900] });
  const rc = await consultar({ pregunta: 'x', usuario }, c.deps);
  assert.equal(rc.accion, 'error');
  assert.equal(c.transacciones(), 0);
  assert.equal(c.registros[0].herramientas.herramienta.omitida, true);
});

test('sin IA disponible: 503 y queda registrada como fallida', async () => {
  const e = entorno({ respuestas: [] });
  const r = await consultar({ pregunta: 'x', usuario }, { ...e.deps, disponible: false });
  assert.equal(r.estadoHttp, 503);
  assert.equal(e.llamadas.length, 0);
  assert.equal(e.registros[0].exitosa, false);
});

test('período imposible: se pide precisión, sin cambiarlo por otro', async () => {
  const e = entorno({
    respuestas: [{ accion: 'herramienta', herramienta: 'mas_salidas', argumentos: { periodo: { desde: '2024-01-01', hasta: '2024-12-31' } }, mensaje: null }],
  });
  const r = await consultar({ pregunta: '¿Qué salió más en 2024?', usuario }, e.deps);
  assert.equal(r.accion, 'aclaracion');
  assert.match(r.respuesta, /hasta 365 días/);
  assert.equal(e.registros[0].exitosa, true);
  assert.equal(e.registros[0].herramientas.herramienta.aclaracion, 'periodo');
});
