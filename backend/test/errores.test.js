import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traducirErrorSdk, formatearError, leerError, sanear } from '../src/ia/errores.js';

// Imita los errores observados del SDK @google/genai 2.30.0 (clase, status y
// cuerpo { error: { code } }).
function errorSdk(clase, status, code, message = `${status} error`) {
  const Clase = { [clase]: class extends Error {} }[clase];
  const e = new Clase(message);
  e.status = status;
  e.error = { error: { code, message } };
  e.body = JSON.stringify({ error: { code, message } });
  return e;
}

const casos = [
  [errorSdk('AuthenticationError', 401, 'authentication'), 'CLAVE_RECHAZADA', false],
  [errorSdk('PermissionDeniedError', 403, 'permission_denied'), 'CLAVE_RECHAZADA', false],
  [errorSdk('NotFoundError', 404, 'not_found'), 'MODELO_NO_DISPONIBLE', false],
  [errorSdk('RateLimitError', 429, 'quota_exceeded'), 'CUOTA_AGOTADA', false],
  [errorSdk('RateLimitError', 429, 'rate_limit_exceeded'), 'LIMITE_POR_MINUTO', true],
  [errorSdk('RateLimitError', 429, 'too_many_requests'), 'LIMITE_POR_MINUTO', true],
  [errorSdk('InternalServerError', 500, 'api_error'), 'SERVICIO_NO_DISPONIBLE', true],
  [errorSdk('InternalServerError', 503, 'service_unavailable'), 'SERVICIO_NO_DISPONIBLE', true],
  [errorSdk('InternalServerError', 504, 'deadline_exceeded'), 'DEMORA', true],
  [errorSdk('BadRequestError', 400, 'invalid_request'), 'SOLICITUD_RECHAZADA', false],
  [errorSdk('APIError', 402, 'payment_required'), 'SOLICITUD_RECHAZADA', false],
];

for (const [err, codigo, automatico] of casos) {
  test(`${err.constructor.name} ${err.status} → ${codigo}`, () => {
    const t = traducirErrorSdk(err);
    assert.equal(t.codigo, codigo);
    assert.equal(t.automatico, automatico);
  });
}

test('timeout del SDK → DEMORA (reintentable)', () => {
  const Clase = { APIConnectionTimeoutError: class extends Error {} }.APIConnectionTimeoutError;
  const t = traducirErrorSdk(new Clase('Request timed out'));
  assert.equal(t.codigo, 'DEMORA');
  assert.equal(t.automatico, true);
});

test('falla de conexión → SIN_CONEXION', () => {
  const Clase = { APIConnectionError: class extends Error {} }.APIConnectionError;
  assert.equal(traducirErrorSdk(new Clase('fetch failed')).codigo, 'SIN_CONEXION');
});

const CLAVE_FALSA = 'AIzaSyFALSA_0123456789abcdefghijklmnop';

test('el mensaje para el usuario no expone detalles técnicos', () => {
  const t = traducirErrorSdk(errorSdk('AuthenticationError', 401, 'authentication', `API key not valid: ${CLAVE_FALSA}`));
  assert.ok(!t.message.includes(CLAVE_FALSA));
  assert.ok(!t.detalle.includes(CLAVE_FALSA));
  assert.ok(!JSON.stringify(t.proveedor).includes(CLAVE_FALSA));
});

test('conserva el mensaje técnico del proveedor (saneado) para el servidor', () => {
  const t = traducirErrorSdk(
    errorSdk('BadRequestError', 400, 'invalid_request', 'Invalid JSON schema: field "maxItems" not supported'),
  );
  assert.equal(t.codigo, 'SOLICITUD_RECHAZADA');
  assert.deepEqual(
    { status: t.proveedor.status, code: t.proveedor.code, message: t.proveedor.message },
    { status: 400, code: 'invalid_request', message: 'Invalid JSON schema: field "maxItems" not supported' },
  );
  assert.match(t.detalle, /message=Invalid JSON schema/);
  // La interfaz sigue mostrando el mensaje simple.
  assert.ok(!t.message.includes('maxItems'));
});

test('sanear quita claves, parámetros sensibles, base64 y limita el largo', () => {
  const base64 = 'JVBERi0xLjQK'.repeat(40);
  const t = sanear(`fallo ${CLAVE_FALSA} en https://x.test/v1?key=abc123&alt=json data=${base64} x-goog-api-key: zzz`);
  assert.ok(!t.includes(CLAVE_FALSA) && t.includes('[CLAVE]'));
  assert.ok(!t.includes('abc123') && t.includes('key=[REDACTADO]'));
  assert.ok(!t.includes(base64) && t.includes('[DATOS]'));
  assert.ok(!t.includes('zzz'));
  assert.ok(sanear('x'.repeat(2000)).length <= 601);
});

test('formato persistido "[CODIGO] mensaje" ida y vuelta', () => {
  const texto = formatearError('CUOTA_AGOTADA', 'Se agotó la cuota.');
  assert.deepEqual(leerError(texto), { codigo: 'CUOTA_AGOTADA', mensaje: 'Se agotó la cuota.' });
  assert.equal(leerError(null), null);
});
