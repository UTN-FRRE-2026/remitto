import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { pendientesPorEstado, paraReponer, tablero, ESTADOS_PENDIENTES } from '../src/modules/tablero/tablero.service.js';

// HU26: tablero de situación.

test('pendientes: los cuatro estados con ceros; confirmados y anulados no cuentan', () => {
  assert.deepEqual(ESTADOS_PENDIENTES, ['PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'ERROR']);
  assert.deepEqual(pendientesPorEstado([]), { total: 0, porEstado: { PENDIENTE: 0, PROCESANDO: 0, EN_REVISION: 0, ERROR: 0 } });
  const r = pendientesPorEstado([
    { estado: 'EN_REVISION', cantidad: 3 },
    { estado: 'ERROR', cantidad: 1 },
    { estado: 'CONFIRMADO', cantidad: 40 },
    { estado: 'ANULADO', cantidad: 2 },
    { estado: 'PENDIENTE', cantidad: 2n },
  ]);
  assert.deepEqual(r, { total: 6, porEstado: { PENDIENTE: 2, PROCESANDO: 0, EN_REVISION: 3, ERROR: 1 } });
});

test('para reponer: primero sin stock, después stock bajo, hasta cuatro y sin costos', () => {
  const p = (id, estadoStock) => ({ id, nombre: `P${id}`, categoria: null, unidadMedida: 'UNIDAD', stockActual: 1, stockMinimo: 5, estadoStock, precio: 99 });
  const r = paraReponer([p(1, 'STOCK_BAJO'), p(2, 'EN_STOCK'), p(3, 'SIN_STOCK'), p(4, 'STOCK_BAJO'), p(5, 'SIN_STOCK'), p(6, 'STOCK_BAJO')]);
  assert.deepEqual(r.map((x) => x.id), [3, 5, 1, 4]);
  assert.ok(r.every((x) => !('precio' in x)));
});

// Base simulada: registra cada acceso y devuelve datos fijos.
function baseFalsa() {
  const registro = { opciones: null, raw: [], modelos: [] };
  const decimal = (v) => new Prisma.Decimal(v);
  const producto = (id, stock, minimo) => ({
    id, nombre: `P${id}`, descripcion: null, codigoBarras: null, categoriaId: null, categoria: null, unidadMedida: 'UNIDAD',
    stockActual: decimal(stock), stockMinimo: decimal(minimo), stockDeseado: null, activo: true, creadoEn: new Date(0),
  });
  const modelo = (nombre, respuestas) =>
    new Proxy({}, { get: (_, metodo) => async () => { registro.modelos.push(`${nombre}.${String(metodo)}`); return respuestas[metodo]; } });
  const tx = {
    $executeRawUnsafe: async (sql) => registro.raw.push(sql),
    $queryRaw: async (strings) => {
      const sql = strings.join('?');
      registro.raw.push(sql);
      if (sql.includes('now() AS "generadoEn"') && !sql.includes('FROM productos')) return [{ generadoEn: new Date('2026-11-15T12:00:00Z') }];
      if (sql.includes('FROM productos p')) {
        return [{ id: 1, nombre: 'P1', unidadMedida: 'UNIDAD', stockActual: decimal(10), categoriaId: null, categoriaNombre: null, precioUnitario: decimal(100), fechaVigencia: new Date(), proveedor: 'X', generadoEn: new Date() }];
      }
      return [];
    },
    producto: modelo('producto', { findMany: [producto(1, 10, 2), producto(2, 0, 3), producto(3, 1, 3)] }),
    alertaStock: modelo('alertaStock', {
      findMany: [
        { id: 7, tipo: 'SIN_STOCK', creadaEn: new Date(), producto: producto(2, 0, 3) },
        { id: 8, tipo: 'STOCK_BAJO', creadaEn: new Date(), producto: producto(3, 1, 3) },
      ],
    }),
    comprobante: modelo('comprobante', { groupBy: [{ estado: 'ERROR', _count: { _all: 1 } }], findMany: [] }),
  };
  const db = {
    $transaction: async (fn, opciones) => {
      registro.opciones = opciones;
      return fn(tx);
    },
  };
  return { db, registro };
}

test('una sola transacción REPEATABLE READ de solo lectura; todo se lee por ella', async () => {
  const { db, registro } = baseFalsa();
  const r = await tablero({ rol: 'PROPIETARIO' }, db);
  assert.equal(registro.opciones.isolationLevel, 'RepeatableRead');
  assert.equal(registro.raw[0], 'SET TRANSACTION READ ONLY');
  assert.ok(registro.modelos.includes('producto.findMany') && registro.modelos.includes('alertaStock.findMany') && registro.modelos.includes('comprobante.groupBy'));
  assert.deepEqual(r.stock, { totalProductos: 3, enStock: 1, stockBajo: 1, sinStock: 1 });
  assert.deepEqual(r.alertas.totales, { total: 2, STOCK_NEGATIVO: 0, SIN_STOCK: 1, STOCK_BAJO: 1 });
  assert.equal(r.comprobantes.total, 1);
  assert.deepEqual(r.reponer.map((p) => p.id), [2, 3]);
  assert.deepEqual(r.valorStock, { total: 1000, productosValorizados: 1, productosSinPrecio: 0, productosStockNegativo: 0 });
});

test('el empleado no recibe el valor del stock ni se calcula', async () => {
  const { db, registro } = baseFalsa();
  const r = await tablero({ rol: 'EMPLEADO' }, db);
  assert.equal('valorStock' in r, false);
  assert.ok(!registro.raw.some((sql) => sql.includes('precios_compra')), 'no se consultan precios');
});

test('solo para pruebas: otro aislamiento y una acción entre lecturas', async () => {
  const { db, registro } = baseFalsa();
  let corrio = false;
  await tablero({ rol: 'EMPLEADO' }, db, { aislamiento: 'ReadCommitted', entreLecturas: async () => (corrio = true) });
  assert.equal(registro.opciones.isolationLevel, 'ReadCommitted');
  assert.ok(corrio);
});
