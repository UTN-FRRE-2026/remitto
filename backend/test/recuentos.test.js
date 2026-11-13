import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { analizarRecuento, resumir } from '../src/modules/recuentos/recuentos.service.js';
import { crearRecuentoSchema } from '../src/modules/recuentos/recuentos.schema.js';

const productos = new Map(
  [
    { id: 1, nombre: 'Gaseosa', activo: true, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('10.000') },
    { id: 2, nombre: 'Queso', activo: true, unidadMedida: 'KILOGRAMO', stockActual: new Prisma.Decimal('1.500') },
    { id: 3, nombre: 'Pan', activo: true, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('-2') },
    { id: 4, nombre: 'Viejo', activo: false, unidadMedida: 'UNIDAD', stockActual: new Prisma.Decimal('5') },
  ].map((p) => [p.id, p]),
);

test('recuento: calcula contado - registrado, incluidos faltantes, sobrantes y sin diferencia', () => {
  const r = analizarRecuento(
    [
      { productoId: 1, contado: 8, stockRegistrado: 10 },
      { productoId: 2, contado: 1.75, stockRegistrado: 1.5 },
      { productoId: 3, contado: 0, stockRegistrado: -2 },
    ],
    productos,
  );
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.cambios, []);
  assert.deepEqual(
    r.lineas.map((l) => [l.productoId, l.stockRegistrado.toNumber(), l.contado.toNumber(), l.diferencia.toNumber()]),
    [
      [1, 10, 8, -2],
      [2, 1.5, 1.75, 0.25],
      [3, -2, 0, 2],
    ],
  );
  // stockAnterior + diferencia = contado (criterio de HU14).
  for (const l of r.lineas) assert.ok(l.stockRegistrado.plus(l.diferencia).equals(l.contado));
});

test('recuento: la diferencia se calcula con decimales exactos', () => {
  const p = new Map([[9, { id: 9, nombre: 'Aceitunas', activo: true, unidadMedida: 'KILOGRAMO', stockActual: new Prisma.Decimal('0.3') }]]);
  const [l] = analizarRecuento([{ productoId: 9, contado: 0.1, stockRegistrado: 0.3 }], p).lineas;
  assert.equal(l.diferencia.toString(), '-0.2');
});

test('recuento: producto inexistente, desactivado y fracción de unidad', () => {
  const r = analizarRecuento(
    [
      { productoId: 99, contado: 1, stockRegistrado: 0 },
      { productoId: 4, contado: 5, stockRegistrado: 5 },
      { productoId: 1, contado: 9.5, stockRegistrado: 10 },
    ],
    productos,
  );
  assert.deepEqual(
    r.problemas.map((p) => [p.campo, p.productoId]),
    [
      ['lineas.0.productoId', 99],
      ['lineas.1.productoId', 4],
      ['lineas.2.contado', 1],
    ],
  );
  assert.match(r.problemas[0].mensaje, /no existe/);
  assert.match(r.problemas[1].mensaje, /desactivado/);
  assert.match(r.problemas[2].mensaje, /unidades enteras/);
});

test('recuento: si el stock cambió desde que se contó, se informa el stock actual', () => {
  const r = analizarRecuento(
    [
      { productoId: 1, contado: 8, stockRegistrado: 12 },
      { productoId: 2, contado: 1.5, stockRegistrado: 1.5 },
    ],
    productos,
  );
  assert.equal(r.cambios.length, 1);
  assert.equal(r.cambios[0].campo, 'lineas.0.ultimoMovimientoId');
  assert.equal(r.cambios[0].productoId, 1);
  assert.equal(r.cambios[0].stockActual, 10);
  assert.match(r.cambios[0].mensaje, /era 12 y ahora es 10/);
});

test('recuento: un reenvío ya aplicado se detecta como cambio y no se ajusta de nuevo', () => {
  // Primer envío: registrado 10, contado 8 → ajuste -2 y el stock queda en 8.
  const despues = new Map([[1, { ...productos.get(1), stockActual: new Prisma.Decimal('8') }]]);
  const r = analizarRecuento([{ productoId: 1, contado: 8, stockRegistrado: 10 }], despues);
  assert.equal(r.cambios.length, 1);
});

