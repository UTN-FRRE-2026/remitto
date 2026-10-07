import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

// RF1.1 / RNF1: exige una sesión autenticada por JWT.
// Agrega req.usuario = { id, nombre, email, rol }.
export const autenticar = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const [esquema, token] = header.split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw ApiError.noAutorizado('Falta el token de sesión');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw ApiError.noAutorizado('Sesión inválida o expirada');
    }

    // Se relee el usuario para respetar la desactivación en tiempo real (HU3).
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      throw ApiError.noAutorizado('Usuario inexistente o desactivado');
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

// RF1.2: restringe una ruta a determinados roles.
// Ej: exigirRol('PROPIETARIO')
export const exigirRol = (...roles) => (req, res, next) => {
  if (!req.usuario) return next(ApiError.noAutorizado());
  if (!roles.includes(req.usuario.rol)) {
    return next(ApiError.prohibido('Esta acción es solo para el propietario'));
  }
  next();
};
