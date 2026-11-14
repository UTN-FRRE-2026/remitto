import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarComprobantesSchema } from '../src/modules/comprobantes/comprobantes.schema.js';
import { condiciones, destino, filtroEstado } from '../src/modules/comprobantes/comprobantes.listado.js';

test('HU18: filtros válidos con valores por defecto', () => {
  const f = listarComprobantesSchema.parse({ proveedorId: '3', estado: 'EN_REVISION', desde: '2026-11-01', hasta: '2026-11-13' });
  assert.deepEqual(f, { proveedorId: 3, estado: 'EN_REVISION', desde: '2026-11-01', hasta: '2026-11-13', pagina: 1, limite: 20 });
  assert.equal(listarComprobantesSchema.safeParse({ desde: '2026-11-13', hasta: '2026-11-01' }).success, false);
  assert.equal(listarComprobantesSchema.safeParse({ desde: '2026-02-30' }).success, false);
  assert.equal(listarComprobantesSchema.safeParse({ estado: 'BORRADO' }).success, false);
  assert.equal(listarComprobantesSchema.safeParse({ otro: 'x' }).success, false); // .strict()
});

test('HU18: "en proceso" agrupa pendientes y en lectura', () => {
  assert.deepEqual(filtroEstado('EN_PROCESO'), { in: ['PENDIENTE', 'PROCESANDO'] });
  assert.equal(filtroEstado('CONFIRMADO'), 'CONFIRMADO');
  assert.equal(filtroEstado(undefined), undefined);
});

test('HU18: las fechas filtran por el día de carga en hora de Argentina', () => {
  const w = condiciones({ proveedorId: 2, desde: '2026-11-13', hasta: '2026-11-13', numero: '0001' });
  assert.equal(w.proveedorId, 2);
  assert.equal(w.cargadoEn.gte.toISOString(), '2026-11-13T03:00:00.000Z');
  assert.equal(w.cargadoEn.lt.toISOString(), '2026-11-14T03:00:00.000Z');
  assert.deepEqual(w.numero, { contains: '0001', mode: 'insensitive' });
  assert.deepEqual(condiciones({}), {});
});

test('HU18: un comprobante en revisión se retoma; uno confirmado se ve en solo lectura', () => {
  assert.equal(destino('EN_REVISION'), 'REVISAR');
  assert.equal(destino('CONFIRMADO'), 'VER');
  for (const e of ['PENDIENTE', 'PROCESANDO', 'ERROR']) assert.equal(destino(e), 'LECTURA');
});
