// HU16 (RF3.5): equivalencias por proveedor. Recuerdan cómo nombra cada
// proveedor a cada producto (tabla codigos_proveedor), para no asociarlo de
// nuevo en el próximo comprobante.
//
// - Se registran al confirmar un ingreso: por cada línea leída por la IA, la
//   descripción (y el código impreso, si hay) queda apuntando al producto que
//   confirmó la persona. Confirmar de nuevo lo mismo suma al contador; si la
//   persona eligió otro producto, la equivalencia pasa a ese y el contador
//   vuelve a 1. Así una descripción de un proveedor nunca apunta a dos
//   productos (además lo asegura el índice único de la tabla).
// - Se consultan al leer el siguiente comprobante del mismo proveedor, antes
//   de buscar productos parecidos (HU15): primero por código y después por
//   descripción. La línea queda asociada con confianza 1. Las que apuntan a un
//   producto desactivado se ignoran.

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
// proveedor { id, productoId, codigo, descripcion, vecesConfirmado }, con
// codigo y descripcion ya guardados como claves. El código manda: es lo que
// el proveedor usa para identificar el artículo.
export function buscarEquivalencia({ codigo, descripcion }, equivalencias) {
  const c = claveCodigo(codigo);
  if (c) {
    const porCodigo = equivalencias.find((e) => e.codigo === c);
    if (porCodigo) return porCodigo;
  }
  const d = claveDescripcion(descripcion);
  return (d && equivalencias.find((e) => e.descripcion === d)) || null;
}

// Qué hay que guardar al confirmar una línea (pura). existentes: las filas del
// proveedor con la misma descripción (porDescripcion) y con el mismo código
// (porCodigo), o null. Devuelve null si la línea no tiene descripción leída.
export function planEquivalencia({ codigo, descripcion, productoId }, { porDescripcion = null, porCodigo = null } = {}, ahora = new Date()) {
  const d = claveDescripcion(descripcion);
  if (!d || !productoId) return null;
  const c = claveCodigo(codigo);
  const existente = porDescripcion ?? porCodigo;
  if (!existente) {
    return { crear: { productoId, codigo: c, descripcion: d, vecesConfirmado: 1, ultimaVez: ahora } };
  }
  return {
    // El código pasa a la descripción más reciente: se quita de la otra fila.
    liberarCodigoDe: c && porCodigo && porDescripcion && porCodigo.id !== porDescripcion.id ? porCodigo.id : null,
    actualizar: {
      id: existente.id,
      data: {
        productoId,
        descripcion: d,
        codigo: c ?? existente.codigo,
        vecesConfirmado: existente.productoId === productoId ? existente.vecesConfirmado + 1 : 1,
        ultimaVez: ahora,
      },
    },
  };
}

// Equivalencias del proveedor que apuntan a productos activos.
export function equivalenciasDelProveedor(db, proveedorId) {
  return db.codigoProveedor.findMany({
    where: { proveedorId, producto: { activo: true } },
    select: { id: true, productoId: true, codigo: true, descripcion: true, vecesConfirmado: true },
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
    const [porDescripcion, porCodigo] = await Promise.all([
      tx.codigoProveedor.findUnique({ where: { proveedorId_descripcion: { proveedorId, descripcion } } }),
      codigo ? tx.codigoProveedor.findUnique({ where: { proveedorId_codigo: { proveedorId, codigo } } }) : null,
    ]);
    const plan = planEquivalencia(
      { codigo: d.codigoExtraido, descripcion: d.descripcionExtraida, productoId: d.productoId },
      { porDescripcion, porCodigo },
      ahora,
    );
    if (plan.liberarCodigoDe) {
      await tx.codigoProveedor.update({ where: { id: plan.liberarCodigoDe }, data: { codigo: null } });
    }
    if (plan.crear) await tx.codigoProveedor.create({ data: { proveedorId, ...plan.crear } });
    else await tx.codigoProveedor.update({ where: { id: plan.actualizar.id }, data: plan.actualizar.data });
  }
}

// Marca las líneas cuya propuesta sale de una equivalencia, para mostrarlo en
// la revisión (pura). Solo mientras la propuesta siga vigente: si la persona
// eligió el producto, la confianza es null y ya no se marca.
export function anotarEquivalencias(detalles, equivalencias) {
  return detalles.map((d) => {
    if (d.agregadaManualmente || d.confianza == null || !d.productoId) return { ...d, equivalencia: null };
    const e = buscarEquivalencia({ codigo: d.codigoExtraido, descripcion: d.descripcionExtraida }, equivalencias);
    return { ...d, equivalencia: e && e.productoId === d.productoId ? { vecesConfirmado: e.vecesConfirmado } : null };
  });
}
