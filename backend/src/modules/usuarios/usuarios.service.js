import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

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
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.usuario.create({
    data: { nombre, email, passwordHash, rol },
    select: SELECT_PUBLICO,
  });
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
  return prisma.usuario.update({ where: { id }, data, select: SELECT_PUBLICO });
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
