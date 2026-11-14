// Pruebas de punta a punta contra una base PostgreSQL descartable.
//
//   node e2e/correr.mjs hu21-claves [hu22-salidas ...]
//
// 1. Crea una base remitto_e2e_<fecha>_<proceso>_<azar> en el mismo servidor
//    de DATABASE_URL (solo localhost; nunca toca otra máquina ni la base de
//    desarrollo).
// 2. Aplica las migraciones y el seed.
// 3. Levanta la API en un puerto libre, con la IA simulada y los archivos en
//    una carpeta temporal.
// 4. Antes de cualquier operación, comprueba que la API que responde es la
//    suya y usa su base (marca aleatoria). Si no, aborta con código 2.
// 5. Corre los escenarios de e2e/<nombre>.mjs y borra la base al terminar,
//    aunque fallen. Solo limpia lo que creó.
//
// Variables: E2E_PUERTO (puerto fijo, debe estar libre), E2E_CONSERVAR=1 (no
// borra la base), E2E_VERBOSO=1 (muestra los errores de la API). Solo para
// verificar el aislamiento: E2E_BASE (nombre de la base) y E2E_URL_API
// (dirección a la que se envían los pedidos).
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { ErrorAislamiento, urlOriginal, urlConBase, nombreNuevo, validarNombreBase, elegirPuerto } from './conexion.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escenarios = process.argv.slice(2);
if (escenarios.length === 0) {
  console.error('Uso: node e2e/correr.mjs <escenario> [...]   (por ejemplo hu21-claves)');
  process.exit(2);
}

let fallas = 0;
let controles = 0;
let codigoSalida = 0;
const resultados = [];

// Recursos propios: solo estos se limpian al terminar.
let admin;
let nombreBase;
let baseCreada = false;
let servidor;
let uploads;

// Controles: cada uno suma al total y se imprime con su resultado.
function check(condicion, mensaje) {
  controles += 1;
  if (!condicion) fallas += 1;
  console.log(`  ${condicion ? 'ok ' : 'MAL'} ${mensaje}`);
  return condicion;
}

try {
  // --- Validaciones previas: antes de conectarse a la base ---
  const original = urlOriginal();
  nombreBase = validarNombreBase(process.env.E2E_BASE ?? nombreNuevo(), original);
  const puerto = await elegirPuerto(process.env.E2E_PUERTO);
  const base = process.env.E2E_URL_API ?? `http://localhost:${puerto}/api`;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
    throw new ErrorAislamiento('E2E_URL_API tiene que ser local.');
  }
  const urlE2e = urlConBase(original, nombreBase);

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
      // respuesta de texto
    }
    return { status: res.status, body, headers: res.headers };
  }
  const login = async (email) => (await api('POST', '/auth/login', { cuerpo: { email, password: 'remitto123' } })).body?.token;

  // --- Base propia ---
  admin = new PrismaClient({ datasources: { db: { url: urlConBase(original, 'postgres') } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${nombreBase}"`);
  } catch (err) {
    throw new ErrorAislamiento(`No se pudo crear ${nombreBase} (¿ya existe?): ${err.message.split('\n').pop()}`);
  }
  baseCreada = true;
  console.log(`Base descartable: ${nombreBase} · API en el puerto ${puerto}`);

  uploads = mkdtempSync(path.join(os.tmpdir(), 'remitto-e2e-'));
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
  nodo(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  nodo(['prisma/seed.js']);

  // --- API propia ---
  servidor = spawn(process.execPath, ['src/server.js'], { cwd: raiz, env: entorno, stdio: ['ignore', 'ignore', 'pipe'] });
  let salida = null;
  servidor.once('exit', (codigo) => {
    salida = codigo ?? 'señal';
  });
  servidor.stderr.on('data', (d) => process.env.E2E_VERBOSO && process.stderr.write(d));
  let lista = false;
  for (let i = 0; i < 100 && !lista; i += 1) {
    if (salida !== null) throw new ErrorAislamiento(`La API de prueba terminó al arrancar (código ${salida}).`);
    try {
      lista = (await fetch(`${base}/health`)).ok;
    } catch {
      // todavía no escucha
    }
    if (!lista) await new Promise((r) => setTimeout(r, 150));
  }
  if (salida !== null) throw new ErrorAislamiento(`La API de prueba terminó al arrancar (código ${salida}).`);
  if (!lista) throw new ErrorAislamiento('La API de prueba no respondió.');

  const db = new PrismaClient({ datasources: { db: { url: urlE2e } } });
  try {
    // --- La API que responde usa esta base ---
    // Se escribe una marca aleatoria directo en la base propia y se busca por
    // la API. Iniciar sesión no escribe; ninguna operación de negocio se envía
    // antes de este control.
    const marca = `e2e-marca-${randomBytes(8).toString('hex')}`;
    const fila = await db.categoria.create({ data: { nombre: marca } });
    const dueño = await login('carlos@doncarlos.com.ar');
    const categorias = dueño ? await api('GET', '/categorias', { token: dueño }) : null;
    if (!Array.isArray(categorias?.body) || !categorias.body.some((c) => c.nombre === marca)) {
      throw new ErrorAislamiento('La API que responde no usa la base de prueba (no encontró la marca). No se envió ninguna operación.');
    }
    await db.categoria.delete({ where: { id: fila.id } });

    const contexto = { api, base, check, db, login, dueño, empleado: await login('empleado@doncarlos.com.ar') };
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
  if (err instanceof ErrorAislamiento) {
    codigoSalida = 2;
    console.error(`\nABORTADO (aislamiento): ${err.message}`);
  } else {
    fallas += 1;
    console.error(`\nERROR: ${err.stack ?? err.message}`);
  }
} finally {
  // Solo se limpia lo propio: el proceso hijo, la base si se llegó a crear y
  // la carpeta temporal.
  if (servidor && servidor.exitCode === null && servidor.signalCode === null) {
    servidor.kill();
    await new Promise((r) => servidor.once('exit', r));
  }
  if (baseCreada && !process.env.E2E_CONSERVAR) {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`).catch((e) => {
      fallas += 1;
      console.error(`No se pudo borrar ${nombreBase}: ${e.message}`);
    });
  } else if (baseCreada) {
    console.log(`\nSe conserva la base ${nombreBase}.`);
  }
  if (admin) await admin.$disconnect();
  if (uploads) rmSync(uploads, { recursive: true, force: true });
}

if (codigoSalida === 2) process.exit(2);
if (resultados.length) console.log(`\n${resultados.join(' · ')}`);
console.log(fallas === 0 ? `TODO CORRECTO: ${controles} controles` : `${fallas} FALLAS de ${controles} controles`);
process.exit(fallas === 0 ? 0 : 1);
