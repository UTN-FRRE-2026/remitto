import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarLinea,
  medir,
  sumar,
  precisionDeComprobante,
  esSimulada,
} from '../src/modules/comprobantes/comprobantes.precision.js';
import { evolucion } from '../src/modules/reportes/reportes.service.js';
import { preciosSchema, productoParamSchema, restarDias, hoyArgentina } from '../src/modules/reportes/reportes.schema.js';

// --- HU19: precisión de la lectura ---

const linea = (extra = {}) => ({
  agregadaManualmente: false,
  estado: 'CONFIRMADO',
  cantidadExtraida: '12.000',
  cantidad: '12',
  precioUnitarioExtraido: '690.00',
  precioUnitario: '690',
  ...extra,
});

test('HU19: una línea es correcta si se confirmó con la cantidad y el precio leídos', () => {
  assert.deepEqual(clasificarLinea(linea()), { caso: 'CORRECTA' });
  // Sin precio leído y sin precio confirmado: también coincide.
  assert.deepEqual(clasificarLinea(linea({ precioUnitarioExtraido: null, precioUnitario: null })), { caso: 'CORRECTA' });
  assert.deepEqual(clasificarLinea(linea({ cantidad: '10' })), { caso: 'CORREGIDA', cantidad: false, precio: true });
  // La persona completó un precio que la IA no leyó.
  assert.deepEqual(clasificarLinea(linea({ precioUnitarioExtraido: null })), { caso: 'CORREGIDA', cantidad: true, precio: false });
  assert.deepEqual(clasificarLinea(linea({ estado: 'DESCARTADO' })), { caso: 'DESCARTADA' });
  assert.deepEqual(clasificarLinea(linea({ agregadaManualmente: true, cantidadExtraida: null })), { caso: 'OMITIDA' });
  // Agregada a mano y descartada: no es una línea del comprobante.
  assert.equal(clasificarLinea(linea({ agregadaManualmente: true, estado: 'DESCARTADO' })), null);
});

test('HU19: porcentaje de líneas correctas por comprobante y en general', () => {
  const a = medir([
    linea(),
    linea(),
    linea({ cantidad: '1', precioUnitario: '1' }),
    linea({ estado: 'DESCARTADO' }),
    linea({ agregadaManualmente: true }),
    linea({ agregadaManualmente: true, estado: 'DESCARTADO' }),
  ]);
  assert.deepEqual(a, {
    lineas: 5,
    correctas: 2,
    corregidas: 1,
    descartadas: 1,
    omitidas: 1,
    erroresCantidad: 1,
    erroresPrecio: 1,
    porcentaje: 40,
  });
  const b = medir([linea(), linea(), linea()]);
  assert.equal(b.porcentaje, 100);
  // El general pondera por líneas, no promedia porcentajes: 5 de 8.
  assert.equal(sumar([a, b]).porcentaje, 62.5);
  assert.equal(medir([]).porcentaje, null);
  assert.equal(medir([linea(), linea(), linea({ cantidad: '2' })]).porcentaje, 66.7);
});

test('HU19: el indicador por comprobante solo existe confirmado y con lectura de IA', () => {
  const c = { estado: 'CONFIRMADO', modeloIa: 'gemini-2.5-flash', detalles: [linea()] };
  assert.equal(precisionDeComprobante(c).porcentaje, 100);
  assert.equal(precisionDeComprobante(c).simulada, false);
  assert.equal(precisionDeComprobante({ ...c, estado: 'EN_REVISION' }), null);
  assert.equal(precisionDeComprobante({ ...c, modeloIa: null }), null);
  assert.equal(precisionDeComprobante({ ...c, modeloIa: 'simulado:gemini-2.5-flash' }).simulada, true);
  assert.equal(esSimulada(null), false);
});

// --- HU20: evolución de los precios de compra ---

const d = (s) => new Date(`${s}T00:00:00Z`);
const precio = (productoId, proveedorId, fecha, valor) => ({
  productoId,
  nombre: productoId === 1 ? 'Yerba' : 'Aceite',
  unidadMedida: 'UNIDAD',
  proveedorId,
  proveedor: proveedorId === 10 ? 'Distribuidora Norte' : 'Mayorista Chaco',
  precioUnitario: valor,
  fechaVigencia: d(fecha),
});

test('HU20: historial por proveedor ordenado por fecha, con variación y último precio', () => {
  // Filas como las devuelve la consulta: ordenadas por fecha de vigencia.
  const [yerba] = evolucion([
    precio(1, 10, '2026-08-01', '2000.00'),
    precio(1, 20, '2026-08-15', '2100.00'),
    precio(1, 10, '2026-09-01', '2300.00'),
    precio(1, 10, '2026-10-01', '2500.00'),
    precio(1, 20, '2026-10-20', '2400.00'),
  ]);
  assert.equal(yerba.precios, 5);
  // El último precio del producto es el de fecha más reciente (Chaco, 20/10).
  assert.deepEqual(yerba.ultimo, { fecha: d('2026-10-20'), precio: 2400, proveedor: 'Mayorista Chaco' });
  assert.equal(yerba.variacion, 14.3); // 2100 → 2400
  // Proveedores del más barato al más caro según su último precio.
  assert.deepEqual(
    yerba.proveedores.map((p) => [p.nombre, p.ultimo.precio, p.variacion, p.sobreMejor]),
    [
      ['Mayorista Chaco', 2400, 14.3, 0],
      ['Distribuidora Norte', 2500, 25, 4.2],
    ],
  );
  assert.deepEqual(
    yerba.proveedores[1].puntos.map((p) => p.precio),
    [2000, 2300, 2500],
  );
});

test('HU20: con un solo precio no hay variación; mismo día, manda el registrado último', () => {
  const productos = evolucion([
    precio(2, 10, '2026-09-01', '3000.00'),
    precio(1, 10, '2026-10-01', '2500.00'),
    precio(1, 20, '2026-10-01', '2450.00'), // mismo día, registrado después
  ]);
  const aceite = productos.find((p) => p.id === 2);
  assert.equal(aceite.variacion, null);
  assert.equal(aceite.proveedores[0].sobreMejor, null); // un solo proveedor: no se compara
  const yerba = productos.find((p) => p.id === 1);
  assert.equal(yerba.ultimo.proveedor, 'Mayorista Chaco');
});

test('HU20: el período por defecto es el último año y el producto es un id válido', () => {
  const hoy = hoyArgentina();
  assert.deepEqual(preciosSchema.parse({}), { desde: restarDias(hoy, 364), hasta: hoy });
  assert.equal(preciosSchema.safeParse({ desde: '2026-11-10', hasta: '2026-11-01' }).success, false);
  assert.deepEqual(productoParamSchema.parse({ productoId: '7' }), { productoId: 7 });
  assert.equal(productoParamSchema.safeParse({ productoId: 'abc' }).success, false);
});
