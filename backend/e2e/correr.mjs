// Pruebas de punta a punta contra una base PostgreSQL descartable.
//
//   node e2e/correr.mjs hu21-claves [hu22-salidas ...]
//
// 1. Crea la base remitto_e2e_<fecha> en el mismo servidor de DATABASE_URL
//    (solo localhost: nunca toca otra máquina ni la base de desarrollo).
// 2. Aplica las migraciones y el seed.
// 3. Levanta la API en el puerto E2E_PUERTO (4100 por defecto), con la IA
//    simulada y los archivos en una carpeta temporal.
// 4. Corre los escenarios de e2e/<nombre>.mjs y borra la base al terminar,
//    aunque fallen (E2E_CONSERVAR=1 la deja para inspeccionarla).
import 'dotenv/config';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escenarios = process.argv.slice(2);
if (escenarios.length === 0) {
  console.error('Uso: node e2e/correr.mjs <escenario> [...]   (por ejemplo hu21-claves)');
  process.exit(2);
}

const original = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(original.hostname)) {
  console.error('DATABASE_URL no apunta a localhost: las pruebas de punta a punta solo corren contra una base local.');
  process.exit(2);
}
const nombreBase = `remitto_e2e_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const conBase = (nombre) => {
  const u = new URL(original);
  u.pathname = `/${nombre}`;
  return u.toString();
};
const urlE2e = conBase(nombreBase);
const puerto = Number(process.env.E2E_PUERTO ?? 4100);
const base = `http://localhost:${puerto}/api`;
const admin = new PrismaClient({ datasources: { db: { url: conBase('postgres') } } });

const uploads = mkdtempSync(path.join(os.tmpdir(), 'remitto-e2e-'));
const entorno = {
  ...process.env,
  DATABASE_URL: urlE2e,
  PORT: String(puerto),
  NODE_ENV: 'development',
  UPLOADS_DIR: uploads,
  IA_SIMULACION: 'ok',
  IA_API_KEY: ' ', // sin llamadas reales a la IA
  CORS_ORIGIN: 'http://localhost:5173',
};
const nodo = (args) => execFileSync(process.execPath, args, { cwd: raiz, env: entorno, stdio: 'pipe' });

let servidor;
let fallas = 0;
let controles = 0;
const resultados = [];

// Controles: cada uno suma al total y se imprime con su resultado.
function check(condicion, mensaje) {
  controles += 1;
  if (!condicion) fallas += 1;
  console.log(`  ${condicion ? 'ok ' : 'MAL'} ${mensaje}`);
  return condicion;
}

async function api(metodo, ruta, { cuerpo, token, headers = {} } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let body = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    // respuesta de texto (por ejemplo, el contrato OpenAPI en YAML)
  }
  return { status: res.status, body, headers: res.headers };
}

const login = async (email) => (await api('POST', '/auth/login', { cuerpo: { email, password: 'remitto123' } })).body.token;

async function esperarApi() {
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('La API de prueba no arrancó');
}

try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${nombreBase}"`);
  console.log(`Base descartable: ${nombreBase}`);
  nodo(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  nodo(['prisma/seed.js']);

  servidor = spawn(process.execPath, ['src/server.js'], { cwd: raiz, env: entorno, stdio: ['ignore', 'ignore', 'pipe'] });
  servidor.stderr.on('data', (d) => process.env.E2E_VERBOSO && process.stderr.write(d));
  await esperarApi();

  const db = new PrismaClient({ datasources: { db: { url: urlE2e } } });
  const contexto = {
    api,
    base,
    check,
    db,
    login,
    dueño: await login('carlos@doncarlos.com.ar'),
    empleado: await login('empleado@doncarlos.com.ar'),
  };
  try {
    for (const nombre of escenarios) {
      const antes = { controles, fallas };
      console.log(`\n== ${nombre}`);
      const modulo = await import(pathToFileURL(path.join(raiz, 'e2e', `${nombre}.mjs`)).href);
      await modulo.default(contexto);
      resultados.push(`${nombre}: ${controles - antes.controles - (fallas - antes.fallas)}/${controles - antes.controles}`);
    }
  } finally {
    await db.$disconnect();
  }
} catch (err) {
  fallas += 1;
  console.error(`\nERROR: ${err.stack ?? err.message}`);
} finally {
  if (servidor) {
    servidor.kill();
    await new Promise((r) => (servidor.exitCode === null ? servidor.once('exit', r) : r()));
  }
  if (process.env.E2E_CONSERVAR) {
    console.log(`\nSe conserva la base ${nombreBase}.`);
  } else {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`).catch((e) => {
      fallas += 1;
      console.error(`No se pudo borrar ${nombreBase}: ${e.message}`);
    });
  }
  await admin.$disconnect();
  rmSync(uploads, { recursive: true, force: true });
}

console.log(`\n${resultados.join(' · ')}`);
console.log(fallas === 0 ? `TODO CORRECTO: ${controles} controles` : `${fallas} FALLAS de ${controles} controles`);
process.exit(fallas === 0 ? 0 : 1);
