import fs from 'node:fs/promises';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { validarArchivo, guardarArchivo, eliminarArchivo, rutaAbsoluta } from './comprobantes.archivos.js';

const incluir = {
  proveedor: { select: { id: true, razonSocial: true } },
  cargadoPor: { select: { id: true, nombre: true } },
};

// HU8: registra el comprobante en PENDIENTE. Si falla el alta en la base,
// se borra el archivo ya guardado para no dejar huérfanos.
export async function crear({ proveedorId, tipo }, archivo, usuarioId) {
  const formato = validarArchivo(archivo);

  // HU6: un proveedor desactivado no puede recibir comprobantes nuevos.
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
    select: { activo: true },
  });
  if (!proveedor || !proveedor.activo) {
    throw ApiError.invalido('El proveedor no existe o está desactivado.', [
      { campo: 'proveedorId', mensaje: 'Proveedor inexistente o inactivo' },
    ]);
  }

  const archivoUrl = await guardarArchivo(archivo.buffer, formato);
  try {
    return await prisma.comprobante.create({
      data: {
        proveedorId,
        tipo,
        archivoUrl,
        archivoMime: formato.mime,
        origenArchivo: formato.origen,
        cargadoPorId: usuarioId,
      },
      include: incluir,
    });
  } catch (err) {
    await eliminarArchivo(archivoUrl);
    throw err;
  }
}

export async function obtener(id) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id },
    include: { ...incluir, detalles: { orderBy: { nroLinea: 'asc' } } },
  });
  if (!comprobante) throw ApiError.noEncontrado('Comprobante no encontrado');
  return comprobante;
}

// Datos para servir el archivo original por la ruta autenticada.
export async function archivo(id) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id },
    select: { id: true, archivoUrl: true, archivoMime: true },
  });
  if (!comprobante) throw ApiError.noEncontrado('Comprobante no encontrado');

  const ruta = rutaAbsoluta(comprobante.archivoUrl);
  try {
    await fs.access(ruta);
  } catch {
    throw ApiError.noEncontrado('El archivo del comprobante no está disponible');
  }
  const extension = comprobante.archivoUrl.split('.').pop();
  return { ruta, mime: comprobante.archivoMime, nombre: `comprobante-${comprobante.id}.${extension}` };
}
