import multer from 'multer';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';

// HU8: recibe un único archivo en memoria (campo "archivo"). Nada toca el disco
// hasta que el contenido se valida, así un rechazo no deja temporales.
const recibir = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.archivoMaxMb * 1024 * 1024,
    files: 1,
    fields: 10,
    parts: 11,
  },
}).single('archivo');

function traducir(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new ApiError(413, `El archivo supera el máximo de ${env.archivoMaxMb} MB.`);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return ApiError.invalido('Enviá un solo archivo, en el campo "archivo".');
    default:
      return ApiError.invalido('La solicitud tiene más datos de los permitidos.');
  }
}

export function recibirArchivo(req, res, next) {
  recibir(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) return next(traducir(err));
    // Errores de busboy: multipart mal formado o cortado.
    return next(ApiError.invalido('No se pudo leer el archivo enviado. Probá de nuevo.'));
  });
}
