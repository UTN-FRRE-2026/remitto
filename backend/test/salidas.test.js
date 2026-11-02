import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { problemasDelCarrito, mapearSalida } from '../src/modules/salidas/salidas.service.js';
import { crearSalidaSchema } from '../src/modules/salidas/salidas.schema.js';

const productos = new Map(
  [
    { id: 1, nombre: 'Gaseosa', activo: true, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('10.000') },
    { id: 2, nombre: 'Queso', activo: true, unidadMedida: 'KILOGRAMO', stockActual: new Prisma.Decimal('1.500') },
    { id: 3, nombre: 'Pan', activo: true, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('0') },
    { id: 4, nombre: 'Viejo', activo: false, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('5') },
  ].map((p) => [p.id, p]),
);

test('carrito válido: todo el stock disponible se puede sacar', () => {
  assert.deepEqual(problemasDelCarrito([{ productoId: 1, cantidad: 10 }, { productoId: 2, cantidad: 1.5 }], productos), []);
});

test('carrito: stock insuficiente, sin stock, inactivo, inexistente y fracción de unidad', () => {
  const r = problemasDelCarrito(
    [
      { productoId: 1, cantidad: 11 },
      { productoId: 3, cantidad: 1 },
      { productoId: 4, cantidad: 1 },
      { productoId: 99, cantidad: 1 },
      { productoId: 1, cantidad: 1.5 },
      { productoId: 2, cantidad: 1.501 },
    ],
    productos,
  );
  assert.deepEqual(
    r.map((p) => [p.campo, p.productoId]),
    [
      ['lineas.0.cantidad', 1],
      ['lineas.1.cantidad', 3],
      ['lineas.2.cantidad', 4],
      ['lineas.3.cantidad', 99],
      ['lineas.4.cantidad', 1],
      ['lineas.5.cantidad', 2],
    ],
  );
  assert.match(r[0].mensaje, /hay 10 y se quieren sacar 11/);
  assert.match(r[1].mensaje, /No hay stock de Pan/);
  assert.match(r[2].mensaje, /desactivado/);
  assert.match(r[3].mensaje, /no existe/);
  assert.match(r[4].mensaje, /unidades enteras/);
  assert.match(r[5].mensaje, /hay 1,5 y se quieren sacar 1,501/);
});

test('respuesta de la salida: cantidades positivas y stock antes/después', () => {
  const s = mapearSalida({
    id: 5,
    origen: 'CARRITO',
    motivo: 'VENTA',
    observacion: null,
    registradaEn: new Date('2026-11-02T15:00:00Z'),
    usuario: { id: 1, nombre: 'Carlos' },
    claveIntegracion: null,
    movimientos: [
      { cantidad: '-3.000', stockAnterior: '10.000', producto: { id: 1, nombre: 'Gaseosa', unidadMedida: 'UNIDAD' } },
      { cantidad: '-0.200', stockAnterior: '1.500', producto: { id: 2, nombre: 'Queso', unidadMedida: 'KILOGRAMO' } },
    ],
  });
  assert.deepEqual(
    s.lineas.map((l) => [l.cantidad, l.stockAnterior, l.stockNuevo]),
    [
      [3, 10, 7],
      [0.2, 1.5, 1.3],
    ],
  );
  assert.equal(s.totalCantidad, 3.2);
  assert.equal(s.integracion, null);
});

test('esquema: valores por defecto', () => {
  const r = crearSalidaSchema.parse({ lineas: [{ productoId: 1, cantidad: 2 }], observacion: '  ' });
  assert.equal(r.motivo, 'VENTA');
  assert.equal(r.observacion, undefined);
  assert.deepEqual(r.lineas, [{ productoId: 1, cantidad: 2 }]);
});

test('esquema: datos inválidos', () => {
  const falla = (d, campo) => {
    const r = crearSalidaSchema.safeParse(d);
    assert.equal(r.success, false, JSON.stringify(d));
    assert.ok(r.error.issues.some((i) => i.path.join('.') === campo), `${campo}: ${JSON.stringify(r.error.issues)}`);
  };
  const l = [{ productoId: 1, cantidad: 1 }];
  falla({ lineas: [] }, 'lineas');
  falla({ lineas: [{ productoId: 1, cantidad: 0 }] }, 'lineas.0.cantidad');
  falla({ lineas: [{ productoId: 1, cantidad: '2' }] }, 'lineas.0.cantidad');
  falla({ lineas: [{ productoId: 1, cantidad: 1.0001 }] }, 'lineas.0.cantidad');
  falla({ lineas: [{ productoId: 1, cantidad: 1 }, { productoId: 1, cantidad: 2 }] }, 'lineas.1.productoId');
  falla({ motivo: 'COMPRA', lineas: l }, 'motivo');
  falla({ motivo: 'RECUENTO', lineas: l }, 'motivo');
  falla({ motivo: 'OTRO', lineas: l }, 'observacion');
  falla({ idOperacion: 'abc', lineas: l }, 'idOperacion');
  falla({ lineas: l, usuarioId: 3 }, '');
  assert.equal(crearSalidaSchema.safeParse({ motivo: 'OTRO', observacion: 'Donación', lineas: l }).success, true);
});
