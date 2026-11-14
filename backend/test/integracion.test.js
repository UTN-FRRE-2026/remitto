import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Prisma, UnidadMedida } from '@prisma/client';
import { ventaSchema, MAX_LINEAS } from '../src/modules/integracion/integracion.schema.js';
import { agruparLineas, mismoContenido, mapearVenta, normalizarPedido, firmaPedido } from '../src/modules/integracion/integracion.service.js';
import { problemasDelCarrito } from '../src/modules/salidas/salidas.service.js';
import { manejadorErrores } from '../src/middlewares/error.js';

const contrato = JSON.parse(readFileSync(new URL('../src/modules/integracion/openapi.json', import.meta.url), 'utf8'));
const operacion = contrato.paths['/salidas'].post;
const d = (v) => new Prisma.Decimal(v);

test('contrato OpenAPI: los ejemplos de pedido son válidos para el backend', () => {
  const ejemplos = Object.values(operacion.requestBody.content['application/json'].examples);
  assert.ok(ejemplos.length >= 2);
  for (const e of ejemplos) assert.equal(ventaSchema.safeParse(e.value).success, true, e.summary);
});

test('contrato OpenAPI: campos, límites y unidades coinciden con el backend', () => {
  const { Venta, LineaVenta, Producto } = contrato.components.schemas;
  assert.deepEqual(Object.keys(Venta.properties).sort(), Object.keys(ventaSchema.shape).sort());
  assert.deepEqual(Venta.required, ['referencia', 'lineas']);
  assert.equal(Venta.properties.lineas.maxItems, MAX_LINEAS);
  assert.deepEqual(Object.keys(LineaVenta.properties).sort(), ['cantidad', 'codigoBarras', 'productoId']);
  assert.deepEqual(Producto.properties.unidadMedida.enum.sort(), Object.values(UnidadMedida).sort());
  assert.deepEqual(Object.keys(operacion.responses).sort(), ['200', '201', '400', '401', '409', '413', '503']);
  // El 503 que devuelve el manejador de errores, con Retry-After.
  assert.equal(operacion.responses['503'].headers['Retry-After'].schema.type, 'integer');
  assert.match(contrato.info.description, /fecha` no participa/);
  assert.ok(contrato.paths['/estado'].get);
});

test('esquema de venta: referencia, fecha y líneas', () => {
  const ok = ventaSchema.parse({ referencia: '  T-1 ', fecha: '2026-11-14T18:00:00-03:00', lineas: [{ codigoBarras: ' 779 ', cantidad: 1 }] });
  assert.equal(ok.referencia, 'T-1');
  assert.equal(ok.fecha.toISOString(), '2026-11-14T21:00:00.000Z');
  assert.equal(ok.lineas[0].codigoBarras, '779');

  const falla = (dato, motivo) => assert.equal(ventaSchema.safeParse(dato).success, false, motivo);
  const linea = { productoId: 1, cantidad: 1 };
  falla({ lineas: [linea] }, 'sin referencia');
  falla({ referencia: '   ', lineas: [linea] }, 'referencia vacía');
  falla({ referencia: 'x'.repeat(101), lineas: [linea] }, 'referencia larga');
  falla({ referencia: 'a\nb', lineas: [linea] }, 'referencia con salto de línea');
  falla({ referencia: 'T', lineas: [] }, 'sin líneas');
  falla({ referencia: 'T', lineas: Array.from({ length: MAX_LINEAS + 1 }, () => linea) }, 'demasiadas líneas');
  falla({ referencia: 'T', lineas: [{ cantidad: 1 }] }, 'línea sin producto');
  falla({ referencia: 'T', lineas: [{ productoId: 1, codigoBarras: '779', cantidad: 1 }] }, 'producto por id y por código');
  falla({ referencia: 'T', lineas: [{ productoId: 1, cantidad: 0 }] }, 'cantidad 0');
  falla({ referencia: 'T', lineas: [{ productoId: 1, cantidad: -2 }] }, 'cantidad negativa');
  falla({ referencia: 'T', lineas: [{ productoId: 1, cantidad: 1.0005 }] }, 'cuatro decimales');
  falla({ referencia: 'T', lineas: [{ productoId: 1, cantidad: '2' }] }, 'cantidad como texto');
  falla({ referencia: 'T', fecha: '14/11/2026', lineas: [linea] }, 'fecha no ISO');
  falla({ referencia: 'T', fecha: '2026-11-14T18:00:00', lineas: [linea] }, 'fecha sin zona');
  falla({ referencia: 'T', lineas: [linea], usuarioId: 1 }, 'campo extra');
  falla({ referencia: 'T', lineas: [{ ...linea, precio: 10 }] }, 'campo extra en la línea');
});

test('agrupar líneas: suma el mismo producto y ordena por id', () => {
  const r = agruparLineas([
    { productoId: 5, cantidad: 1 },
    { productoId: 2, cantidad: 0.25 },
    { productoId: 5, cantidad: 2 },
    { productoId: 2, cantidad: 0.5 },
  ]);
  assert.deepEqual(r.map((l) => [l.productoId, l.cantidad.toString()]), [[2, '0.75'], [5, '3']]);
});

test('petición normalizada: orden, líneas repetidas, decimales e identificadores originales', () => {
  const a = normalizarPedido([
    { codigoBarras: ' 779 ', cantidad: 1 },
    { productoId: 5, cantidad: 0.5 },
    { codigoBarras: '779', cantidad: 1 },
    { productoId: 5, cantidad: 0.25 },
  ]);
  assert.deepEqual(a, [{ codigoBarras: '779', cantidad: '2' }, { productoId: 5, cantidad: '0.75' }]);
  const firma = (lineas) => firmaPedido(normalizarPedido(lineas));
  // Mismo pedido en otro orden, partido distinto o con 2.0 en lugar de 2.
  assert.equal(firma([{ productoId: 5, cantidad: 0.75 }, { codigoBarras: '779', cantidad: 2.0 }]), firmaPedido(a));
  // El identificador original importa: el mismo producto por id es otra petición.
  assert.notEqual(firma([{ productoId: 1, cantidad: 2 }]), firma([{ codigoBarras: '779', cantidad: 2 }]));
  assert.notEqual(firma([{ codigoBarras: '779', cantidad: 2 }]), firma([{ codigoBarras: '779', cantidad: 3 }]));
  assert.notEqual(firma([{ codigoBarras: '779', cantidad: 2 }]), firma([{ codigoBarras: '779', cantidad: 2 }, { productoId: 1, cantidad: 1 }]));
  // Sin colisiones: un código con los separadores de una firma de texto no
  // equivale a dos líneas («a=1|c:b» frente a «a» y «b»).
  assert.notEqual(firma([{ codigoBarras: 'a=1|c:b', cantidad: 1 }]), firma([{ codigoBarras: 'a', cantidad: 1 }, { codigoBarras: 'b', cantidad: 1 }]));
  assert.notEqual(firma([{ codigoBarras: 'x","1"],["codigoBarras","y', cantidad: 1 }]), firma([{ codigoBarras: 'x', cantidad: 1 }, { codigoBarras: 'y', cantidad: 1 }]));
  assert.notEqual(firma([{ codigoBarras: '5', cantidad: 1 }]), firma([{ productoId: 5, cantidad: 1 }]));
  assert.notEqual(firma([{ codigoBarras: 'p:5', cantidad: 1 }]), firma([{ productoId: 5, cantidad: 1 }]));
  // jsonb reordena las claves de cada objeto: la firma no depende de eso.
  assert.equal(firmaPedido([{ cantidad: '2', codigoBarras: '779' }, { cantidad: '0.75', productoId: 5 }]), firmaPedido(a));
});

test('reenvío: mismo contenido sin importar el orden; otro contenido no', () => {
  const registrada = [{ productoId: 1, cantidad: 2 }, { productoId: 3, cantidad: 0.1 }];
  assert.equal(mismoContenido(registrada, agruparLineas([{ productoId: 3, cantidad: 0.1 }, { productoId: 1, cantidad: 2 }])), true);
  assert.equal(mismoContenido(registrada, agruparLineas([{ productoId: 1, cantidad: 1 }, { productoId: 1, cantidad: 1 }, { productoId: 3, cantidad: 0.1 }])), true);
  assert.equal(mismoContenido(registrada, [{ productoId: 1, cantidad: d(2) }]), false, 'falta un producto');
  assert.equal(mismoContenido(registrada, [{ productoId: 1, cantidad: d(3) }, { productoId: 3, cantidad: d(0.1) }]), false, 'otra cantidad');
  assert.equal(mismoContenido(registrada, [{ productoId: 1, cantidad: d(2) }, { productoId: 4, cantidad: d(0.1) }]), false, 'otro producto');
});

test('stock insuficiente: el carrito lo rechaza, la venta externa no', () => {
  const productos = new Map([
    [1, { id: 1, nombre: 'Gaseosa', activo: true, unidadMedida: 'UNIDAD', stockActual: d(1) }],
    [2, { id: 2, nombre: 'Viejo', activo: false, unidadMedida: 'UNIDAD', stockActual: d(5) }],
  ]);
  assert.equal(problemasDelCarrito([{ productoId: 1, cantidad: 3 }], productos).length, 1);
  assert.deepEqual(problemasDelCarrito([{ productoId: 1, cantidad: 3 }], productos, { permitirNegativo: true }), []);
  // Lo demás se sigue rechazando aunque se permita el negativo.
  const otros = problemasDelCarrito(
    [{ productoId: 1, cantidad: 0.5 }, { productoId: 2, cantidad: 1 }, { productoId: 9, cantidad: 1 }],
    productos,
    { permitirNegativo: true },
  );
  assert.deepEqual(otros.map((p) => p.mensaje), ['Gaseosa se cuenta en unidades enteras.', 'Viejo está desactivado.', 'El producto #9 no existe.']);
});

test('respuesta de la venta: cantidades positivas y aviso de stock negativo', () => {
  const v = mapearVenta({
    id: 7,
    referencia: undefined,
    referenciaExterna: 'T-1',
    fechaExterna: null,
    registradaEn: new Date('2026-11-14T12:00:00Z'),
    movimientos: [
      { cantidad: d(-2), stockAnterior: d(5), producto: { id: 1, nombre: 'Gaseosa' } },
      { cantidad: d(-1.5), stockAnterior: d(1), producto: { id: 4, nombre: 'Queso' } },
    ],
  });
  assert.deepEqual(v.lineas.map((l) => [l.cantidad, l.stockAnterior, l.stockNuevo]), [[2, 5, 3], [1.5, 1, -0.5]]);
  assert.equal(v.referencia, 'T-1');
  assert.deepEqual(v.advertencias.map((a) => a.productoId), [4]);
  assert.match(v.advertencias[0].mensaje, /Queso quedó con stock negativo \(-0,5\)/);
});

test('errores: un JSON mal formado es 400 y no 500', () => {
  const respuesta = () => {
    const r = { codigo: null, cuerpo: null };
    r.status = (c) => ((r.codigo = c), r);
    r.json = (b) => ((r.cuerpo = b), r);
    return r;
  };
  const mal = respuesta();
  manejadorErrores(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 }), {}, mal);
  assert.equal(mal.codigo, 400);
  const grande = respuesta();
  manejadorErrores(Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413 }), {}, grande);
  assert.equal(grande.codigo, 413);
});
