import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aMilesimas,
  generarVentas,
  cuerpoVenta,
  stockEsperado,
  compararStock,
  simular,
  verificarRespuestas,
  segundosDeEspera,
} from '../../simulador/simulador.mjs';
import { ventaSchema } from '../src/modules/integracion/integracion.schema.js';

// HU23: simulador de ventas (simulador/simulador.mjs).
const catalogo = [
  { productoId: 11, codigoBarras: 'SIM-1', unidadMedida: 'UNIDAD' },
  { productoId: 12, codigoBarras: 'SIM-2', unidadMedida: 'UNIDAD' },
  { productoId: 13, codigoBarras: 'SIM-3', unidadMedida: 'KILOGRAMO' },
];

test('milésimas exactas desde el texto decimal, sin pasar por Number', () => {
  assert.equal(aMilesimas('0.1'), 100);
  assert.equal(aMilesimas('1.255'), 1255);
  assert.equal(aMilesimas('-2'), -2000);
  assert.equal(aMilesimas('500.000'), 500000);
  assert.equal(aMilesimas('8.7450'), 8745);
  assert.equal(aMilesimas('-0.000'), 0);
  assert.throws(() => aMilesimas('1.2345'));
  assert.throws(() => aMilesimas('1e3'));
});

test('ventas reproducibles: misma semilla, mismas ventas; otra semilla, otras', () => {
  const a = generarVentas({ semilla: 2026, catalogo });
  const b = generarVentas({ semilla: 2026, catalogo });
  const c = generarVentas({ semilla: 7, catalogo });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.ventas.map((v) => v.lineas), c.ventas.map((v) => v.lineas));
});

test('120 ventas distintas y 30 reenvíos de ventas existentes con el mismo contenido', () => {
  const { ventas, tandas } = generarVentas({ semilla: 2026, catalogo });
  assert.equal(ventas.length, 120);
  assert.equal(new Set(ventas.map((v) => v.referencia)).size, 120);
  const envios = tandas.flat();
  assert.equal(envios.length, 150);
  assert.equal(envios.filter((e) => e.tipo === 'primero').length, 120);
  const reenvios = envios.filter((e) => e.tipo === 'reenvio');
  assert.equal(reenvios.length, 30);
  // Cada reenvío es una venta ya generada (mismo objeto: misma referencia y líneas).
  assert.ok(reenvios.every((e) => ventas.includes(e.venta)));
  assert.ok(reenvios.some((e) => e.invertir), 'algunos reenvíos invierten el orden de las líneas');
  // La mitad sale en la misma tanda que su primer envío.
  const enParalelo = reenvios.filter((e) => tandas.some((t) => t.includes(e) && t.some((o) => o.tipo === 'primero' && o.venta === e.venta)));
  assert.equal(enParalelo.length, 15);
  // Cantidades: enteras (múltiplos de 1000) por unidad; hasta 2,5 kg por kilo.
  for (const l of ventas.flatMap((v) => v.lineas)) {
    const p = catalogo.find((c) => c.productoId === l.productoId || c.codigoBarras === l.codigoBarras);
    assert.ok(Number.isInteger(l.milesimas) && l.milesimas > 0);
    if (p.unidadMedida === 'UNIDAD') assert.equal(l.milesimas % 1000, 0);
    else assert.ok(l.milesimas <= 2500);
  }
  // Se usan los dos identificadores y hay ventas que repiten un producto.
  const lineas = ventas.flatMap((v) => v.lineas);
  assert.ok(lineas.some((l) => l.codigoBarras) && lineas.some((l) => l.productoId));
  assert.ok(ventas.some((v) => new Set(v.lineas.map((l) => l.productoId ?? l.codigoBarras)).size < v.lineas.length));
});

test('el cuerpo del pedido es válido para HU22 y conserva referencia y contenido', () => {
  const { ventas } = generarVentas({ semilla: 2026, catalogo });
  for (const v of ventas) {
    const cuerpo = cuerpoVenta(v);
    assert.equal(ventaSchema.safeParse(cuerpo).success, true, v.referencia);
    assert.deepEqual(cuerpoVenta(v, { invertir: true }).lineas, [...cuerpo.lineas].reverse());
  }
});

