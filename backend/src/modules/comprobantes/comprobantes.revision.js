import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

// HU10: revisión del comprobante leído por la IA (estado EN_REVISION).
// - Las correcciones se guardan como borrador en las columnas confirmables
//   (productoId, cantidad, precioUnitario, estado de la línea) y en la
//   cabecera. Las columnas *Extraido (lo que leyó la IA) nunca se modifican.
// - "Validar datos" solo evalúa: no cambia el estado del comprobante ni el
//   stock. La confirmación del ingreso (CONFIRMADO + movimientos) es HU11.

const mensajeNoEditable = 'Solo se puede revisar un comprobante leído que todavía no fue confirmado.';

async function enRevision(tx, id) {
  const c = await tx.comprobante.findUnique({ where: { id }, select: { id: true, estado: true } });
  if (!c) throw ApiError.noEncontrado('Comprobante no encontrado');
  if (c.estado !== 'EN_REVISION') throw ApiError.conflicto(mensajeNoEditable);
  return c;
}

async function productoActivo(tx, productoId) {
  if (productoId == null) return;
  const p = await tx.producto.findUnique({ where: { id: productoId }, select: { activo: true } });
  if (!p || !p.activo) {
    throw ApiError.invalido('El producto no existe o está desactivado.', [
      { campo: 'productoId', mensaje: 'Producto inexistente o inactivo' },
    ]);
  }
}

const esUnico = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export const incluirDetalle = {
  producto: { select: { id: true, nombre: true, unidadMedida: true, activo: true } },
};

export async function actualizarCabecera(id, datos) {
  const data = { ...datos };
  if ('fechaEmision' in data) data.fechaEmision = data.fechaEmision ? new Date(`${data.fechaEmision}T00:00:00Z`) : null;
  try {
    const r = await prisma.comprobante.updateMany({ where: { id, estado: 'EN_REVISION' }, data });
    if (r.count === 0) await enRevision(prisma, id); // lanza 404 o 409 según corresponda
  } catch (err) {
    // @@unique([proveedorId, tipo, numero]): el número definitivo no se repite.
    if (esUnico(err)) {
      throw ApiError.conflicto('Ya existe otro comprobante de este proveedor con ese tipo y número.');
    }
    throw err;
  }
  return prisma.comprobante.findUnique({
    where: { id },
    select: { id: true, numero: true, tipo: true, fechaEmision: true, totalDeclarado: true },
  });
}

export async function actualizarDetalle(id, detalleId, datos) {
  return prisma.$transaction(async (tx) => {
    await enRevision(tx, id);
    const detalle = await tx.detalleComprobante.findFirst({ where: { id: detalleId, comprobanteId: id } });
    if (!detalle) throw ApiError.noEncontrado('Línea no encontrada en este comprobante');
    if ('productoId' in datos) await productoActivo(tx, datos.productoId);

    const data = {};
    for (const campo of ['productoId', 'cantidad', 'precioUnitario']) {
      if (campo in datos) data[campo] = datos[campo];
    }
    if ('descartada' in datos) data.estado = datos.descartada ? 'DESCARTADO' : 'PROPUESTO';
    return tx.detalleComprobante.update({ where: { id: detalleId }, data, include: incluirDetalle });
  });
}

// Línea agregada a mano (por ejemplo, una fila que la IA no leyó).
export async function agregarDetalle(id, datos) {
  try {
    return await prisma.$transaction(async (tx) => {
      await enRevision(tx, id);
      if ('productoId' in datos) await productoActivo(tx, datos.productoId);
      const max = await tx.detalleComprobante.aggregate({ where: { comprobanteId: id }, _max: { nroLinea: true } });
      return tx.detalleComprobante.create({
        data: {
          comprobanteId: id,
          nroLinea: (max._max.nroLinea ?? 0) + 1,
          agregadaManualmente: true,
          productoId: datos.productoId ?? null,
          cantidad: datos.cantidad ?? null,
          precioUnitario: datos.precioUnitario ?? null,
          estado: 'PROPUESTO',
        },
        include: incluirDetalle,
      });
    });
  } catch (err) {
    if (esUnico(err)) throw ApiError.conflicto('Otra persona agregó una línea al mismo tiempo. Probá de nuevo.');
    throw err;
  }
}

