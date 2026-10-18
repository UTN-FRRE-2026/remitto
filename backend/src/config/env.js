import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

// Carpeta raíz del backend: las rutas relativas del .env se resuelven desde acá.
const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function requerido(nombre, valorPorDefecto) {
  const valor = process.env[nombre] ?? valorPorDefecto;
  if (valor === undefined) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

function numeroPositivo(nombre, valorPorDefecto) {
  const valor = Number(process.env[nombre] ?? valorPorDefecto);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`La variable de entorno ${nombre} debe ser un número positivo`);
  }
  return valor;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: requerido('JWT_SECRET', 'dev-secret-inseguro'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // HU8: archivos de comprobantes. No se publican como estáticos (RNF1).
  uploadsDir: path.resolve(raizBackend, process.env.UPLOADS_DIR ?? 'uploads'),
  archivoMaxMb: numeroPositivo('ARCHIVO_MAX_MB', 10),
};

export const esProduccion = env.nodeEnv === 'production';
