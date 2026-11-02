import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoFechas, mapearMovimiento } from '../src/modules/movimientos/movimientos.service.js';
import { listarMovimientosSchema } from '../src/modules/movimientos/movimientos.schema.js';

const base = (extra = {}) => ({
  id: 7,
  fecha: new Date('2026-11-02T15:00:00Z'),
  tipo: 'ENTRADA',
  motivo: 'COMPRA',
  cantidad: '12.000',
  stockAnterior: '5.000',
  observacion: 'Comprobante #3',
  producto: { id: 1, nombre: 'Yerba', unidadMedida: 'UNIDAD' },
  usuario: { id: 2, nombre: 'Carlos' },
  detalleComprobante: null,
  salida: null,
  ...extra,
});

test('rango de fechas: días de Argentina, "hasta" inclusivo', () => {
  assert.equal(rangoFechas(), undefined);
  const r = rangoFechas('2026-11-01', '2026-11-02');
  assert.equal(r.gte.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(r.lt.toISOString(), '2026-11-03T03:00:00.000Z');
  assert.deepEqual(Object.keys(rangoFechas(undefined, '2026-12-31')), ['lt']);
  assert.equal(rangoFechas(undefined, '2026-12-31').lt.toISOString(), '2027-01-01T03:00:00.000Z');
});

test('movimiento de entrada: stock nuevo y comprobante de origen', () => {
  const m = mapearMovimiento(
    base({
      detalleComprobante: {
        comprobante: { id: 3, tipo: 'REMITO', numero: '0001-00000123', proveedor: { razonSocial: 'Distribuidora Norte' } },
      },
    }),
  );
  assert.equal(m.cantidad, 12);
  assert.equal(m.stockAnterior, 5);
  assert.equal(m.stockNuevo, 17);
  assert.deepEqual(m.origen, {
    tipo: 'COMPROBANTE',
    id: 3,
    tipoComprobante: 'REMITO',
    numero: '0001-00000123',
    proveedor: 'Distribuidora Norte',
  });
});

test('movimiento de salida y de ajuste: signo y origen', () => {
  const salida = mapearMovimiento(
    base({ tipo: 'SALIDA', motivo: 'VENTA', cantidad: '-3', stockAnterior: '17', salida: { id: 9, origen: 'CARRITO', claveIntegracion: null } }),
  );
  assert.equal(salida.stockNuevo, 14);
  assert.deepEqual(salida.origen, { tipo: 'SALIDA', id: 9, origenSalida: 'CARRITO', integracion: null });

  const ajuste = mapearMovimiento(base({ tipo: 'AJUSTE', motivo: 'RECUENTO', cantidad: '-0.250', stockAnterior: '1.5', usuario: null }));
  assert.equal(ajuste.stockNuevo, 1.25);
  assert.equal(ajuste.usuario, null);
  assert.deepEqual(ajuste.origen, { tipo: 'AJUSTE' });
});

test('decimales sin error de coma flotante', () => {
  const m = mapearMovimiento(base({ cantidad: '0.200', stockAnterior: '0.100' }));
  assert.equal(m.stockNuevo, 0.3);
});

test('filtros: valores por defecto y conversión de tipos', () => {
  const r = listarMovimientosSchema.parse({ productoId: '4', tipo: 'SALIDA' });
  assert.deepEqual(r, { productoId: 4, tipo: 'SALIDA', pagina: 1, limite: 30 });
});

test('filtros inválidos', () => {
  const falla = (q) => assert.equal(listarMovimientosSchema.safeParse(q).success, false, JSON.stringify(q));
  falla({ tipo: 'VENTA' });
  falla({ desde: '02/11/2026' });
  falla({ desde: '2026-02-30' });
  falla({ desde: '2026-11-05', hasta: '2026-11-01' });
  falla({ limite: '500' });
  falla({ pagina: '0' });
  falla({ otro: 'x' });
  assert.equal(listarMovimientosSchema.safeParse({ desde: '2026-11-01', hasta: '2026-11-01' }).success, true);
});
