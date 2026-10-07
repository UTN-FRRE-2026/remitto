// Error de dominio con código HTTP. Lo captura el middleware de errores.
export class ApiError extends Error {
  constructor(status, mensaje, detalles = undefined) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }

  static noAutorizado(mensaje = 'No autenticado') {
    return new ApiError(401, mensaje);
  }

  static prohibido(mensaje = 'No tenés permiso para esta acción') {
    return new ApiError(403, mensaje);
  }

  static noEncontrado(mensaje = 'Recurso no encontrado') {
    return new ApiError(404, mensaje);
  }

  static conflicto(mensaje = 'El recurso ya existe') {
    return new ApiError(409, mensaje);
  }

  static invalido(mensaje = 'Datos inválidos', detalles) {
    return new ApiError(400, mensaje, detalles);
  }
}

// Envuelve controladores async para que los errores lleguen al middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
