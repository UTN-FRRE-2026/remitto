import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cantidadSugerida, sugerir, inmovilizados } from '../src/modules/reportes/reportes.service.js';
import { sinMovimientoSchema, restarDias, hoyArgentina } from '../src/modules/reportes/reportes.schema.js';

const fila = (extra = {}) => ({
  id: 1,
  nombre: 'Yerba',
  unidadMedida: 'UNIDAD',
  stockActual: '2',
  stockMinimo: '8',
  stockDeseado: '24',
  categoriaNombre: 'Almacén',
  precioUnitario: '2850.00',
  proveedorId: 10,
  proveedor: 'Distribuidora Norte',
  ...extra,
});

// --- HU27: sugerencia de reposición ---

test('HU27: la cantidad sugerida lleva el producto a su stock deseado', () => {
  assert.equal(cantidadSugerida('2', '24', 'UNIDAD'), 22);
  assert.equal(cantidadSugerida('-3', '24', 'UNIDAD'), 27); // stock negativo: también lo repone
  // Unidades y paquetes enteros hacia arriba; kilos y litros con 3 decimales.
  assert.equal(cantidadSugerida('2.5', '10', 'PAQUETE'), 8);
  assert.equal(cantidadSugerida('1.2345', '5', 'KILOGRAMO'), 3.766);
  // Sin deseado o con un deseado que no supera el stock no hay cantidad.
  assert.equal(cantidadSugerida('2', null, 'UNIDAD'), null);
  assert.equal(cantidadSugerida('5', '5', 'UNIDAD'), null);
});

test('HU27: solo entran los productos en el mínimo o por debajo', () => {
  const r = sugerir([
    fila({ id: 1, stockActual: '2' }), // debajo del mínimo
    fila({ id: 2, nombre: 'Leche', stockActual: '8' }), // en el mínimo
    fila({ id: 3, nombre: 'Agua', stockActual: '9' }), // arriba del mínimo
    fila({ id: 4, nombre: 'Pan', stockActual: '0', stockMinimo: '0' }), // sin mínimo definido
  ]);
  assert.deepEqual(r.proveedores.flatMap((p) => p.productos.map((x) => x.id)).sort(), [1, 2]);
  assert.equal(r.productos, 2);
});

test('HU27: se agrupa por el último proveedor, con costo estimado al último precio', () => {
  const r = sugerir([
    fila({ id: 1, nombre: 'Yerba', stockActual: '2', precioUnitario: '2850.00' }), // pide 22
    fila({ id: 2, nombre: 'Azúcar', stockActual: '0', stockDeseado: '10', precioUnitario: '1000.505' }), // pide 10
    fila({ id: 3, nombre: 'Aceite', proveedorId: 20, proveedor: 'Mayorista Chaco', stockActual: '1', stockDeseado: '6', precioUnitario: '3000' }),
    fila({ id: 4, nombre: 'Fideos', proveedorId: null, proveedor: null, precioUnitario: null, stockActual: '0', stockDeseado: '12' }),
  ]);
  assert.deepEqual(r.proveedores.map((p) => p.nombre), ['Distribuidora Norte', 'Mayorista Chaco', 'Sin proveedor registrado']);
  const norte = r.proveedores[0];
  assert.deepEqual(norte.productos.map((p) => [p.nombre, p.cantidad, p.costo]), [
    ['Azúcar', 10, 10005.05],
    ['Yerba', 22, 62700],
  ]);
  assert.equal(norte.costo, 72705.05);
  assert.equal(r.costoEstimado, 72705.05 + 15000);
  // Sin precio: se sugiere la cantidad, pero no suma al costo.
  const sinProveedor = r.proveedores[2];
  assert.equal(sinProveedor.productos[0].cantidad, 12);
  assert.equal(sinProveedor.productos[0].costo, null);
  assert.equal(r.productosSinPrecio, 1);
});

test('HU27: sin stock deseado se informa aparte para completarlo', () => {
  const r = sugerir([fila({ stockDeseado: null }), fila({ id: 2, nombre: 'Leche', stockActual: '3', stockDeseado: '3' })]);
  assert.equal(r.productos, 0);
  assert.deepEqual(r.sinDeseado.map((p) => p.nombre), ['Leche', 'Yerba']);
});

// --- HU29: productos sin movimiento ---

test('HU29: valor a último precio, días desde la última salida y orden por capital inmovilizado', () => {
  const hasta = new Date('2026-11-15T03:00:00Z'); // fin del 14/11 en Argentina
  const r = inmovilizados(
    [
      fila({ id: 1, nombre: 'Yerba', stockActual: '10', precioUnitario: '100', ultimaSalida: '2026-10-15T15:00:00Z' }),
      fila({ id: 2, nombre: 'Aceite', stockActual: '4', precioUnitario: '1000', ultimaSalida: null }),
      fila({ id: 3, nombre: 'Fideos', stockActual: '7', precioUnitario: null, ultimaSalida: null }),
    ],
    { hasta },
  );
  assert.deepEqual(r.productos.map((p) => [p.nombre, p.valor]), [
    ['Aceite', 4000],
    ['Yerba', 1000],
    ['Fideos', null],
  ]);
  assert.equal(r.valorTotal, 5000);
  assert.equal(r.productosSinPrecio, 1);
  assert.equal(r.productos[1].diasSinSalida, 30);
  assert.equal(r.productos[0].diasSinSalida, null); // nunca salió
});

test('HU29: el período por defecto son los últimos 30 días, hoy incluido', () => {
  const hoy = hoyArgentina();
  assert.deepEqual(sinMovimientoSchema.parse({}), { desde: restarDias(hoy, 29), hasta: hoy });
  assert.deepEqual(sinMovimientoSchema.parse({ hasta: '2026-11-14' }), { desde: '2026-10-16', hasta: '2026-11-14' });
  assert.deepEqual(sinMovimientoSchema.parse({ desde: '2026-09-01', hasta: '2026-09-30' }), { desde: '2026-09-01', hasta: '2026-09-30' });
  assert.equal(sinMovimientoSchema.safeParse({ desde: '2026-11-10', hasta: '2026-11-01' }).success, false);
  assert.equal(sinMovimientoSchema.safeParse({ desde: '2026-02-30' }).success, false);
  assert.equal(sinMovimientoSchema.safeParse({ otro: '1' }).success, false);
  assert.equal(restarDias('2026-03-01', 1), '2026-02-28');
});
