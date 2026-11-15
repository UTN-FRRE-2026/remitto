import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { ordenDeCompra, nombreArchivo, generarPdf, formatoCantidad, formatoCuit } from '../src/modules/reportes/ordenCompra.js';
import { sugerir } from '../src/modules/reportes/reportes.service.js';
import { ordenCompraSchema } from '../src/modules/reportes/reportes.schema.js';
import { textoPdf, textoPlano } from './pdf-texto.js';

// HU31: orden de compra desde la sugerencia de reposición (HU27).
const d = (v) => new Prisma.Decimal(v);
const fila = (id, nombre, unidadMedida, stock, minimo, deseado, proveedorId, proveedor) => ({
  id,
  nombre,
  unidadMedida,
  stockActual: d(stock),
  stockMinimo: d(minimo),
  stockDeseado: deseado == null ? null : d(deseado),
  categoriaNombre: null,
  precioUnitario: proveedorId ? d(100) : null,
  proveedorId,
  proveedor,
});
const sugerencia = sugerir([
  fila(1, 'Yerba mate con palo 1 kg', 'UNIDAD', 2, 8, 24, 10, 'Distribuidora Norte'),
  fila(2, 'Queso cremoso', 'KILOGRAMO', 0.625, 2, 3, 10, 'Distribuidora Norte'),
  fila(3, 'Alfajor triple', 'PAQUETE', 1, 5, 12.5, 20, 'Lácteos del Litoral'),
  fila(4, 'Pan lactal', 'UNIDAD', 0, 6, 18, null, null),
  fila(5, 'Sin deseado', 'UNIDAD', 0, 6, null, 10, 'Distribuidora Norte'),
]);
const emitida = new Date('2026-11-15T15:30:00Z');

test('la orden toma el grupo del proveedor tal como lo calcula HU27', () => {
  const o = ordenDeCompra(sugerencia, 10, { razonSocial: 'Distribuidora Norte S.R.L.', cuit: '30-71234567-1' }, emitida);
  assert.deepEqual(o.lineas, [
    { producto: 'Queso cremoso', cantidad: 2.375, unidad: 'kg' },
    { producto: 'Yerba mate con palo 1 kg', cantidad: 22, unidad: 'u.' },
  ]);
  assert.equal(o.proveedor.razonSocial, 'Distribuidora Norte S.R.L.');
  // Paquetes redondeados hacia arriba, como en HU27; el producto sin deseado no entra.
  assert.deepEqual(ordenDeCompra(sugerencia, 20, null, emitida).lineas, [{ producto: 'Alfajor triple', cantidad: 12, unidad: 'paq.' }]);
  assert.ok(!o.lineas.some((l) => l.producto === 'Sin deseado' || l.producto === 'Alfajor triple'));
});

test('productos sin proveedor: orden «a definir»; proveedor fuera de la sugerencia: null', () => {
  const sin = ordenDeCompra(sugerencia, 'sin', null, emitida);
  assert.equal(sin.proveedor.aDefinir, true);
  assert.deepEqual(sin.lineas.map((l) => l.producto), ['Pan lactal']);
  assert.equal(ordenDeCompra(sugerencia, 99, { razonSocial: 'Otro' }, emitida), null);
  assert.equal(formatoCantidad(2.375), '2,375');
  assert.equal(formatoCantidad(1250), '1.250');
  assert.equal(formatoCuit('30712345671'), '30-71234567-1');
  assert.equal(formatoCuit('30-71234567-1'), '30-71234567-1');
});

test('nombre de archivo sin acentos, con la fecha de Argentina', () => {
  assert.equal(nombreArchivo({ proveedor: { razonSocial: 'Lácteos del Litoral S.A.' }, emitida }), 'orden-compra-lacteos-del-litoral-s-a-2026-11-15.pdf');
  assert.equal(nombreArchivo({ proveedor: { aDefinir: true }, emitida: new Date('2026-11-16T01:00:00Z') }), 'orden-compra-sin-proveedor-2026-11-15.pdf');
});

test('parámetro del proveedor: id o "sin"', () => {
  assert.deepEqual(ordenCompraSchema.parse({ proveedor: '12' }), { proveedor: 12 });
  assert.deepEqual(ordenCompraSchema.parse({ proveedor: 'sin' }), { proveedor: 'sin' });
  for (const v of ['0', '-1', 'abc', '1.5', '']) assert.equal(ordenCompraSchema.safeParse({ proveedor: v }).success, false, v);
  assert.equal(ordenCompraSchema.safeParse({}).success, false);
});

