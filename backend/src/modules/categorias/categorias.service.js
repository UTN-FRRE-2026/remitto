import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

const DUPLICADA = 'Ya existe una categoría con ese nombre.';

// HU5: el índice único de la base distingue mayúsculas; esto lo traduce.
export function traducirErrorCategoria(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return ApiError.conflicto(DUPLICADA);
  }
  return err;
}

// HU5: «Bebidas» y «bebidas» son la misma categoría.
async function verificarNombreLibre(nombre, idActual) {
  const existente = await prisma.categoria.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' }, ...(idActual ? { id: { not: idActual } } : {}) },
  });
  if (existente) throw ApiError.conflicto(DUPLICADA);
}

export function listar() {
  return prisma.categoria.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { productos: true } } },
  });
}

export async function crear({ nombre }) {
  await verificarNombreLibre(nombre);
  try {
    return await prisma.categoria.create({ data: { nombre } });
  } catch (err) {
    throw traducirErrorCategoria(err);
  }
}

export async function actualizar(id, { nombre }) {
  await obtener(id);
  await verificarNombreLibre(nombre, id);
  try {
    return await prisma.categoria.update({ where: { id }, data: { nombre } });
  } catch (err) {
    throw traducirErrorCategoria(err);
  }
}

async function obtener(id) {
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) throw ApiError.noEncontrado('Categoría no encontrada');
  return categoria;
}

// Al eliminar una categoría, sus productos quedan sin categoría
// (onDelete: SetNull): un producto puede no tener categoría (HU5).
export async function eliminar(id) {
  await obtener(id);
  await prisma.categoria.delete({ where: { id } });
}
