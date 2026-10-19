import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';

// HU8: formatos admitidos. Un archivo se acepta solo si su extensión, el MIME
// declarado por el cliente y la firma real de sus primeros bytes coinciden.
// HEIC/HEIF se admite porque es el formato por defecto de la cámara del iPhone;
// algunos navegadores no informan su MIME, por eso acepta "desconocido".
const MIME_DESCONOCIDO = ['', 'application/octet-stream'];

export const FORMATOS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', extensiones: ['jpg', 'jpeg'], mimes: ['image/jpeg', 'image/pjpeg'], origen: 'FOTO' },
  png: { mime: 'image/png', ext: 'png', extensiones: ['png'], mimes: ['image/png'], origen: 'FOTO' },
  webp: { mime: 'image/webp', ext: 'webp', extensiones: ['webp'], mimes: ['image/webp'], origen: 'FOTO' },
  heic: {
    mime: 'image/heic',
    ext: 'heic',
    extensiones: ['heic', 'heif'],
    mimes: ['image/heic', 'image/heif', ...MIME_DESCONOCIDO],
    origen: 'FOTO',
  },
  heif: {
    mime: 'image/heif',
    ext: 'heif',
    extensiones: ['heic', 'heif'],
    mimes: ['image/heic', 'image/heif', ...MIME_DESCONOCIDO],
    origen: 'FOTO',
  },
  pdf: { mime: 'application/pdf', ext: 'pdf', extensiones: ['pdf'], mimes: ['application/pdf'], origen: 'PDF' },
};

export const DESCRIPCION_FORMATOS = 'una foto JPG, PNG, WEBP o HEIC, o un PDF';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MARCAS_HEIC = ['heic', 'heix'];
const MARCAS_HEIF = ['mif1', 'msf1', 'heif'];

// Reconoce el formato por la firma del contenido, sin confiar en el nombre.
function detectarFormato(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(FIRMA_PNG)) return 'png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp') {
    const marca = b.toString('latin1', 8, 12);
    if (MARCAS_HEIC.includes(marca)) return 'heic';
    if (MARCAS_HEIF.includes(marca)) return 'heif';
  }
  // Un PDF empieza con "%PDF-" y termina con "%%EOF" (se descartan PDFs truncados).
  if (
    b.length >= 8 &&
    b.toString('latin1', 0, 5) === '%PDF-' &&
    b.toString('latin1', Math.max(0, b.length - 1024)).includes('%%EOF')
  ) {
    return 'pdf';
  }
  return null;
}

// Devuelve el formato validado o lanza un 400 con un mensaje para el usuario.
export function validarArchivo(archivo) {
  if (!archivo) {
    throw ApiError.invalido('Adjuntá la foto o el PDF del comprobante.', [
      { campo: 'archivo', mensaje: 'Falta el archivo' },
    ]);
  }
  if (archivo.size === 0) {
    throw ApiError.invalido('El archivo está vacío.', [{ campo: 'archivo', mensaje: 'Archivo vacío' }]);
  }

  const extension = path.extname(archivo.originalname ?? '').slice(1).toLowerCase();
  const candidatos = Object.values(FORMATOS).filter((f) => f.extensiones.includes(extension));
  if (candidatos.length === 0) {
    throw ApiError.invalido(`Formato no admitido. Subí ${DESCRIPCION_FORMATOS}.`, [
      { campo: 'archivo', mensaje: `Extensión no admitida: ${extension ? `.${extension}` : 'sin extensión'}` },
    ]);
  }

  const mimeDeclarado = (archivo.mimetype ?? '').toLowerCase();
  if (!candidatos.some((f) => f.mimes.includes(mimeDeclarado))) {
    throw ApiError.invalido(`El tipo del archivo no coincide con su extensión .${extension}.`, [
      { campo: 'archivo', mensaje: `MIME declarado: ${mimeDeclarado || 'ninguno'}` },
    ]);
  }

  const detectado = detectarFormato(archivo.buffer);
  if (!detectado) {
    throw ApiError.invalido(`El contenido del archivo no es válido. Subí ${DESCRIPCION_FORMATOS}.`, [
      { campo: 'archivo', mensaje: 'Contenido no reconocido' },
    ]);
  }
  const formato = FORMATOS[detectado];
  if (!formato.extensiones.includes(extension)) {
    throw ApiError.invalido(`El contenido del archivo no coincide con su extensión .${extension}.`, [
      { campo: 'archivo', mensaje: `El contenido es ${formato.ext.toUpperCase()}` },
    ]);
  }
  return formato;
}

// Guarda el archivo con un nombre generado por el servidor (nunca el original).
// Devuelve la clave relativa a uploadsDir, que es lo que se persiste en la base.
export async function guardarArchivo(buffer, formato) {
  const clave = `comprobantes/${randomUUID()}.${formato.ext}`;
  const destino = rutaAbsoluta(clave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer, { flag: 'wx' });
  return clave;
}

// HU9: contenido del archivo para enviarlo a la IA.
export function leerArchivo(clave) {
  return fs.readFile(rutaAbsoluta(clave));
}

export async function eliminarArchivo(clave) {
  try {
    await fs.unlink(rutaAbsoluta(clave));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`No se pudo eliminar ${clave}:`, err.message);
  }
}

// Resuelve una clave a ruta absoluta, sin permitir salir de uploadsDir.
export function rutaAbsoluta(clave) {
  const ruta = path.resolve(env.uploadsDir, clave);
  if (!ruta.startsWith(env.uploadsDir + path.sep)) {
    throw ApiError.invalido('Ruta de archivo inválida');
  }
  return ruta;
}
