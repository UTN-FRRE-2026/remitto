import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { valorizar } from '../src/modules/reportes/reportes.service.js';

const bebidas = { id: 1, nombre: 'Bebidas' };
const almacen = { id: 2, nombre: 'Almacén' };
const producto = (id, nombre, stockActual, categoria, unidadMedida = 'UNIDAD') => ({
  id,
  nombre,
  unidadMedida,
  stockActual: new Prisma.Decimal(stockActual),
  categoria,
});
const precio = (precioUnitario, proveedor = 'Distribuidora Norte', fechaVigencia = new Date('2026-11-01')) => ({
  precioUnitario: new Prisma.Decimal(precioUnitario),
  fechaVigencia,
  proveedor,
});

// Suma en centavos enteros: si el total coincide así, coincide exacto.
const centavos = (x) => Math.round(x * 100);

test('valoriza stock × último precio y agrupa por categoría', () => {
  const r = valorizar(
    [
      producto(1, 'Gaseosa cola 500 ml', '58', bebidas),
      producto(2, 'Agua sin gas 1,5 l', '27', bebidas),
      producto(3, 'Yerba mate 1 kg', '12', almacen),
      producto(4, 'Queso', '1.5', almacen, 'KILOGRAMO'),
    ],
    new Map([
      [1, precio('690')],
      [2, precio('540.50')],
      [3, precio('2850')],
      [4, precio('8999.99', 'Lácteos del Litoral')],
    ]),
  );
  assert.equal(r.productosValorizados, 4);
  const [b, a] = [r.categorias.find((c) => c.nombre === 'Bebidas'), r.categorias.find((c) => c.nombre === 'Almacén')];
  assert.equal(b.valor, 58 * 690 + 27 * 540.5); // 40020 + 14593,5
  assert.equal(a.valor, 34200 + 13499.99); // 1,5 × 8999,99 = 13499,985 → 13499,99
  assert.equal(r.total, 102313.49);
  assert.equal(centavos(r.total), centavos(b.valor) + centavos(a.valor));
  assert.deepEqual(
    a.productos.map((p) => [p.nombre, p.ultimoPrecio, p.valor, p.proveedor]),
    [
      ['Yerba mate 1 kg', 2850, 34200, 'Distribuidora Norte'],
      ['Queso', 8999.99, 13499.99, 'Lácteos del Litoral'],
    ],
  );
  // Mayor valor primero y porcentajes del total.
  assert.deepEqual(r.categorias.map((c) => c.nombre), ['Bebidas', 'Almacén']);
  assert.equal(Math.round((b.porcentaje + a.porcentaje) * 10) / 10, 100);
});

test('criterio: los productos sin precio se informan aparte y no suman al total', () => {
  const r = valorizar(
    [producto(1, 'Gaseosa', '10', bebidas), producto(2, 'Pan lactal', '4', null), producto(3, 'Alfajor', '6', almacen)],
    new Map([[1, precio('100')]]),
  );
  assert.equal(r.total, 1000);
  assert.equal(r.productosValorizados, 1);
  assert.deepEqual(
    r.sinPrecio.map((p) => [p.nombre, p.stockActual, p.categoria]),
    [
      ['Alfajor', 6, 'Almacén'],
      ['Pan lactal', 4, 'Sin categoría'],
    ],
  );
  assert.deepEqual(r.categorias.map((c) => c.nombre), ['Bebidas']);
});

test('sin stock o con stock negativo no se valoriza ni figura sin precio', () => {
  const r = valorizar(
    [producto(1, 'Agotado', '0', bebidas), producto(2, 'Negativo', '-3', bebidas), producto(3, 'Sin precio y sin stock', '0', null)],
    new Map([[1, precio('100')], [2, precio('100')]]),
  );
  assert.deepEqual(r, { total: 0, productosValorizados: 0, categorias: [], sinPrecio: [] });
});

test('productos sin categoría forman su propio grupo', () => {
  const r = valorizar([producto(1, 'Suelto', '2', null)], new Map([[1, precio('50')]]));
  assert.deepEqual(r.categorias.map((c) => [c.id, c.nombre, c.valor, c.porcentaje]), [[null, 'Sin categoría', 100, 100]]);
});

test('criterio: el total coincide con la suma por categoría (casos generados con redondeo)', () => {
  // Generador determinístico: stocks con 3 decimales y precios con centavos,
  // que obligan a redondear cada producto.
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };
  const categorias = [bebidas, almacen, { id: 3, nombre: 'Lácteos' }, null];
  for (let caso = 0; caso < 200; caso += 1) {
    const productos = [];
    const precios = new Map();
    for (let i = 1; i <= 30; i += 1) {
      productos.push(producto(i, `P${i}`, (Math.floor(azar() * 100000) / 1000).toFixed(3), categorias[i % 4], 'KILOGRAMO'));
      if (azar() > 0.2) precios.set(i, precio((Math.floor(azar() * 1000000) / 100).toFixed(2)));
    }
    const r = valorizar(productos, precios);
    const sumaCategorias = r.categorias.reduce((s, c) => s + centavos(c.valor), 0);
    const sumaProductos = r.categorias.flatMap((c) => c.productos).reduce((s, p) => s + centavos(p.valor), 0);
    assert.equal(centavos(r.total), sumaCategorias, `caso ${caso}`);
    assert.equal(sumaCategorias, sumaProductos, `caso ${caso}`);
    for (const c of r.categorias) {
      assert.equal(centavos(c.valor), c.productos.reduce((s, p) => s + centavos(p.valor), 0), `caso ${caso} ${c.nombre}`);
    }
  }
});
