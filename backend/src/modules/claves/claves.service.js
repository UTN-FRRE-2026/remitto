import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

// HU21 (RF5.1, RNF1): claves de integración. La clave completa se muestra una
// sola vez, al crearla; en la base quedan solo su prefijo (para reconocerla)
// y su hash SHA-256 (para validarla). Como la clave tiene 256 bits
// aleatorios, un hash rápido alcanza: no hay diccionario que probar, y
// permite buscarla directo por el índice único de hash_clave.

const PREFIJO = 'rmt_live_';
// Caracteres que se guardan y se muestran para reconocer la clave.
const LARGO_PREFIJO = PREFIJO.length + 6;
const FORMATO = /^rmt_live_[0-9a-f]{64}$/;

export const hashClave = (clave) => createHash('sha256').update(clave, 'utf8').digest('hex');

export function generarClave() {
  const clave = PREFIJO + randomBytes(32).toString('hex');
  return { clave, prefijo: clave.slice(0, LARGO_PREFIJO), hash: hashClave(clave) };
}

export const formatoValido = (clave) => typeof clave === 'string' && FORMATO.test(clave);

// Lo que se puede mostrar de una clave. Nunca incluye el hash ni la clave.
const seleccion = {
  id: true,
  nombre: true,
  prefijo: true,
  activa: true,
  creadaEn: true,
  ultimoUsoEn: true,
  revocadaEn: true,
  creadaPor: { select: { id: true, nombre: true } },
};

export function listar() {
  return prisma.claveIntegracion.findMany({
    select: seleccion,
    orderBy: [{ activa: 'desc' }, { creadaEn: 'desc' }, { id: 'desc' }],
  });
}

const esUnico = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export async function crear({ nombre }, usuarioId) {
  // Un choque de prefijo es muy improbable (24 bits); si pasa, se genera otra.
  for (let intento = 1; ; intento += 1) {
    const { clave, prefijo, hash } = generarClave();
    try {
      const creada = await prisma.claveIntegracion.create({
        data: { nombre, prefijo, hashClave: hash, creadaPorId: usuarioId },
        select: seleccion,
      });
      // Única vez que sale la clave completa: no se guarda en ningún lado.
      return { ...creada, clave };
    } catch (err) {
      if (!esUnico(err) || intento >= 3) throw err;
    }
  }
}

// Revoca la clave (no se borra: queda para el historial de salidas). Repetirlo
// no cambia nada y devuelve el estado actual.
export async function revocar(id) {
  await prisma.claveIntegracion.updateMany({
    where: { id, activa: true },
    data: { activa: false, revocadaEn: new Date() },
  });
  const clave = await prisma.claveIntegracion.findUnique({ where: { id }, select: seleccion });
  if (!clave) throw ApiError.noEncontrado('Clave no encontrada');
  return clave;
}

// Valida una clave recibida y registra su uso, en una sola sentencia: si la
// clave se revoca al mismo tiempo, o se usa antes de revocarse (y cuenta como
// uso) o se rechaza. Devuelve { id, nombre, prefijo } o null si no es válida.
// La reutiliza el endpoint de integración (HU22).
export async function validarClave(clave, db = prisma) {
  if (!formatoValido(clave)) return null;
  const [fila] = await db.$queryRaw`
    UPDATE claves_integracion SET ultimo_uso_en = now()
    WHERE hash_clave = ${hashClave(clave)} AND activa
    RETURNING id, nombre, prefijo`;
  return fila ?? null;
}
