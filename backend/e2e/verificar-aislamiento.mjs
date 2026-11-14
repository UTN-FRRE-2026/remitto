// Verifica que el ejecutor de punta a punta (correr.mjs) usa solo sus propios
// recursos y aborta, sin enviar operaciones, cuando no puede garantizarlo.
//
//   node e2e/verificar-aislamiento.mjs      (npm run e2e:aislamiento)
//
// Casos: API ajena en el puerto pedido, API ajena que responde health y login
// pero no usa la base de prueba (control de la marca), API propia que cae al
// arrancar, nombres de base no permitidos, choque con una base existente y
// dos ejecuciones en paralelo. En todos se comprueba que no quedan bases
// remitto_e2e_ y que las bases ajenas siguen existiendo.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { urlOriginal, urlConBase, elegirPuerto } from './conexion.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = urlOriginal();
const admin = new PrismaClient({ datasources: { db: { url: urlConBase(original, 'postgres') } } });

let fallas = 0;
let controles = 0;
function check(condicion, mensaje) {
  controles += 1;
  if (!condicion) fallas += 1;
  console.log(`  ${condicion ? 'ok ' : 'MAL'} ${mensaje}`);
}

const basesE2e = async () =>
  (await admin.$queryRaw`SELECT datname FROM pg_database WHERE datname LIKE 'remitto\\_e2e\\_%' ORDER BY 1`).map((f) => f.datname);
const existe = async (nombre) => (await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${nombre}`).length === 1;

// Corre el ejecutor y devuelve su código de salida y lo que imprimió.
function correr(escenarios, entorno = {}) {
  return new Promise((resolver) => {
    const hijo = spawn(process.execPath, ['e2e/correr.mjs', ...escenarios], {
      cwd: raiz,
      env: { ...process.env, ...entorno },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let salida = '';
    hijo.stdout.on('data', (d) => (salida += d));
    hijo.stderr.on('data', (d) => (salida += d));
    hijo.once('exit', (codigo) => resolver({ codigo, salida }));
  });
}

// API de mentira: responde /api/health y, si se pide, login y categorías sin
// la marca. Registra cada pedido recibido.
async function apiAjena({ conLogin = false } = {}) {
  const pedidos = [];
  const servidor = http.createServer((req, res) => {
    pedidos.push(`${req.method} ${req.url}`);
    const json = (codigo, cuerpo) => {
      res.writeHead(codigo, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cuerpo));
    };
    if (req.url === '/api/health') return json(200, { ok: true, servicio: 'remitto-api' });
    if (conLogin && req.url === '/api/auth/login') return json(200, { token: 'token-ajeno', usuario: { rol: 'PROPIETARIO' } });
    if (conLogin && req.url.startsWith('/api/categorias')) return json(200, [{ id: 1, nombre: 'Bebidas' }]);
    return json(201, { id: 1, clave: `rmt_live_${'a'.repeat(64)}`, prefijo: 'rmt_live_aaaaaa' });
  });
  const puerto = await elegirPuerto();
  await new Promise((r) => servidor.listen(puerto, r));
  return { puerto, pedidos, cerrar: () => new Promise((r) => servidor.close(r)) };
}

// Pedidos de negocio: cualquiera que no sea health, login o la lectura de
// categorías del control de la marca.
const deNegocio = (pedidos) =>
  pedidos.filter((p) => !['GET /api/health', 'POST /api/auth/login', 'GET /api/categorias'].includes(p));

const basesAntes = await basesE2e();
check(basesAntes.length === 0, `sin bases remitto_e2e_ al empezar (${basesAntes.join(', ') || 'ninguna'})`);

// 1. Otra API ocupa el puerto pedido y responde health.
{
  console.log('\n== API ajena en el puerto pedido');
  const ajena = await apiAjena();
  const r = await correr(['hu21-claves'], { E2E_PUERTO: String(ajena.puerto) });
  await ajena.cerrar();
  check(r.codigo === 2 && /ya está en uso/.test(r.salida), `el ejecutor aborta con código 2 (${r.codigo})`);
  check(deNegocio(ajena.pedidos).length === 0, `la API ajena no recibió operaciones (${ajena.pedidos.length} pedidos en total)`);
  check((await basesE2e()).length === 0, 'no creó ninguna base');
}

// 2. Una API responde health y login pero no usa la base de prueba.
{
  console.log('\n== API ajena sin la marca de la base de prueba');
  const ajena = await apiAjena({ conLogin: true });
  const r = await correr(['hu21-claves'], { E2E_URL_API: `http://localhost:${ajena.puerto}/api` });
  await ajena.cerrar();
  check(r.codigo === 2 && /no usa la base de prueba/.test(r.salida), `el ejecutor aborta con código 2 por la marca (${r.codigo})`);
  check(
    deNegocio(ajena.pedidos).length === 0,
    `antes de abortar solo envió health, login y la lectura de categorías (${[...new Set(ajena.pedidos)].join(', ')})`,
  );
  check((await basesE2e()).length === 0, 'borró su propia base');
}

