// Utilidades compartidas por el ejecutor de punta a punta y su verificación
// de aislamiento: URL de las bases descartables y validación de sus nombres.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import net from 'node:net';

export const PREFIJO_BASE = 'remitto_e2e_';
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

// Error que impide garantizar que las pruebas usan sus propios recursos. El
// ejecutor termina con código 2 sin correr escenarios.
export class ErrorAislamiento extends Error {}

export function urlOriginal() {
  let url;
  try {
    url = new URL(process.env.DATABASE_URL ?? '');
  } catch {
    throw new ErrorAislamiento('DATABASE_URL no es una URL válida.');
  }
  if (!HOSTS_LOCALES.has(url.hostname)) {
    throw new ErrorAislamiento('DATABASE_URL no apunta a localhost: las pruebas de punta a punta solo corren contra una base local.');
  }
  return url;
}

export function urlConBase(original, nombre) {
  const u = new URL(original);
  u.pathname = `/${nombre}`;
  return u.toString();
}

// Nombre único: fecha con milisegundos, proceso y 6 caracteres aleatorios.
export function nombreNuevo() {
  const fecha = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
  return `${PREFIJO_BASE}${fecha}_${process.pid}_${randomBytes(3).toString('hex')}`;
}

// Solo se aceptan nombres de prueba: prefijo remitto_e2e_, minúsculas,
// dígitos y guion bajo (un identificador SQL que no necesita escaparse) y
// nunca el de una base habitual. Se valida antes de cualquier SQL.
export function validarNombreBase(nombre, original) {
  const reservados = new Set(['postgres', 'template0', 'template1', 'remitto', decodeURIComponent(original.pathname.slice(1))]);
  if (typeof nombre !== 'string' || !/^remitto_e2e_[a-z0-9_]{1,45}$/.test(nombre) || reservados.has(nombre)) {
    throw new ErrorAislamiento(
      `Nombre de base no permitido: ${JSON.stringify(nombre)}. Debe empezar con ${PREFIJO_BASE} y tener solo minúsculas, dígitos y guiones bajos.`,
    );
  }
  return nombre;
}

// ¿Algo acepta conexiones en ese puerto (IPv4 o IPv6)?
async function alguienEscucha(puerto) {
  const intentar = (host) =>
    new Promise((resolver) => {
      const s = net.connect({ port: puerto, host });
      const fin = (r) => {
        s.destroy();
        resolver(r);
      };
      s.setTimeout(400, () => fin(false));
      s.once('connect', () => fin(true));
      s.once('error', () => fin(false));
    });
  return (await intentar('127.0.0.1')) || (await intentar('::1'));
}

// Puerto para la API de prueba. Sin E2E_PUERTO, uno libre que asigna el
// sistema; con E2E_PUERTO, se exige que esté libre.
export async function elegirPuerto(pedido) {
  if (pedido !== undefined) {
    const puerto = Number(pedido);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new ErrorAislamiento(`E2E_PUERTO no válido: ${pedido}`);
    if (await alguienEscucha(puerto)) {
      throw new ErrorAislamiento(`El puerto ${puerto} ya está en uso: otra aplicación podría responder en lugar de la API de prueba.`);
    }
    return puerto;
  }
  const puerto = await new Promise((resolver, rechazar) => {
    const s = net.createServer();
    s.once('error', rechazar);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolver(port));
    });
  });
  if (await alguienEscucha(puerto)) throw new ErrorAislamiento(`El puerto ${puerto} quedó ocupado.`);
  return puerto;
}
