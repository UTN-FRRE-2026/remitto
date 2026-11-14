// HU21: claves de integración (criterios: la clave completa no vuelve a
// consultarse, una clave revocada deja de ser aceptada y solo el propietario
// las administra).
import { createHash } from 'node:crypto';

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function hu21({ api, check, db, dueño, empleado }) {
  const estado = (clave, extra = {}) =>
    api('GET', '/v1/integracion/estado', { headers: { Authorization: `Bearer ${clave}`, ...extra } });

  // --- Permisos ---
  check((await api('GET', '/claves-integracion')).status === 401, 'sin sesión: 401');
  check((await api('GET', '/claves-integracion', { token: 'no-es-un-token' })).status === 401, 'token inválido: 401');
  check((await api('GET', '/claves-integracion', { token: empleado })).status === 403, 'empleado no lista claves (403)');
  check(
    (await api('POST', '/claves-integracion', { token: empleado, cuerpo: { nombre: 'Caja' } })).status === 403,
    'empleado no genera claves (403)',
  );
  check((await db.claveIntegracion.count()) === 0, 'el pedido del empleado no creó ninguna clave');
  const vacia = await api('GET', '/claves-integracion', { token: dueño });
  check(vacia.status === 200 && Array.isArray(vacia.body) && vacia.body.length === 0, 'propietario: listado vacío');

  // --- Validación ---
  check((await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: '  ' } })).status === 400, 'nombre vacío: 400');
  check(
    (await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: 'Caja', hashClave: 'x' } })).status === 400,
    'campos extra (hashClave): 400',
  );

  // --- Generar: la clave completa sale una sola vez ---
  const a = await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: ' Caja del mostrador ' } });
  const claveA = a.body?.clave;
  check(a.status === 201 && /^rmt_live_[0-9a-f]{64}$/.test(claveA ?? ''), 'generar: 201 con la clave completa');
  check(a.body.nombre === 'Caja del mostrador' && a.body.prefijo === claveA.slice(0, 15), 'nombre recortado y prefijo visible');
  check(a.body.hashClave === undefined, 'la respuesta no incluye el hash');
  const filaA = await db.claveIntegracion.findUnique({ where: { id: a.body.id } });
  check(filaA.hashClave === sha256(claveA), 'en la base queda el SHA-256 de la clave');
  const enTexto = await db.$queryRaw`
    SELECT count(*)::int AS n FROM claves_integracion c WHERE position(${claveA.slice(15)} in row_to_json(c)::text) > 0`;
  check(enTexto[0].n === 0, 'la parte secreta de la clave no figura en ninguna columna');

  const listado = await api('GET', '/claves-integracion', { token: dueño });
  const textoListado = JSON.stringify(listado.body);
  check(
    listado.status === 200 && !textoListado.includes(claveA.slice(15)) && !textoListado.includes(filaA.hashClave),
    'criterio: el listado no vuelve a mostrar la clave ni su hash',
  );
  check(listado.body[0].ultimoUsoEn === null && listado.body[0].creadaPor?.nombre === 'Carlos Gómez', 'último uso «nunca» y quién la creó');

  // --- Uso de la clave ---
  const ok = await estado(claveA);
  check(ok.status === 200 && ok.body.clave?.nombre === 'Caja del mostrador', 'la clave autentica a la caja (GET /v1/integracion/estado)');
  const uso1 = (await db.claveIntegracion.findUnique({ where: { id: a.body.id } })).ultimoUsoEn;
  check(uso1 instanceof Date, 'se registra la fecha de último uso');
  await espera(20);
  check((await estado(claveA, { Authorization: `bearer ${claveA}` })).status === 200, 'el esquema «bearer» no distingue mayúsculas');
  const uso2 = (await db.claveIntegracion.findUnique({ where: { id: a.body.id } })).ultimoUsoEn;
  check(uso2 > uso1, 'cada uso actualiza la fecha');

  check((await api('GET', '/v1/integracion/estado')).status === 401, 'sin clave: 401');
  check((await estado('rmt_live_123')).status === 401, 'formato inválido: 401');
  check((await estado(`rmt_live_${'0'.repeat(64)}`)).status === 401, 'clave inexistente con formato válido: 401');
  check((await estado(dueño)).status === 401, 'el token de una persona no sirve como clave de integración');
  check((await api('GET', '/productos', { token: claveA })).status === 401, 'la clave no sirve para la API de personas');

  // --- Revocar ---
  const b = await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: 'Caja 2' } });
  check(b.status === 201 && b.body.prefijo !== a.body.prefijo, 'segunda clave con otro prefijo');
  check((await api('DELETE', `/claves-integracion/${a.body.id}`, { token: empleado })).status === 403, 'empleado no revoca (403)');
  check((await estado(claveA)).status === 200, 'la clave sigue activa tras el intento del empleado');

  const rev = await api('DELETE', `/claves-integracion/${a.body.id}`, { token: dueño });
  check(rev.status === 200 && rev.body.activa === false && rev.body.revocadaEn, 'propietario revoca: activa = false con fecha');
  const usoAntes = (await db.claveIntegracion.findUnique({ where: { id: a.body.id } })).ultimoUsoEn;
  const tras = await estado(claveA);
  check(tras.status === 401, 'criterio: una clave revocada deja de ser aceptada');
  check(
    (await db.claveIntegracion.findUnique({ where: { id: a.body.id } })).ultimoUsoEn.getTime() === usoAntes.getTime(),
    'un intento con la clave revocada no cuenta como uso',
  );
  check((await estado(b.body.clave)).status === 200, 'revocar una clave no afecta a las demás');
  const otraVez = await api('DELETE', `/claves-integracion/${a.body.id}`, { token: dueño });
  check(otraVez.status === 200 && otraVez.body.revocadaEn === rev.body.revocadaEn, 'revocar de nuevo no cambia la fecha');
  check((await api('DELETE', '/claves-integracion/99999', { token: dueño })).status === 404, 'clave inexistente: 404');
  check((await api('DELETE', '/claves-integracion/abc', { token: dueño })).status === 400, 'id no numérico: 400');

  const orden = (await api('GET', '/claves-integracion', { token: dueño })).body;
  check(orden.map((c) => c.nombre).join() === 'Caja 2,Caja del mostrador', 'el listado muestra primero las activas');

  // --- Restricción en la base (migración HU21) ---
  let rechazada = false;
  try {
    await db.$executeRaw`UPDATE claves_integracion SET activa = false WHERE id = ${b.body.id}`;
  } catch {
    rechazada = true;
  }
  check(rechazada, 'CHECK chk_clave_revocada: no se puede desactivar sin fecha de revocación');

  // --- Revocación con pedidos en curso ---
  // Muchos pedidos simultáneos mientras se revoca: todo pedido posterior a la
  // respuesta de la revocación se rechaza.
  const c = await api('POST', '/claves-integracion', { token: dueño, cuerpo: { nombre: 'Caja 3' } });
  const enCurso = Array.from({ length: 40 }, () => estado(c.body.clave));
  const revC = await api('DELETE', `/claves-integracion/${c.body.id}`, { token: dueño });
  const durante = await Promise.all(enCurso);
  const despues = await Promise.all(Array.from({ length: 20 }, () => estado(c.body.clave)));
  check(revC.status === 200 && durante.every((r) => [200, 401].includes(r.status)), 'pedidos durante la revocación: 200 o 401, sin errores');
  check(despues.every((r) => r.status === 401), 'después de revocar, 20 de 20 pedidos rechazados');
}
