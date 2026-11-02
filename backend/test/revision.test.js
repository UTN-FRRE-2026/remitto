import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarRevision, fechaVigencia, lineasAIngresar } from '../src/modules/comprobantes/comprobantes.revision.js';
import {
  actualizarDetalleSchema,
  agregarDetalleSchema,
  actualizarCabeceraSchema,
} from '../src/modules/comprobantes/comprobantes.schema.js';

const producto = { id: 1, nombre: 'Yerba', unidadMedida: 'UNIDAD', activo: true };
const linea = (extra = {}) => ({
  nroLinea: 1,
  estado: 'PROPUESTO',
  productoId: 1,
  producto,
  cantidad: '12.000',
  precioUnitario: '2850.00',
  ...extra,
});
const comprobante = (extra = {}) => ({
  estado: 'EN_REVISION',
  numero: '0001-00000001',
  fechaEmision: new Date('2026-10-01'),
  totalDeclarado: '34200.00',
  detalles: [linea()],
  ...extra,
});

test('datos completos: sin problemas, con resumen de unidades e importe', () => {
  const r = evaluarRevision(comprobante());
  assert.equal(r.completo, true);
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.resumen, {
    lineas: 1,
    aIngresar: 1,
    descartadas: 0,
    unidades: 12,
    importe: 34200,
    totalImpreso: 34200,
    coincideTotal: true,
  });
});

test('línea sin producto o sin cantidad impide confirmar', () => {
  const r = evaluarRevision(
    comprobante({
      detalles: [linea({ productoId: null, producto: null }), linea({ nroLinea: 2, cantidad: null })],
    }),
  );
  assert.equal(r.completo, false);
  assert.ok(r.problemas.some((p) => p.nroLinea === 1 && p.campo === 'productoId'));
  assert.ok(r.problemas.some((p) => p.nroLinea === 2 && p.campo === 'cantidad'));
});

test('las líneas descartadas no se exigen ni suman', () => {
  const r = evaluarRevision(
    comprobante({ detalles: [linea(), linea({ nroLinea: 2, estado: 'DESCARTADO', productoId: null, producto: null, cantidad: null })] }),
  );
  assert.equal(r.completo, true);
  assert.equal(r.resumen.descartadas, 1);
  assert.equal(r.resumen.unidades, 12);
});

test('sin líneas para ingresar o sin número no está completo', () => {
  const todasDescartadas = evaluarRevision(comprobante({ detalles: [linea({ estado: 'DESCARTADO' })] }));
  assert.ok(todasDescartadas.problemas.some((p) => p.campo === 'lineas'));
  const sinNumero = evaluarRevision(comprobante({ numero: '  ' }));
  assert.ok(sinNumero.problemas.some((p) => p.campo === 'numero'));
});

test('producto desactivado impide confirmar', () => {
  const r = evaluarRevision(comprobante({ detalles: [linea({ producto: { ...producto, activo: false } })] }));
  assert.equal(r.completo, false);
});

test('precio ausente, fecha ausente, total distinto y duplicado son avisos, no problemas', () => {
  const r = evaluarRevision(
    comprobante({ fechaEmision: null, totalDeclarado: '99999.00', detalles: [linea({ precioUnitario: null })] }),
    { duplicados: [{ id: 7, estado: 'EN_REVISION' }] },
  );
  assert.equal(r.completo, true);
  const campos = r.avisos.map((a) => a.campo);
  assert.ok(campos.includes('fechaEmision'));
  assert.ok(campos.includes('precioUnitario'));
  assert.ok(campos.includes('numero'));
  assert.equal(r.resumen.coincideTotal, null, 'sin precios no se puede comparar el total');

  const distinto = evaluarRevision(comprobante({ totalDeclarado: '99999.00' }));
  assert.equal(distinto.resumen.coincideTotal, false);
  assert.ok(distinto.avisos.some((a) => a.campo === 'totalDeclarado'));
});

test('un comprobante que no está EN_REVISION no se puede validar como completo', () => {
  for (const estado of ['PENDIENTE', 'ERROR', 'CONFIRMADO']) {
    assert.equal(evaluarRevision(comprobante({ estado })).completo, false, estado);
  }
});

test('esquemas: cantidad > 0, precio >= 0, decimales de la columna y sin texto vacío como 0', () => {
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: 0 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: -1 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: 1.2345 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: 3.5 }).success, true);
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: '' }).success, false, 'texto vacío no es 0');
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: '12' }).success, false, 'solo números');
  assert.equal(actualizarDetalleSchema.safeParse({ precioUnitario: -0.01 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ precioUnitario: 0 }).success, true);
  assert.equal(actualizarDetalleSchema.safeParse({ precioUnitario: 1.005 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ cantidad: null }).success, true, 'se puede vaciar');
  assert.equal(actualizarDetalleSchema.safeParse({}).success, false, 'sin cambios');
});

test('esquemas: no se pueden tocar columnas leídas por la IA ni campos extra', () => {
  assert.equal(actualizarDetalleSchema.safeParse({ cantidadExtraida: 5 }).success, false);
  assert.equal(actualizarDetalleSchema.safeParse({ estado: 'CONFIRMADO' }).success, false);
  assert.equal(agregarDetalleSchema.safeParse({ descripcionExtraida: 'x' }).success, false);
  assert.equal(actualizarCabeceraSchema.safeParse({ estado: 'CONFIRMADO' }).success, false);
});

test('esquema de cabecera: fecha válida, número vacío como null', () => {
  assert.equal(actualizarCabeceraSchema.safeParse({ fechaEmision: '2026-02-30' }).success, false);
  assert.equal(actualizarCabeceraSchema.safeParse({ fechaEmision: '15/10/2026' }).success, false);
  assert.equal(actualizarCabeceraSchema.parse({ fechaEmision: '2026-10-15' }).fechaEmision, '2026-10-15');
  assert.equal(actualizarCabeceraSchema.parse({ numero: '   ' }).numero, null);
  assert.equal(actualizarCabeceraSchema.safeParse({ tipo: 'TICKET' }).success, false);
});

// HU11: confirmación del ingreso.
test('fecha de vigencia del precio: la de emisión o el día de hoy en Argentina', () => {
  const emision = new Date('2026-10-01T00:00:00Z');
  assert.equal(fechaVigencia(emision), emision);
  // 01:30 UTC del 2 de noviembre todavía es 1 de noviembre en Argentina (UTC-3).
  assert.equal(fechaVigencia(null, new Date('2026-11-02T01:30:00Z')).toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(fechaVigencia(null, new Date('2026-11-02T03:30:00Z')).toISOString(), '2026-11-02T00:00:00.000Z');
});

test('líneas a ingresar: sin descartadas y ordenadas por producto para bloquear siempre igual', () => {
  const r = lineasAIngresar([
    linea({ nroLinea: 1, productoId: 7 }),
    linea({ nroLinea: 2, productoId: 3, estado: 'DESCARTADO' }),
    linea({ nroLinea: 3, productoId: 2 }),
    linea({ nroLinea: 4, productoId: 7 }),
  ]);
  assert.deepEqual(
    r.map((d) => [d.nroLinea, d.productoId]),
    [
      [3, 2],
      [1, 7],
      [4, 7],
    ],
  );
});
