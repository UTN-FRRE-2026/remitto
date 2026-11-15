import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  tipoAlerta,
  evaluarAlertas,
  activarAlertas,
  ordenarActivas,
  contar,
} from '../src/modules/alertas/alertas.service.js';
import { estadoStock } from '../src/modules/productos/productos.service.js';
import { registrarMovimiento } from '../src/modules/stock/stock.service.js';
import { observarMovimientos } from '../src/modules/stock/stock.observadores.js';

test('tipo de alerta según stock y mínimo', () => {
  assert.equal(tipoAlerta(-1, 5), 'STOCK_NEGATIVO');
  assert.equal(tipoAlerta('-0.001', 0), 'STOCK_NEGATIVO');
  assert.equal(tipoAlerta(0, 5), 'SIN_STOCK');
  assert.equal(tipoAlerta(0, 0), 'SIN_STOCK');
  assert.equal(tipoAlerta('0.000', '0'), 'SIN_STOCK');
  assert.equal(tipoAlerta(3, 12), 'STOCK_BAJO');
  assert.equal(tipoAlerta(12, 12), 'STOCK_BAJO', 'en el mínimo ya es stock bajo, como en estadoStock');
  assert.equal(tipoAlerta('12.001', 12), null);
  assert.equal(tipoAlerta('0.5', '0.75'), 'STOCK_BAJO', 'kilos con decimales');
  assert.equal(tipoAlerta(5, 0), null, 'sin mínimo no hay stock bajo');
  assert.equal(tipoAlerta(5, null), null);
  assert.equal(tipoAlerta(-3, 5, false), null, 'un producto desactivado no tiene alerta');
});

test('las alertas coinciden con los indicadores del tablero (estadoStock)', () => {
  const valores = ['-2', '-0.001', '0', '0.001', '1', '5.5', '6', '6.001', '12', '100'];
  const minimos = ['0', '0.5', '6', '12'];
  for (const s of valores) {
    for (const m of minimos) {
      const tipo = tipoAlerta(s, m);
      const estado = estadoStock(s, m);
      const esperado = { STOCK_NEGATIVO: 'SIN_STOCK', SIN_STOCK: 'SIN_STOCK', STOCK_BAJO: 'STOCK_BAJO' }[tipo] ?? 'EN_STOCK';
      assert.equal(estado, esperado, `stock ${s}, mínimo ${m}`);
    }
  }
});

// Base simulada en memoria: un producto y su tabla de alertas, con la misma
// restricción que uq_alerta_activa (una ACTIVA por producto y tipo).
function baseFalsa({ stock = '0', minimo = '0', activo = true } = {}) {
  const fila = { stock_actual: new Prisma.Decimal(stock), stock_minimo: new Prisma.Decimal(minimo), activo };
  const alertas = [];
  const coincide = (a, where) =>
    Object.entries(where).every(([k, v]) => (k === 'id' ? v.in.includes(a.id) : a[k] === v));
  return {
    fila,
    alertas,
    $queryRaw: async () => [{ ...fila }],
    producto: {
      update: async ({ data }) => {
        fila.stock_actual = new Prisma.Decimal(data.stockActual);
      },
    },
    movimientoStock: { create: async ({ data }) => ({ id: 1, ...data }) },
    alertaStock: {
      findMany: async ({ where }) => alertas.filter((a) => coincide(a, where)).map((a) => ({ ...a })),
      updateMany: async ({ where, data }) => {
        const filas = alertas.filter((a) => coincide(a, where));
        filas.forEach((a) => Object.assign(a, data));
        return { count: filas.length };
      },
      create: async ({ data }) => {
        if (alertas.some((a) => a.productoId === data.productoId && a.tipo === data.tipo && a.estado === 'ACTIVA')) {
          throw new Error('uq_alerta_activa');
        }
        const nueva = { id: alertas.length + 1, estado: 'ACTIVA', resueltaEn: null, ...data };
        alertas.push(nueva);
        return nueva;
      },
    },
  };
}

const activas = (tx) => tx.alertas.filter((a) => a.estado === 'ACTIVA');

test('evaluar: abre una sola alerta y no la duplica', async () => {
  const tx = baseFalsa({ stock: '3', minimo: '12' });
  assert.equal(await evaluarAlertas(tx, 7), 'STOCK_BAJO');
  assert.equal(await evaluarAlertas(tx, 7), 'STOCK_BAJO');
  assert.equal(tx.alertas.length, 1);
  assert.equal(activas(tx)[0].tipo, 'STOCK_BAJO');
  assert.equal(activas(tx)[0].stockAlGenerar.toString(), '3');
});

