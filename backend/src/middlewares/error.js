import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/errors.js';
import { esProduccion } from '../config/env.js';

// Middleware central de errores. Traduce errores conocidos a respuestas JSON.
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }

  // Violaciones de restricciones de Prisma (RNF5: reglas en la base).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const campos = err.meta?.target;
      return res.status(409).json({
        error: 'Ya existe un registro con ese valor único.',
        detalles: campos,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Recurso no encontrado.' });
    }
  }

  if (!esProduccion) {
    console.error(err);
  }

  return res.status(500).json({ error: 'Error interno del servidor.' });
}

export function noEncontrado(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}
