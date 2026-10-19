import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarRespuesta } from '../src/ia/extractor.js';
import { hayTiempoParaReintentar, esperaAntesDeReintentar } from '../src/modules/comprobantes/comprobantes.procesamiento.js';

const valida = {
  documento: { legible: true, motivoIlegible: null, manuscrito: false, bajaCalidad: false },
  cabecera: { tipo: 'REMITO', numero: '0001-1', fechaEmision: '2026-09-28', totalDeclarado: null, totalTexto: null, proveedorNombre: null, proveedorCuit: null },
  lineas: [
    { codigo: '1', descripcion: 'YERBA', cantidad: 12, cantidadTexto: '12', unidad: 'UN', precioUnitario: null, precioUnitarioTexto: null, ilegible: false, observacion: null },
  ],
};

test('respuesta válida: conserva original, lectura y normalizada', () => {
  const texto = JSON.stringify(valida);
  const r = interpretarRespuesta(texto);
  assert.equal(r.original, texto);
  assert.deepEqual(r.lectura, valida);
  assert.equal(r.normalizada.lineas.length, 1);
});

test('texto que no es JSON → RESPUESTA_INVALIDA conservando el original', () => {
  assert.throws(() => interpretarRespuesta('no es json'), (e) => e.codigo === 'RESPUESTA_INVALIDA' && e.original === 'no es json');
});

test('JSON fuera de esquema → RESPUESTA_INVALIDA conservando la lectura', () => {
  const malo = { documento: { legible: 'si' }, lineas: 'x' };
  assert.throws(
    () => interpretarRespuesta(JSON.stringify(malo)),
    (e) => e.codigo === 'RESPUESTA_INVALIDA' && e.lectura?.lineas === 'x' && /esquema/.test(e.detalle),
  );
});

test('respuesta vacía (bloqueada o incompleta) → RESPUESTA_INVALIDA', () => {
  assert.throws(() => interpretarRespuesta(''), (e) => e.codigo === 'RESPUESTA_INVALIDA');
});

test('documento ilegible → DOCUMENTO_ILEGIBLE', () => {
  const ilegible = { ...valida, documento: { ...valida.documento, legible: false, motivoIlegible: 'borroso' }, lineas: [] };
  assert.throws(() => interpretarRespuesta(JSON.stringify(ilegible)), (e) => e.codigo === 'DOCUMENTO_ILEGIBLE' && Boolean(e.original));
});

test('presupuesto: no reintenta si la espera más una llamada mínima no entra', () => {
  assert.equal(hayTiempoParaReintentar({ ahora: 0, limite: 30000, espera: 1000 }), true);
  assert.equal(hayTiempoParaReintentar({ ahora: 26000, limite: 30000, espera: 1000 }), false);
  // El 429 por minuto espera 20 s: tras una llamada de 6 s ya no entra en 30 s.
  assert.equal(hayTiempoParaReintentar({ ahora: 6000, limite: 30000, espera: esperaAntesDeReintentar('LIMITE_POR_MINUTO', 1) }), false);
});

test('espera creciente entre reintentos transitorios', () => {
  const primera = esperaAntesDeReintentar('SERVICIO_NO_DISPONIBLE', 1);
  const segunda = esperaAntesDeReintentar('SERVICIO_NO_DISPONIBLE', 2);
  assert.ok(primera >= 1000 && primera < 1300);
  assert.ok(segunda >= 2000 && segunda < 2300);
});
