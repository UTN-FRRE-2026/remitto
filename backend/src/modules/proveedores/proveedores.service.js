import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

// HU6: el único campo único de proveedores es el CUIT.
export function traducirErrorProveedor(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return ApiError.conflicto('Ya existe un proveedor con ese CUIT.');
  }
  return err;
}

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

export async function crear(datos) {
  try {
    return await prisma.proveedor.create({ data: datos });
  } catch (err) {
    throw traducirErrorProveedor(err);
  }
}

export async function actualizar(id, datos) {
  await obtener(id);
  try {
    return await prisma.proveedor.update({ where: { id }, data: datos });
  } catch (err) {
    throw traducirErrorProveedor(err);
  }
}

// HU6: un proveedor no se elimina, se desactiva (no aparece al cargar comprobantes).
export async function desactivar(id) {
  await obtener(id);
  return prisma.proveedor.update({ where: { id }, data: { activo: false } });
}