test('el PDF incluye proveedor, productos y cantidades con su unidad', async () => {
  const o = ordenDeCompra(sugerencia, 10, { razonSocial: 'Distribuidora Ñandú', cuit: '30712345671', telefono: '362 412-3456' }, emitida);
  const pdf = await generarPdf(o);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-8).toString(), /%%EOF/);
  const texto = textoPlano(textoPdf(pdf));
  assert.match(texto, /Orden de compra/);
  assert.match(texto, /Proveedor: Distribuidora Ñandú/);
  assert.match(texto, /CUIT 30-71234567-1/);
  assert.match(texto, /1 Queso cremoso 2,375 kg/);
  assert.match(texto, /2 Yerba mate con palo 1 kg 22 u\./);
  assert.doesNotMatch(texto, /\$|Alfajor/, 'sin precios ni productos de otros proveedores');
  const sin = textoPlano(textoPdf(await generarPdf(ordenDeCompra(sugerencia, 'sin', null, emitida))));
  assert.match(sin, /Proveedor: a definir/);
});

test('PDF de varias páginas: todos los renglones, cabecera en cada página, sin superposiciones ni cantidades cortadas', async () => {
  const nombres = [
    'Galletitas dulces rellenas de chocolate y vainilla con chips de colores, edición especial familiar',
    'Aceite de girasol alto oleico 900 ml',
    'Yerba mate compuesta con hierbas serranas y cáscara de naranja, paquete económico de un kilogramo',
    'Café molido torrado intenso',
    'Fideos tirabuzón',
  ];
  const lineas = Array.from({ length: 60 }, (_, i) => ({
    producto: `${nombres[i % nombres.length]} ${i + 1}`,
    cantidad: i % 3 === 0 ? 1234.375 + i : i + 1,
    unidad: i % 3 === 0 ? 'kg' : 'u.',
  }));
  const pdf = await generarPdf({ proveedor: { razonSocial: 'Almacén Mayorista Güemes' }, emitida, lineas });
  const paginas = textoPdf(pdf);
  assert.ok(paginas.length >= 3, `varias páginas (${paginas.length})`);
  const plano = textoPlano(paginas);

  // Cabecera de la tabla en cada página.
  for (const [i, p] of paginas.entries()) {
    assert.equal(p.filter((t) => t.texto === 'Producto').length, 1, `cabecera en la página ${i + 1}`);
    assert.equal(p.filter((t) => t.texto === 'Cantidad').length, 1, `cabecera en la página ${i + 1}`);
  }
  // Todos los renglones, completos y en orden, con su cantidad y su unidad.
  for (const [i, l] of lineas.entries()) {
    assert.ok(plano.includes(`${i + 1} ${l.producto} ${formatoCantidad(l.cantidad)} ${l.unidad}`), `renglón ${i + 1}`);
  }
  assert.match(plano, /60 productos\./);

  // Geometría: cada renglón empieza debajo del anterior (sin superponerse) y
  // la cantidad es una sola línea dentro de su columna.
  for (const items of paginas) {
    const filas = [];
    let actual = null;
    for (const t of items) {
      if (t.x === 50 && /^\d+$/.test(t.texto)) {
        actual = { numero: Number(t.texto), items: [t] };
        filas.push(actual);
      } else if (actual) actual.items.push(t);
    }
    for (let k = 1; k < filas.length; k += 1) {
      const anterior = Math.min(...filas[k - 1].items.map((t) => t.y));
      const siguiente = Math.max(...filas[k].items.map((t) => t.y));
      assert.ok(siguiente < anterior - 8, `el renglón ${filas[k].numero} no se superpone con el ${filas[k - 1].numero}`);
    }
    for (const f of filas) {
      const linea = lineas[f.numero - 1];
      const cantidades = f.items.filter((t) => t.x > 400 && t.x < 500);
      assert.deepEqual(cantidades.map((t) => t.texto), [formatoCantidad(linea.cantidad)], `cantidad entera del renglón ${f.numero}`);
      assert.ok(cantidades[0].y === f.items[0].y, `la cantidad va en la primera línea del renglón ${f.numero}`);
    }
  }
});