// 3. La API propia cae al arrancar (configuración inválida).
{
  console.log('\n== La API de prueba cae al arrancar');
  const r = await correr(['hu21-claves'], { ARCHIVO_MAX_MB: '-1' });
  check(r.codigo === 2 && /terminó al arrancar/.test(r.salida), `el ejecutor aborta con código 2 (${r.codigo})`);
  check(!/== hu21-claves/.test(r.salida), 'no corrió ningún escenario');
  check((await basesE2e()).length === 0, 'borró su propia base');
}

// 4. Nombres de base no permitidos: se rechazan antes de cualquier SQL.
{
  console.log('\n== Nombres de base no permitidos');
  const desarrollo = decodeURIComponent(original.pathname.slice(1));
  const nombres = ['remitto', 'postgres', 'template1', desarrollo, 'remitto_e2e_', 'remitto_e2e_X', 'remitto_e2e_a"; DROP DATABASE remitto; --', 'otra_e2e_base', 'remitto_e2e_a-b'];
  for (const nombre of nombres) {
    const r = await correr(['hu21-claves'], { E2E_BASE: nombre });
    check(r.codigo === 2 && /Nombre de base no permitido/.test(r.salida), `rechaza ${JSON.stringify(nombre)} (${r.codigo})`);
  }
  check(await existe(desarrollo), `la base de desarrollo «${desarrollo}» sigue existiendo`);
  check((await basesE2e()).length === 0, 'no creó ninguna base');
}

// 5. Choque con una base existente: aborta y no la borra.
{
  console.log('\n== Choque de nombre');
  const ajena = `remitto_e2e_choque_${randomBytes(3).toString('hex')}`;
  await admin.$executeRawUnsafe(`CREATE DATABASE "${ajena}"`);
  const r = await correr(['hu21-claves'], { E2E_BASE: ajena });
  check(r.codigo === 2 && /No se pudo crear/.test(r.salida), `el ejecutor aborta con código 2 (${r.codigo})`);
  check(await existe(ajena), 'la base que ya existía sigue existiendo');
  await admin.$executeRawUnsafe(`DROP DATABASE "${ajena}"`);
}

// 6. Dos ejecuciones en paralelo.
{
  console.log('\n== Dos ejecuciones en paralelo');
  const [a, b] = await Promise.all([correr(['hu21-claves']), correr(['hu21-claves'])]);
  const nombre = (r) => r.salida.match(/Base descartable: (\S+)/)?.[1];
  check(a.codigo === 0 && b.codigo === 0, `las dos terminan bien (${a.codigo}, ${b.codigo})`);
  check(nombre(a) && nombre(b) && nombre(a) !== nombre(b), `con bases distintas (${nombre(a)}, ${nombre(b)})`);
  check((await basesE2e()).length === 0, 'cada una borró la suya');
}

await admin.$disconnect();
console.log(fallas === 0 ? `\nTODO CORRECTO: ${controles} controles` : `\n${fallas} FALLAS de ${controles} controles`);
process.exit(fallas === 0 ? 0 : 1);
