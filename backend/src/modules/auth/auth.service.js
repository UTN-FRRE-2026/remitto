import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

function datosPublicos(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };
}

// HU1: inicia sesión validando credenciales y devuelve un token + el usuario.
export async function login({ email, password }) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mensaje genérico para no revelar si el correo existe.
  if (!usuario || !usuario.activo) {
    throw ApiError.noAutorizado('Credenciales incorrectas');
  }

  const coincide = await bcrypt.compare(password, usuario.passwordHash);
  if (!coincide) {
    throw ApiError.noAutorizado('Credenciales incorrectas');
  }

  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

  return { token, usuario: datosPublicos(usuario) };
}

export async function perfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw ApiError.noEncontrado('Usuario no encontrado');
  return datosPublicos(usuario);
}
