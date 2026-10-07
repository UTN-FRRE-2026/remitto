import { ApiError } from '../lib/errors.js';

// Valida req.body / req.query / req.params contra un esquema de Zod.
// Reemplaza la fuente por los datos ya parseados (con coerción de tipos).
export const validar = (schema, fuente = 'body') => (req, res, next) => {
  const resultado = schema.safeParse(req[fuente]);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    return next(ApiError.invalido('Datos inválidos', detalles));
  }
  req[fuente] = resultado.data;
  next();
};
