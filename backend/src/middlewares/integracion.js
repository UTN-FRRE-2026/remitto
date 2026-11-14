import { ApiError } from '../lib/errors.js';
import { validarClave } from '../modules/claves/claves.service.js';

// HU21/HU22 (RF5.2): autentica a un sistema externo con su clave de
// integración, enviada como "Authorization: Bearer rmt_live_...". Agrega
// req.claveIntegracion = { id, nombre, prefijo } y registra el uso. Una clave
// inexistente o revocada recibe el mismo 401, sin dar pistas de cuál es.
// El nombre del esquema no distingue mayúsculas (RFC 9110).
export function extraerClave(header = '') {
  const partes = String(header).trim().split(/\s+/);
  return partes.length === 2 && partes[0].toLowerCase() === 'bearer' ? partes[1] : null;
}

export function crearAutenticarIntegracion(validar = validarClave) {
  return async (req, res, next) => {
    try {
      const clave = extraerClave(req.headers.authorization);
      if (!clave) throw ApiError.noAutorizado('Falta la clave de integración');
      const valida = await validar(clave);
      if (!valida) throw ApiError.noAutorizado('Clave de integración inválida o revocada');
      req.claveIntegracion = valida;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const autenticarIntegracion = crearAutenticarIntegracion();
