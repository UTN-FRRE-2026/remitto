import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

const CORREO_REPETIDO = 'Ya existe un usuario con ese correo.';

// HU3: el único campo único de usuarios es el correo.
export function traducirErrorUsuario(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return ApiError.conflicto(CORREO_REPETIDO);
  }
  return err;
}

// Los correos nuevos se guardan en minúsculas; la comparación sin distinguir
// mayúsculas cubre también los que se hayan cargado antes con mayúsculas.
async function verificarCorreoLibre(email, idActual) {
  const existente = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, ...(idActual ? { id: { not: idActual } } : {}) },
    select: { id: true },
  });
  if (existente) throw ApiError.conflicto(CORREO_REPETIDO);
}

const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  creadoEn: true,
};

export function listar() {
  return prisma.usuario.findMany({
    select: SELECT_PUBLICO,
    orderBy: { nombre: 'asc' },
  });
}

export async function obtener(id) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: SELECT_PUBLICO });
  if (!usuario) throw ApiError.noEncontrado('Usuario no encontrado');
  return usuario;
}

export async function crear({ nombre, email, password, rol }) {
  await verificarCorreoLibre(email);
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await prisma.usuario.create({
      data: { nombre, email, passwordHash, rol },
      select: SELECT_PUBLICO,
    });
  } catch (err) {
    throw traducirErrorUsuario(err);
  }
}

export async function actualizar(id, datos, usuarioActual) {
  const { password, ...resto } = datos;
  const data = { ...resto };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  // Un propietario no puede quitarse a sí mismo el rol ni desactivarse,
  // para no dejar el comercio sin administrador.
  if (id === usuarioActual.id) {
    if (data.activo === false) {
      throw ApiError.invalido('No podés desactivar tu propia cuenta');
    }
    if (data.rol && data.rol !== 'PROPIETARIO') {
      throw ApiError.invalido('No podés quitarte el rol de propietario');
    }
  }

  await obtener(id); // 404 si no existe
  if (data.email) await verificarCorreoLibre(data.email, id);
  try {
    return await prisma.usuario.update({ where: { id }, data, select: SELECT_PUBLICO });
  } catch (err) {
    throw traducirErrorUsuario(err);
  }
}

// No se eliminan usuarios: se desactivan (conservan la trazabilidad de movimientos).
export async function desactivar(id, usuarioActual) {
  if (id === usuarioActual.id) {
    throw ApiError.invalido('No podés desactivar tu propia cuenta');
  }
  await obtener(id);
  return prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: SELECT_PUBLICO,
  });
}
