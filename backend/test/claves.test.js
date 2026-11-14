import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generarClave, hashClave, formatoValido, validarClave } from '../src/modules/claves/claves.service.js';
import { crearClaveSchema } from '../src/modules/claves/claves.schema.js';
import { extraerClave, crearAutenticarIntegracion } from '../src/middlewares/integracion.js';

test('generar clave: formato, prefijo visible y hash SHA-256 de la clave completa', () => {
  const { clave, prefijo, hash } = generarClave();
  assert.match(clave, /^rmt_live_[0-9a-f]{64}$/);
  assert.equal(prefijo, clave.slice(0, 15));
  assert.match(prefijo, /^rmt_live_[0-9a-f]{6}$/);
  assert.equal(hash, createHash('sha256').update(clave).digest('hex'));
  // Lo que se guarda no permite reconstruir la clave.
  assert.ok(!hash.includes(clave.slice(15)));
});

test('generar clave: cada clave es distinta', () => {
  const claves = new Set(Array.from({ length: 200 }, () => generarClave().clave));
  assert.equal(claves.size, 200);
});

test('hash de la clave: determinístico y distinto para otra clave', () => {
  const a = generarClave().clave;
  assert.equal(hashClave(a), hashClave(a));
  assert.notEqual(hashClave(a), hashClave(generarClave().clave));
});

test('formato de clave', () => {
  const { clave } = generarClave();
  assert.equal(formatoValido(clave), true);
  assert.equal(formatoValido(clave.toUpperCase()), false);
  assert.equal(formatoValido(clave.slice(0, -1)), false);
  assert.equal(formatoValido(`${clave}0`), false);
  assert.equal(formatoValido(`rmt_test_${clave.slice(9)}`), false);
  assert.equal(formatoValido(undefined), false);
});

// Base simulada: registra la consulta de $queryRaw (tagged template).
function baseFalsa(filas) {
  const llamadas = [];
  return {
    llamadas,
    $queryRaw: async (strings, ...valores) => {
      llamadas.push({ sql: strings.join('?'), valores });
      return filas;
    },
  };
}

test('validar clave: busca por hash solo claves activas y registra el uso en la misma sentencia', async () => {
  const { clave } = generarClave();
  const db = baseFalsa([{ id: 3, nombre: 'Caja', prefijo: clave.slice(0, 15) }]);
  assert.deepEqual(await validarClave(clave, db), { id: 3, nombre: 'Caja', prefijo: clave.slice(0, 15) });
  assert.equal(db.llamadas.length, 1);
  const { sql, valores } = db.llamadas[0];
  assert.deepEqual(valores, [hashClave(clave)]);
  assert.match(sql, /UPDATE claves_integracion SET ultimo_uso_en = now\(\)/);
  assert.match(sql, /AND activa/);
  assert.ok(!valores.includes(clave), 'la clave completa no viaja a la base');
});

test('validar clave: revocada o inexistente devuelve null', async () => {
  assert.equal(await validarClave(generarClave().clave, baseFalsa([])), null);
});

test('validar clave: un formato inválido se rechaza sin consultar la base', async () => {
  const db = baseFalsa([{ id: 1 }]);
  assert.equal(await validarClave('rmt_live_abc', db), null);
  assert.equal(await validarClave('', db), null);
  assert.equal(db.llamadas.length, 0);
});

test('encabezado Authorization: extrae la clave del esquema Bearer', () => {
  assert.equal(extraerClave('Bearer rmt_live_abc'), 'rmt_live_abc');
  assert.equal(extraerClave('  Bearer   rmt_live_abc '), 'rmt_live_abc');
  assert.equal(extraerClave('bearer rmt_live_abc'), 'rmt_live_abc');
  assert.equal(extraerClave('Bearer rmt_live_abc extra'), null);
  assert.equal(extraerClave('Basic abc'), null);
  assert.equal(extraerClave('Bearer'), null);
  assert.equal(extraerClave(undefined), null);
});

// Ejecuta el middleware y devuelve lo que pasó a next().
async function correr(middleware, authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  let error;
  await middleware(req, {}, (err) => {
    error = err;
  });
  return { req, error };
}

test('middleware de integración: clave válida → sigue con la clave en req', async () => {
  const recibidas = [];
  const mw = crearAutenticarIntegracion(async (c) => {
    recibidas.push(c);
    return { id: 7, nombre: 'Caja', prefijo: 'rmt_live_abcdef' };
  });
  const { req, error } = await correr(mw, 'Bearer rmt_live_x');
  assert.equal(error, undefined);
  assert.deepEqual(req.claveIntegracion, { id: 7, nombre: 'Caja', prefijo: 'rmt_live_abcdef' });
  assert.deepEqual(recibidas, ['rmt_live_x']);
});

test('middleware de integración: sin clave, inválida o revocada → 401', async () => {
  let llamadas = 0;
  const mw = crearAutenticarIntegracion(async () => {
    llamadas += 1;
    return null;
  });
  const sinClave = await correr(mw);
  assert.equal(sinClave.error.status, 401);
  assert.match(sinClave.error.message, /Falta la clave/);
  assert.equal(llamadas, 0);

  const revocada = await correr(mw, 'Bearer rmt_live_revocada');
  assert.equal(revocada.error.status, 401);
  assert.match(revocada.error.message, /inválida o revocada/);
  assert.equal(revocada.req.claveIntegracion, undefined);
});

test('middleware de integración: un error de la base pasa al manejador de errores', async () => {
  const falla = new Error('sin conexión');
  const mw = crearAutenticarIntegracion(async () => {
    throw falla;
  });
  assert.equal((await correr(mw, 'Bearer rmt_live_x')).error, falla);
});

test('esquema de creación: nombre obligatorio, recortado y sin campos extra', () => {
  assert.deepEqual(crearClaveSchema.parse({ nombre: '  Caja del mostrador ' }), { nombre: 'Caja del mostrador' });
  const falla = (d) => assert.equal(crearClaveSchema.safeParse(d).success, false, JSON.stringify(d));
  falla({});
  falla({ nombre: '   ' });
  falla({ nombre: 'x'.repeat(61) });
  falla({ nombre: 'Caja', prefijo: 'rmt_live_000000' });
  falla({ nombre: 'Caja', hashClave: 'abc' });
});