test('recuento: el stock cambió y volvió al mismo valor (ABA) → la versión lo detecta', () => {
  // Leído: stock 10, último movimiento #5. Después: ajuste a 12 (#6) y venta de 2 (#7) → stock 10 otra vez.
  const p = new Map([[1, { ...productos.get(1), stockActual: new Prisma.Decimal('10'), ultimoMovimientoId: 7 }]]);
  const r = analizarRecuento([{ productoId: 1, contado: 12, stockRegistrado: 10, ultimoMovimientoId: 5 }], p);
  assert.equal(r.cambios.length, 1);
  assert.equal(r.cambios[0].ultimoMovimientoId, 7);
  assert.match(r.cambios[0].mensaje, /tuvo movimientos mientras contabas \(el stock volvió a 10\)/);
  // Con la versión vigente se acepta.
  assert.equal(analizarRecuento([{ productoId: 1, contado: 12, stockRegistrado: 10, ultimoMovimientoId: 7 }], p).cambios.length, 0);
});

test('recuento: un producto sin movimientos tiene versión null', () => {
  const p = new Map([[1, { ...productos.get(1), ultimoMovimientoId: null }]]);
  assert.equal(analizarRecuento([{ productoId: 1, contado: 8, stockRegistrado: 10, ultimoMovimientoId: null }], p).cambios.length, 0);
  // Si apareció un movimiento después de leerlo, ya no coincide.
  const conMovimiento = new Map([[1, { ...productos.get(1), ultimoMovimientoId: 1 }]]);
  assert.equal(analizarRecuento([{ productoId: 1, contado: 8, stockRegistrado: 10, ultimoMovimientoId: null }], conMovimiento).cambios.length, 1);
});

test('resumen de diferencias', () => {
  const d = (x) => ({ diferencia: new Prisma.Decimal(x) });
  assert.deepEqual(resumir([d(-2), d(0.25), d(0), d(-1)]), {
    productos: 4,
    conDiferencia: 3,
    sinDiferencia: 1,
    faltantes: 2,
    sobrantes: 1,
  });
  assert.deepEqual(resumir([d(0)]), { productos: 1, conDiferencia: 0, sinDiferencia: 1, faltantes: 0, sobrantes: 0 });
});

test('esquema del recuento: datos válidos y valores por defecto', () => {
  const r = crearRecuentoSchema.parse({
    observacion: '  ',
    lineas: [
      { productoId: 1, contado: 0, stockRegistrado: -3, ultimoMovimientoId: null },
      { productoId: 2, contado: 1.25, stockRegistrado: 1.5, ultimoMovimientoId: 40 },
    ],
  });
  assert.equal(r.observacion, undefined);
  assert.equal(r.lineas.length, 2);
});

test('esquema del recuento: datos inválidos', () => {
  const falla = (d, campo) => {
    const r = crearRecuentoSchema.safeParse(d);
    assert.equal(r.success, false, JSON.stringify(d));
    assert.ok(r.error.issues.some((i) => i.path.join('.') === campo), `${campo}: ${JSON.stringify(r.error.issues)}`);
  };
  const ok = { productoId: 1, contado: 1, stockRegistrado: 1, ultimoMovimientoId: 3 };
  falla({ lineas: [] }, 'lineas');
  falla({ lineas: [{ ...ok, contado: -1 }] }, 'lineas.0.contado');
  falla({ lineas: [{ ...ok, contado: '2' }] }, 'lineas.0.contado');
  falla({ lineas: [{ ...ok, contado: 1.0001 }] }, 'lineas.0.contado');
  falla({ lineas: [{ productoId: 1, contado: 1, ultimoMovimientoId: 3 }] }, 'lineas.0.stockRegistrado');
  falla({ lineas: [{ productoId: 1, contado: 1, stockRegistrado: 1 }] }, 'lineas.0.ultimoMovimientoId');
  falla({ lineas: [{ ...ok, ultimoMovimientoId: 0 }] }, 'lineas.0.ultimoMovimientoId');
  falla({ lineas: [ok, { ...ok, contado: 2 }] }, 'lineas.1.productoId');
  falla({ lineas: [{ ...ok, cantidad: 1 }] }, 'lineas.0');
  falla({ lineas: [ok], usuarioId: 3 }, '');
});
