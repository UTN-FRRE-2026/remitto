import { PrismaClient } from '@prisma/client';
import { esProduccion } from '../config/env.js';

// Cliente Prisma único para toda la aplicación (capa de acceso a datos).
// Los servicios de dominio lo usan a través de los repositorios de cada módulo.
export const prisma = new PrismaClient({
  log: esProduccion ? ['error'] : ['warn', 'error'],
});
