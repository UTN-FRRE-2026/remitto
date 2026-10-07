import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

export function listar({ q, activo } = {}) {
  const where = {};
  if (activo !== undefined) where.activo = activo;
  if (q) {
    where.OR = [
      { razonSocial: { contains: q, mode: 'insensitive' } },
      { cuit: { contains: q } },
      { contacto: { contains: q, mode: 'insensitive' } },
    ];
  }
  return prisma.proveedor.findMany({ where, orderBy: { razonSocial: 'asc' } });
}

export async function obtener(id) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) throw ApiError.noEncontrado('Proveedor no encontrado');
  return proveedor;
}

export function crear(datos) {
  return prisma.proveedor.create({ data: datos });
}

export async function actualizar(id, datos) {
  await obtener(id);
  return prisma.proveedor.update({ where: { id }, data: datos });
}

// HU6: un proveedor no se elimina, se desactiva (no aparece al cargar comprobantes).
export async function desactivar(id) {
  await obtener(id);
  return prisma.proveedor.update({ where: { id }, data: { activo: false } });
}