test('evaluar: al cambiar de situación resuelve la anterior y abre la nueva', async () => {
  const tx = baseFalsa({ stock: '3', minimo: '12' });
  await evaluarAlertas(tx, 7);
  tx.fila.stock_actual = new Prisma.Decimal(0);
  const ahora = new Date('2026-11-15T12:00:00Z');
  assert.equal(await evaluarAlertas(tx, 7, ahora), 'SIN_STOCK');
  tx.fila.stock_actual = new Prisma.Decimal(-2);
  assert.equal(await evaluarAlertas(tx, 7, ahora), 'STOCK_NEGATIVO');
  assert.deepEqual(activas(tx).map((a) => a.tipo), ['STOCK_NEGATIVO']);
  assert.deepEqual(tx.alertas.map((a) => [a.tipo, a.estado]), [
    ['STOCK_BAJO', 'RESUELTA'],
    ['SIN_STOCK', 'RESUELTA'],
    ['STOCK_NEGATIVO', 'ACTIVA'],
  ]);
  assert.equal(tx.alertas[0].resueltaEn, ahora);
});

test('criterio: la alerta se resuelve sola al recuperarse el stock', async () => {
  const tx = baseFalsa({ stock: '0', minimo: '6' });
  await evaluarAlertas(tx, 7);
  tx.fila.stock_actual = new Prisma.Decimal(20);
  assert.equal(await evaluarAlertas(tx, 7), null);
  assert.equal(activas(tx).length, 0);
  assert.equal(tx.alertas[0].estado, 'RESUELTA');
  assert.ok(tx.alertas[0].resueltaEn instanceof Date);
});

test('evaluar: desactivar el producto resuelve su alerta; subir el mínimo la abre', async () => {
  const tx = baseFalsa({ stock: '0', minimo: '6' });
  await evaluarAlertas(tx, 7);
  tx.fila.activo = false;
  assert.equal(await evaluarAlertas(tx, 7), null);
  assert.equal(activas(tx).length, 0);

  const otro = baseFalsa({ stock: '10', minimo: '6' });
  assert.equal(await evaluarAlertas(otro, 7), null);
  otro.fila.stock_minimo = new Prisma.Decimal(10);
  assert.equal(await evaluarAlertas(otro, 7), 'STOCK_BAJO');
});

test('observador: cada movimiento de stock recalcula la alerta en la misma transacción', async () => {
  const desactivar = activarAlertas();
  try {
    activarAlertas(); // activarlo dos veces no duplica el observador
    const tx = baseFalsa({ stock: '10', minimo: '6' });
    tx.producto.update = async ({ data }) => {
      tx.fila.stock_actual = new Prisma.Decimal(data.stockActual);
    };
    // registrarMovimiento usa tx.producto.update: se lo da la base simulada.
    await registrarMovimiento(tx, { productoId: 7, tipo: 'SALIDA', motivo: 'VENTA', cantidad: -5 });
    assert.deepEqual(activas(tx).map((a) => a.tipo), ['STOCK_BAJO']);
    await registrarMovimiento(tx, { productoId: 7, tipo: 'SALIDA', motivo: 'VENTA', cantidad: -7 });
    assert.deepEqual(activas(tx).map((a) => a.tipo), ['STOCK_NEGATIVO']);
    await registrarMovimiento(tx, { productoId: 7, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 20 });
    assert.equal(activas(tx).length, 0);
    assert.equal(tx.alertas.length, 2, 'una alerta por cada situación, sin duplicados');
  } finally {
    desactivar();
  }
});

test('observador: si falla, el error llega a la transacción del movimiento', async () => {
  const quitar = observarMovimientos(async () => {
    throw new Error('falla del observador');
  });
  try {
    const tx = baseFalsa({ stock: '1' });
    await assert.rejects(
      registrarMovimiento(tx, { productoId: 7, tipo: 'SALIDA', motivo: 'VENTA', cantidad: -1 }),
      /falla del observador/,
    );
  } finally {
    quitar();
  }
});

test('listado: activas por gravedad y totales por tipo', () => {
  const lista = ordenarActivas([
    { id: 1, tipo: 'STOCK_BAJO', creadaEn: '2026-11-10' },
    { id: 2, tipo: 'SIN_STOCK', creadaEn: '2026-11-09' },
    { id: 3, tipo: 'STOCK_BAJO', creadaEn: '2026-11-12' },
    { id: 4, tipo: 'STOCK_NEGATIVO', creadaEn: '2026-11-01' },
  ]);
  assert.deepEqual(lista.map((a) => a.id), [4, 2, 3, 1]);
  assert.deepEqual(contar(lista), { total: 4, STOCK_NEGATIVO: 1, SIN_STOCK: 1, STOCK_BAJO: 2 });
});