test('stock esperado: cada referencia una vez, con aritmética exacta', () => {
  const inicial = new Map([[11, 500000], [12, 500000], [13, 500000]]);
  const venta = { referencia: 'A', lineas: [{ codigoBarras: 'SIM-1', milesimas: 1000 }, { productoId: 11, milesimas: 2000 }, { productoId: 13, milesimas: 125 }] };
  const esperado = stockEsperado(inicial, [venta, venta, { ...venta }], catalogo);
  assert.deepEqual([...esperado], [[11, 497000], [12, 500000], [13, 499875]]);
  // Contar los reenvíos sí cambia el resultado: la comparación lo detectaría.
  const contandoDos = stockEsperado(inicial, [venta, { ...venta, referencia: 'A-BIS' }], catalogo);
  assert.deepEqual(compararStock(esperado, contandoDos).map((d) => [d.productoId, d.diferencia]), [[11, -3000], [13, -125]]);
  // 0,1 + 0,2 cien veces: en milésimas es exacto (con Number no lo sería).
  const muchas = Array.from({ length: 100 }, (_, i) => ({
    referencia: `M-${i}`,
    lineas: [{ productoId: 13, milesimas: aMilesimas('0.1') }, { productoId: 13, milesimas: aMilesimas('0.2') }],
  }));
  assert.equal(stockEsperado(new Map([[13, 30000]]), muchas, catalogo).get(13), 0);
  assert.throws(() => stockEsperado(inicial, [{ referencia: 'X', lineas: [{ codigoBarras: 'OTRO', milesimas: 1 }] }], catalogo));
});

// fetch simulado: responde según una lista de estados y registra los pedidos.
function fetchFalso(respuestas) {
  const pedidos = [];
  const fetch = async (url, opciones) => {
    pedidos.push({ url, cuerpo: opciones.body, autorizacion: opciones.headers.Authorization });
    const r = respuestas.shift();
    return {
      status: r.status,
      headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? r.retryAfter ?? null : null) },
      json: async () => r.body ?? {},
    };
  };
  return { fetch, pedidos };
}
const unaVenta = { referencia: 'R-1', lineas: [{ codigoBarras: 'SIM-1', milesimas: 2000 }] };

test('reintento: 503 con Retry-After y después 201 → dos intentos, una venta, misma petición', async () => {
  const { fetch, pedidos } = fetchFalso([
    { status: 503, retryAfter: '2' },
    { status: 201, body: { id: 9, repetida: false } },
  ]);
  const esperas = [];
  const r = await simular({ base: 'http://x/api', clave: 'k', tandas: [[{ venta: unaVenta, tipo: 'primero' }]], fetch, esperar: async (ms) => esperas.push(ms) });
  assert.equal(r.intentosHttp, 2);
  assert.equal(r.enviosLogicos, 1);
  assert.equal(r.ventasUnicas, 1);
  assert.deepEqual(r.incompletos, []);
  assert.deepEqual(esperas, [2000]);
  assert.equal(pedidos[0].cuerpo, pedidos[1].cuerpo, 'misma referencia y contenido');
  assert.equal(JSON.parse(pedidos[1].cuerpo).referencia, 'R-1');
  assert.equal(pedidos[0].url, 'http://x/api/v1/integracion/salidas');
  assert.deepEqual(verificarRespuestas(r.registros), []);
});

test('reintento: 503 sin fin agota el límite y el envío queda incompleto', async () => {
  const { fetch, pedidos } = fetchFalso(Array.from({ length: 4 }, () => ({ status: 503 })));
  const esperas = [];
  const r = await simular({ base: 'http://x/api', clave: 'k', tandas: [[{ venta: unaVenta, tipo: 'primero' }]], fetch, esperar: async (ms) => esperas.push(ms) });
  assert.equal(pedidos.length, 4, 'un intento y 3 reintentos');
  assert.deepEqual(esperas, [1000, 1000, 1000], 'sin Retry-After espera 1 s');
  assert.equal(r.incompletos.length, 1);
  assert.equal(r.incompletos[0].status, 503);
  assert.equal(segundosDeEspera('abc'), 1);
  assert.equal(segundosDeEspera('3'), 3);
});

test('respuestas por referencia: un 201, el resto 200 repetida con el mismo id', () => {
  const bien = [
    { referencia: 'A', status: 200, repetida: true, id: 1 },
    { referencia: 'A', status: 201, repetida: false, id: 1 },
    { referencia: 'B', status: 201, repetida: false, id: 2 },
  ];
  assert.deepEqual(verificarRespuestas(bien), []);
  assert.equal(verificarRespuestas([...bien, { referencia: 'B', status: 201, repetida: false, id: 2 }]).length, 1, 'dos 201');
  assert.equal(verificarRespuestas([...bien, { referencia: 'B', status: 200, repetida: true, id: 7 }]).length, 1, 'otro id');
  assert.equal(verificarRespuestas([...bien, { referencia: 'C', status: 201, repetida: false, id: 1 }]).length, 1, 'id compartido');
  assert.equal(verificarRespuestas([...bien, { referencia: 'B', status: 409, id: null }]).length, 2, 'un reenvío rechazado');
});
