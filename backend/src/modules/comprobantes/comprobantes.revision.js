import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { normalizarNumero } from '../../ia/normalizar.js';
import { registrarMovimiento } from '../stock/stock.service.js';
import { esDudosa } from './comprobantes.asociacion.js';
import { registrarEquivalencias } from './comprobantes.equivalencias.js';

// HU10: revisión del comprobante leído por la IA (estado EN_REVISION).
// - Las correcciones se guardan como borrador en las columnas confirmables
//   (productoId, cantidad, precioUnitario, estado de la línea) y en la
//   cabecera. Las columnas *Extraido (lo que leyó la IA) nunca se modifican.
// - "Validar datos" solo evalúa: no cambia el estado del comprobante ni el
//   stock.
// HU11: "Confirmar ingreso" pasa el comprobante a CONFIRMADO y genera los
// movimientos de stock y precios de compra en una sola transacción.

const mensajeNoEditable = 'Solo se puede revisar un comprobante leído que todavía no fue confirmado.';
const mensajeYaConfirmado = 'Este ingreso ya fue confirmado. No se volvió a sumar al stock.';

// Bloquea el comprobante (FOR UPDATE) hasta el fin de la transacción: una
// edición que llega mientras se confirma espera y después recibe 409.
async function enRevision(tx, id) {
  const [c] = await tx.$queryRaw`SELECT id, estado::text AS estado FROM comprobantes WHERE id = ${id} FOR UPDATE`;
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

// HU17: el comprobante exige revisar cada línea si la IA indicó que está
// escrito a mano, que la imagen es de baja calidad o que no se lee bien.
// Se deriva de la lectura guardada (respuesta_ia), sin otra columna.
export function exigeRevisionCompleta(c) {
  const d = c?.respuestaIa?.lectura?.documento;
  return Boolean(d && (d.manuscrito === true || d.bajaCalidad === true || d.legible === false));
}

// Columnas que cambia una edición de la línea (pura). Si la persona elige o
// quita el producto, la confianza pasa a null: la asociación es suya y ya no
// se marca como propuesta (HU15). Nada vuelve a proponer sobre esa línea.
export function cambiosDeDetalle(datos) {
  const data = {};
  for (const campo of ['productoId', 'cantidad', 'precioUnitario']) {
    if (campo in datos) data[campo] = datos[campo];
  }
  if ('productoId' in datos) data.confianza = null;
  if ('descartada' in datos) data.estado = datos.descartada ? 'DESCARTADO' : 'PROPUESTO';
  if ('revisada' in datos) data.revisada = datos.revisada;
  return data;
}

export async function actualizarDetalle(id, detalleId, datos) {
  return prisma.$transaction(async (tx) => {
    await enRevision(tx, id);
    const detalle = await tx.detalleComprobante.findFirst({ where: { id: detalleId, comprobanteId: id } });
    if (!detalle) throw ApiError.noEncontrado('Línea no encontrada en este comprobante');
    if ('productoId' in datos) await productoActivo(tx, datos.productoId);
    return tx.detalleComprobante.update({ where: { id: detalleId }, data: cambiosDeDetalle(datos), include: incluirDetalle });
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
          // La cargó una persona: ya está revisada (HU17).
          revisada: true,
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

  // HU17: comprobante dudoso → cada línea a ingresar tiene que estar revisada.
  const revisionCompleta = exigeRevisionCompleta(c);
  const sinRevisar = revisionCompleta ? activas.filter((d) => !d.revisada) : [];
  for (const d of sinRevisar) {
    problemas.push({
      nroLinea: d.nroLinea,
      campo: 'revisada',
      mensaje: `Línea ${d.nroLinea}: marcala como revisada (el comprobante es manuscrito o de baja calidad).`,
    });
  }

  let unidades = 0;
  let importe = 0;
  let lineasSinPrecio = 0;
  for (const d of activas) {
    const linea = d.nroLinea;
    const cantidad = num(d.cantidad);
    const precio = num(d.precioUnitario);
    if (!d.productoId) {
      problemas.push({
        nroLinea: linea,
        campo: 'productoId',
        mensaje:
          d.confianza != null
            ? `Línea ${linea}: no hay un producto parecido en el catálogo; asociá uno o dalo de alta.`
            : `Línea ${linea}: falta asociar un producto.`,
      });
    } else if (d.producto && !d.producto.activo) {
      problemas.push({ nroLinea: linea, campo: 'productoId', mensaje: `Línea ${linea}: el producto está desactivado.` });
    } else if (esDudosa(d)) {
      // HU15: no impide confirmar, pero pide mirar la propuesta.
      avisos.push({
        nroLinea: linea,
        campo: 'productoId',
        mensaje: `Línea ${linea}: revisá el producto propuesto (confianza ${Math.round(num(d.confianza) * 100)} %).`,
      });
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
      // HU17
      revisionCompleta,
      sinRevisar: sinRevisar.length,
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

// Fecha del precio de compra: la de emisión del comprobante o, si no se
// cargó, el día de hoy en Argentina (columna DATE, sin hora).
export function fechaVigencia(fechaEmision, ahora = new Date()) {
  if (fechaEmision) return fechaEmision;
  const dia = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  return new Date(`${dia}T00:00:00Z`);
}

// Líneas que generan movimiento, ordenadas por producto: las transacciones
// bloquean los productos siempre en el mismo orden y no se traban entre sí.
export function lineasAIngresar(detalles) {
  return detalles
    .filter((d) => d.estado !== 'DESCARTADO')
    .sort((a, b) => a.productoId - b.productoId || a.nroLinea - b.nroLinea);
}

// HU11: el mismo remito no se ingresa dos veces. Compara el número
// normalizado con los comprobantes ya confirmados del proveedor.
async function numeroYaIngresado(tx, c) {
  const numero = normalizarNumero(c.numero);
  const confirmados = await tx.comprobante.findMany({
    where: { proveedorId: c.proveedorId, tipo: c.tipo, estado: 'CONFIRMADO', id: { not: c.id }, numero: { not: null } },
    select: { id: true, numero: true },
  });
  return confirmados.find((otro) => normalizarNumero(otro.numero) === numero) ?? null;
}

export async function confirmar(id, usuarioId) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Pasar a CONFIRMADO primero toma el bloqueo de la fila: un segundo
        // pedido (doble clic, otra pestaña) espera y encuentra 0 filas.
        const confirmadoEn = new Date();
        const r = await tx.comprobante.updateMany({
          where: { id, estado: 'EN_REVISION' },
          data: { estado: 'CONFIRMADO', confirmadoPorId: usuarioId, confirmadoEn },
        });
        if (r.count === 0) {
          const actual = await tx.comprobante.findUnique({ where: { id }, select: { estado: true } });
          if (!actual) throw ApiError.noEncontrado('Comprobante no encontrado');
          throw ApiError.conflicto(actual.estado === 'CONFIRMADO' ? mensajeYaConfirmado : mensajeNoEditable);
        }

        const c = await tx.comprobante.findUnique({
          where: { id },
          include: { detalles: { include: incluirDetalle, orderBy: { nroLinea: 'asc' } } },
        });
        // Se vuelve a validar con lo guardado: el frontend puede estar desactualizado.
        const evaluacion = evaluarRevision({ ...c, estado: 'EN_REVISION' });
        if (!evaluacion.completo) throw ApiError.invalido('Faltan datos para confirmar el ingreso.', evaluacion.problemas);

        // Serializa las confirmaciones del mismo proveedor para que dos copias
        // del mismo remito no se confirmen a la vez.
        await tx.$queryRaw`SELECT id FROM proveedores WHERE id = ${c.proveedorId} FOR UPDATE`;
        const repetido = await numeroYaIngresado(tx, c);
        if (repetido) {
          throw ApiError.conflicto(
            `Este remito ya se ingresó: el comprobante #${repetido.id} de este proveedor tiene el número ${repetido.numero}.`,
          );
        }

        const vigencia = fechaVigencia(c.fechaEmision);
        const lineas = [];
        for (const d of lineasAIngresar(c.detalles)) {
          await tx.detalleComprobante.update({ where: { id: d.id }, data: { estado: 'CONFIRMADO' } });
          const { stockAnterior, stockNuevo } = await registrarMovimiento(tx, {
            productoId: d.productoId,
            tipo: 'ENTRADA',
            motivo: 'COMPRA',
            cantidad: d.cantidad,
            usuarioId,
            detalleComprobanteId: d.id,
            observacion: `Comprobante #${id}`,
          });
          if (d.precioUnitario != null) {
            await tx.precioCompra.create({
              data: {
                productoId: d.productoId,
                proveedorId: c.proveedorId,
                precioUnitario: d.precioUnitario,
                fechaVigencia: vigencia,
                detalleComprobanteId: d.id,
              },
            });
          }
          lineas.push({
            nroLinea: d.nroLinea,
            producto: { id: d.productoId, nombre: d.producto.nombre },
            cantidad: d.cantidad,
            stockAnterior,
            stockNuevo,
          });
        }
        // HU16: el proveedor queda recordado para el próximo comprobante.
        await registrarEquivalencias(tx, c.proveedorId, lineasAIngresar(c.detalles));
        lineas.sort((a, b) => a.nroLinea - b.nroLinea);
        return { id, estado: 'CONFIRMADO', confirmadoEn, lineas, resumen: evaluacion.resumen, avisos: evaluacion.avisos };
      },
      { timeout: 20_000 },
    );
  } catch (err) {
    // Segunda barrera de la base: número repetido o línea ya ingresada.
    if (esUnico(err)) throw ApiError.conflicto('El comprobante o alguna de sus líneas ya fue ingresado.');
    throw err;
  }
}
