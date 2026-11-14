import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/errors.js';
import { esProduccion } from '../config/env.js';

// Middleware central de errores. Traduce errores conocidos a respuestas JSON.
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }

  // Cuerpo que no es JSON válido o que supera el límite (express.json): es un
  // error de quien envía el pedido, no del servidor.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo del pedido no es un JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo del pedido es demasiado grande.' });
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
    // Sin conexiones libres para empezar la transacción: el servidor está
    // saturado. No se registró nada y se puede reintentar (los reenvíos son
    // idempotentes en salidas, ingresos y ventas externas).
    if (err.code === 'P2028') {
      res.set('Retry-After', '2');
      return res.status(503).json({ error: 'El servidor está ocupado. Reintentá en unos segundos.' });
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
