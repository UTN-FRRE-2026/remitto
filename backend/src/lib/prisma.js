import { PrismaClient } from '@prisma/client';
import { esProduccion } from '../config/env.js';

// Cliente Prisma único para toda la aplicación (capa de acceso a datos).
// Los servicios lo usan directamente; varios lo reciben como parámetro `db`
// para trabajar dentro de una transacción o con una base simulada en las pruebas.
export const prisma = new PrismaClient({
  log: esProduccion ? ['error'] : ['warn', 'error'],
});