const num = (v) => (v == null ? null : Number(v));

// Evalúa si el comprobante tiene los datos completos para confirmar (pura,
// sin base de datos). Problemas: impiden confirmar. Avisos: no lo impiden.
export function evaluarRevision(c, { duplicados = [] } = {}) {
  const problemas = [];
  const avisos = [];
  if (c.estado !== 'EN_REVISION') problemas.push({ campo: 'estado', mensaje: mensajeNoEditable });
  if (!c.numero?.trim()) problemas.push({ campo: 'numero', mensaje: 'Falta el número del comprobante.' });
  if (!c.fechaEmision) avisos.push({ campo: 'fechaEmision', mensaje: 'Sin fecha de emisión: se usará la fecha de confirmación.' });
  if (duplicados.length > 0) {
    avisos.push({
      campo: 'numero',
      mensaje: `El número leído coincide con el comprobante ${duplicados.map((d) => `#${d.id}`).join(', ')} de este proveedor.`,
    });
  }

  const activas = c.detalles.filter((d) => d.estado !== 'DESCARTADO');
  if (activas.length === 0) problemas.push({ campo: 'lineas', mensaje: 'No hay líneas para ingresar.' });

  let unidades = 0;
  let importe = 0;
  let lineasSinPrecio = 0;
  for (const d of activas) {
    const linea = d.nroLinea;
    const cantidad = num(d.cantidad);
    const precio = num(d.precioUnitario);
    if (!d.productoId) problemas.push({ nroLinea: linea, campo: 'productoId', mensaje: `Línea ${linea}: falta asociar un producto.` });
    else if (d.producto && !d.producto.activo) {
      problemas.push({ nroLinea: linea, campo: 'productoId', mensaje: `Línea ${linea}: el producto está desactivado.` });
    }
    if (cantidad == null || !(cantidad > 0)) {
      problemas.push({ nroLinea: linea, campo: 'cantidad', mensaje: `Línea ${linea}: falta la cantidad (debe ser mayor a 0).` });
    } else {
      unidades += cantidad;
    }
    if (precio == null) lineasSinPrecio += 1;
    else if (precio < 0) problemas.push({ nroLinea: linea, campo: 'precioUnitario', mensaje: `Línea ${linea}: el precio no puede ser negativo.` });
    else if (cantidad > 0) importe += cantidad * precio;
  }
  if (lineasSinPrecio > 0) {
    avisos.push({ campo: 'precioUnitario', mensaje: `${lineasSinPrecio} línea(s) sin precio: no se registrará su precio de compra.` });
  }

  const totalImpreso = num(c.totalDeclarado);
  const importeRedondeado = Math.round(importe * 100) / 100;
  const coincideTotal =
    totalImpreso == null || lineasSinPrecio > 0 ? null : Math.abs(importeRedondeado - totalImpreso) <= Math.max(1, totalImpreso * 0.01);
  if (coincideTotal === false) {
    avisos.push({ campo: 'totalDeclarado', mensaje: `La suma de las líneas ($${importeRedondeado}) no coincide con el total impreso ($${totalImpreso}).` });
  }

  return {
    completo: problemas.length === 0,
    problemas,
    avisos,
    resumen: {
      lineas: c.detalles.length,
      aIngresar: activas.length,
      descartadas: c.detalles.length - activas.length,
      unidades: Math.round(unidades * 1000) / 1000,
      importe: importeRedondeado,
      totalImpreso,
      coincideTotal,
    },
  };
}

export async function validar(id, buscarDuplicados) {
  const c = await prisma.comprobante.findUnique({
    where: { id },
    include: { detalles: { include: incluirDetalle, orderBy: { nroLinea: 'asc' } } },
  });
  if (!c) throw ApiError.noEncontrado('Comprobante no encontrado');
  const duplicados = await buscarDuplicados(c);
  return evaluarRevision(c, { duplicados });
}
