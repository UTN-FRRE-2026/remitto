import { UMBRAL_CONFIANZA } from './comprobantes.asociacion.js';

// HU16 (RF3.5): equivalencias por proveedor. Recuerdan cómo nombra cada
// proveedor a cada producto (tabla codigos_proveedor), para no asociarlo de
// nuevo en el próximo comprobante.
//
// Hay dos tipos de fila, cada una con su propio contador de confirmaciones:
// - Por código (codigo no nulo): código impreso → producto. Guarda también la
//   última descripción con la que se vio ese código.
// - Por descripción (codigo nulo): descripción normalizada → producto.
//
// - Se registran al confirmar un ingreso: cada línea leída por la IA actualiza
//   la fila de su código (si tiene) y la de su descripción, apuntando al
//   producto que confirmó la persona. Confirmar de nuevo lo mismo suma al
//   contador; si la persona eligió otro producto, la fila pasa a ese y el
//   contador vuelve a 1. Un código o una descripción nunca tienen dos filas
//   (índices únicos de la tabla), así que no apuntan a dos productos.
// - Se consultan al leer el siguiente comprobante del mismo proveedor, antes
//   de buscar productos parecidos (HU15):
//   1. Si el código impreso ya se confirmó, manda el código: confianza 1.
//   2. Si no, se mira la descripción. Si todo lo confirmado con esa
//      descripción apunta al mismo producto, confianza 1. Si apunta a más de
//      un producto (por ejemplo, LE01 y LE02 se imprimen igual), es ambigua: se
//      propone el último producto confirmado, pero por debajo del umbral, para
//      revisarlo. También si la línea trae un código nuevo con una descripción
//      ya vista: puede ser otro artículo.
//   Las filas que apuntan a un producto desactivado se ignoran.

// Confianza de una equivalencia que no alcanza para confiar: se destaca.
export const CONFIANZA_DUDOSA = Math.round((UMBRAL_CONFIANZA - 0.01) * 1000) / 1000;

// Descripción comparable: sin mayúsculas, acentos ni puntuación, y con el
// número pegado a su unidad. "GAS, COLA 500 ML" → "gas cola 500ml".
export function claveDescripcion(texto) {
  const t = String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1.$2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(\d)\s+(?=[a-z])/g, '$1')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t || null;
}

// Código impreso comparable: sin espacios y en mayúsculas. "  ab 12 " → "AB12".
export function claveCodigo(codigo) {
  const c = String(codigo ?? '').replace(/\s+/g, '').toUpperCase();
  return c || null;
}

// Busca la equivalencia de una línea leída (pura). equivalencias: filas del
// proveedor { productoId, codigo, descripcion, vecesConfirmado, ultimaVez },
// con codigo y descripcion ya guardados como claves. Devuelve null o
// { productoId, confianza, vecesConfirmado, motivo }, con motivo 'codigo',
// 'descripcion', 'ambigua' o 'codigo-nuevo' (estos dos, con confianza dudosa).
export function buscarEquivalencia({ codigo, descripcion }, equivalencias) {
  const c = claveCodigo(codigo);
  if (c) {
    const porCodigo = equivalencias.find((e) => e.codigo === c);
    if (porCodigo) return { productoId: porCodigo.productoId, confianza: 1, vecesConfirmado: porCodigo.vecesConfirmado, motivo: 'codigo' };
  }
  const d = claveDescripcion(descripcion);
  if (!d) return null;
  const conDescripcion = equivalencias.filter((e) => e.descripcion === d);
  if (conDescripcion.length === 0) return null;
  // La fila por descripción tiene la última confirmación de esa descripción;
  // si no está (su producto se desactivó), la fila por código más reciente.
  const fila =
    conDescripcion.find((e) => e.codigo == null) ??
    [...conDescripcion].sort((a, b) => new Date(b.ultimaVez) - new Date(a.ultimaVez))[0];
  const resultado = { productoId: fila.productoId, vecesConfirmado: fila.vecesConfirmado };
  if (new Set(conDescripcion.map((e) => e.productoId)).size > 1) {
    return { ...resultado, confianza: CONFIANZA_DUDOSA, motivo: 'ambigua' };
  }
  if (c) return { ...resultado, confianza: CONFIANZA_DUDOSA, motivo: 'codigo-nuevo' };
  return { ...resultado, confianza: 1, motivo: 'descripcion' };
}

