import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

export function listar() {
  return prisma.categoria.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { productos: true } } },
  });
}

export function crear({ nombre }) {
  return prisma.categoria.create({ data: { nombre } });
}

export async function actualizar(id, { nombre }) {
  await obtener(id);
  return prisma.categoria.update({ where: { id }, data: { nombre } });
}

async function obtener(id) {
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) throw ApiError.noEncontrado('Categoría no encontrada');
  return categoria;
}

// Al eliminar una categoría, los productos quedan sin categoría (onDelete: SetNull).
export async function eliminar(id) {
  await obtener(id);
  await prisma.categoria.delete({ where: { id } });
}