function planFila(existente, productoId, claves, ahora) {
  if (!existente) return { crear: { productoId, ...claves, vecesConfirmado: 1, ultimaVez: ahora } };
  return {
    actualizar: {
      id: existente.id,
      data: {
        productoId,
        ...claves,
        vecesConfirmado: existente.productoId === productoId ? existente.vecesConfirmado + 1 : 1,
        ultimaVez: ahora,
      },
    },
  };
}

// Qué hay que guardar al confirmar una línea (pura). existentes: la fila del
// código (porCodigo) y la de la descripción (porDescripcion) del proveedor, o
// null. Devuelve null si la línea no tiene descripción leída o producto.
export function planEquivalencia({ codigo, descripcion, productoId }, { porCodigo = null, porDescripcion = null } = {}, ahora = new Date()) {
  const d = claveDescripcion(descripcion);
  if (!d || !productoId) return null;
  const c = claveCodigo(codigo);
  return {
    porCodigo: c ? planFila(porCodigo, productoId, { codigo: c, descripcion: d }, ahora) : null,
    porDescripcion: planFila(porDescripcion, productoId, { codigo: null, descripcion: d }, ahora),
  };
}

// Equivalencias del proveedor que apuntan a productos activos.
export function equivalenciasDelProveedor(db, proveedorId) {
  return db.codigoProveedor.findMany({
    where: { proveedorId, producto: { activo: true } },
    select: { id: true, productoId: true, codigo: true, descripcion: true, vecesConfirmado: true, ultimaVez: true },
  });
}

// Registra las equivalencias de las líneas confirmadas. Se llama dentro de la
// transacción de la confirmación, con el proveedor bloqueado (FOR UPDATE):
// dos confirmaciones del mismo proveedor no se pisan.
export async function registrarEquivalencias(tx, proveedorId, detalles) {
  const ahora = new Date();
  const ordenadas = [...detalles].sort((a, b) => a.nroLinea - b.nroLinea);
  for (const d of ordenadas) {
    if (d.agregadaManualmente || d.estado === 'DESCARTADO') continue;
    const descripcion = claveDescripcion(d.descripcionExtraida);
    if (!descripcion || !d.productoId) continue;
    const codigo = claveCodigo(d.codigoExtraido);
    const porCodigo = codigo ? await tx.codigoProveedor.findUnique({ where: { proveedorId_codigo: { proveedorId, codigo } } }) : null;
    const porDescripcion = await tx.codigoProveedor.findFirst({ where: { proveedorId, codigo: null, descripcion } });
    const plan = planEquivalencia(
      { codigo: d.codigoExtraido, descripcion: d.descripcionExtraida, productoId: d.productoId },
      { porCodigo, porDescripcion },
      ahora,
    );
    for (const op of [plan.porCodigo, plan.porDescripcion]) {
      if (!op) continue;
      if (op.crear) await tx.codigoProveedor.create({ data: { proveedorId, ...op.crear } });
      else await tx.codigoProveedor.update({ where: { id: op.actualizar.id }, data: op.actualizar.data });
    }
  }
}

// Marca las líneas cuya propuesta sale de una equivalencia confiable
// ("Recordado"), para mostrarlo en la revisión (pura). Solo mientras la
// propuesta siga vigente: si la persona eligió el producto, la confianza es
// null y ya no se marca. Una equivalencia ambigua no se marca: la línea se
// destaca como cualquier propuesta dudosa.
export function anotarEquivalencias(detalles, equivalencias) {
  return detalles.map((d) => {
    if (d.agregadaManualmente || d.confianza == null || !d.productoId) return { ...d, equivalencia: null };
    const e = buscarEquivalencia({ codigo: d.codigoExtraido, descripcion: d.descripcionExtraida }, equivalencias);
    const recordada = e && e.confianza === 1 && e.productoId === d.productoId;
    return { ...d, equivalencia: recordada ? { vecesConfirmado: e.vecesConfirmado } : null };
  });
}
