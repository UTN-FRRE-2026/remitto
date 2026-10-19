// HU9: normaliza la lectura validada de la IA SIN inventar datos.
// - No elimina líneas: las vacías o dudosas se conservan y se marcan.
// - Un valor dudoso no se reemplaza: queda en la lectura original, la precarga
//   va en null y se anota el motivo de revisión.
// - Nunca se completa con 0 ni se convierten bultos a unidades.

const TIPOS = ['REMITO', 'FACTURA', 'OTRO'];
const MAX_CANTIDAD = 1e9; // Decimal(12,3)
const MAX_PRECIO = 1e10; // Decimal(12,2)
const MAX_TOTAL = 1e12; // Decimal(14,2)
const UNIDAD_AGRUPADA = /\b(caja|cja|bulto|blt|pack|paq|paquete|docena|fardo|display|bolsa|x\s*\d+)\b/i;
// Presentación de producto (500ML, 1,5L, 80G): va en la descripción, no es unidad de venta.
const PRESENTACION = /^\d+([.,]\d+)?\s*(ml|cc|l|lt|lts|g|gr|grs|kg|mg)$/i;

// Largo máximo razonable de cada campo transcripto.
const MAX_LARGO = { codigo: 40, descripcion: 200, unidad: 30, cantidadTexto: 20, precioUnitarioTexto: 30, observacion: 200 };
// Señales de texto ajeno al documento: deliberaciones del modelo o tokens internos.
const DELIBERACION =
  /\b(let'?s|wait|should|omit|maybe|i think|field|definition|instead|however|vamos a|revisemos|deber[ií]a|quiz[aá]s|creo que)\b/i;
const TOKEN_INTERNO = /[A-Z0-9]{2,}_[A-Z0-9_]{6,}/;

// Devuelve el motivo si el texto parece ajeno al documento; null si es normal.
export function textoSospechoso(campo, valor) {
  if (typeof valor !== 'string') return null;
  if (valor.length > (MAX_LARGO[campo] ?? 200)) return `El campo ${campo} es demasiado largo (${valor.length} caracteres).`;
  if (/[\r\n]/.test(valor)) return `El campo ${campo} tiene saltos de línea.`;
  if (TOKEN_INTERNO.test(valor) || DELIBERACION.test(valor)) return `El campo ${campo} contiene texto ajeno al documento.`;
  return null;
}

const compacto = (t) => (t ?? '').toUpperCase().replace(/[\s.,]/g, '');

const limpiar = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

const representable = (n, max) => (typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < max ? n : null);

// Interpreta un número escrito en formato argentino ("2.850,00", "1,5", "12").
// Devuelve null si el texto no es un número claro (no se adivina).
export function interpretarNumeroAr(texto) {
  const t = limpiar(texto)?.replace(/[$\s]/g, '');
  if (!t || !/^-?[\d.,]+$/.test(t)) return null;
  let normal;
  if (t.includes(',') && t.includes('.')) normal = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) normal = t.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '');
  else normal = t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const coincide = (a, b) => Math.abs(a - b) <= Math.max(0.001, Math.abs(b) * 1e-6);

// Cantidad a partir del texto copiado de la celda (esquema v3). Solo acepta
// números escritos en formato argentino sin ambigüedad:
//   "12", "1,5", "0,250", "1.250" (miles), "1.250,5"
// Cualquier otra forma ("1.5", "1,250.00", "12 UN", "4?") es ambigua → null.
// Nunca se deduce de importes, precios ni otras filas.
export function interpretarCantidad(texto) {
  const t = limpiar(texto);
  if (!t) return null;
  let normal = null;
  if (/^-?\d+$/.test(t)) normal = t;
  else if (/^-?\d+,\d+$/.test(t)) normal = t.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '');
  else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.');
  if (normal === null) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

// Número de comprobante comparable entre lecturas (sin "N°", espacios ni mayúsculas).
export function normalizarNumero(numero) {
  const t = limpiar(numero);
  if (!t) return null;
  return t.toUpperCase().replace(/^N\s*[°ºO.]*\s*/, '').replace(/\s+/g, '') || null;
}

function normalizarFecha(texto, hoy) {
  const t = limpiar(texto);
  if (!t) return { fecha: null, motivo: 'No se leyó la fecha de emisión.' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    return { fecha: null, motivo: `La fecha leída «${t}» no es una fecha válida.` };
  }
  const limite = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1));
  if (d > limite) return { fecha: null, motivo: `La fecha leída «${t}» es posterior a hoy.` };
  if (d.getUTCFullYear() < 2000) return { fecha: null, motivo: `La fecha leída «${t}» es demasiado antigua.` };
  return { fecha: t, motivo: null };
}

function normalizarLinea(linea, indice) {
  const motivos = [];
  const codigo = limpiar(linea.codigo);
  const descripcion = limpiar(linea.descripcion);
  const cantidadTexto = limpiar(linea.cantidadTexto);
  const precioTexto = limpiar(linea.precioUnitarioTexto);

  // Texto ajeno al documento: se conserva tal cual (lectura original y
  // columnas *Extraido) y se señala; nunca se borra en silencio.
  for (const [campo, valor] of Object.entries({ codigo, descripcion, cantidadTexto, precioUnitarioTexto: precioTexto })) {
    const sospecha = textoSospechoso(campo, valor);
    if (sospecha) motivos.push(sospecha);
  }

  // Unidad de venta: no se precarga si es sospechosa o si es la presentación
  // que ya figura en la descripción (queda en la lectura original).
  let unidad = limpiar(linea.unidad);
  const sospechaUnidad = textoSospechoso('unidad', unidad);
  if (sospechaUnidad) {
    motivos.push(`${sospechaUnidad} No se usa como unidad.`);
    unidad = null;
  } else if (unidad && PRESENTACION.test(unidad) && compacto(descripcion).includes(compacto(unidad))) {
    motivos.push(`La unidad leída «${unidad}» es la presentación del producto, no la unidad de venta.`);
    unidad = null;
  }

  // Cantidad (esquema v3): el número sale del texto copiado de la celda.
  // Lo interpretado va a *Extraido si es representable; el texto queda en
  // la lectura original y en la normalizada.
  const valorCantidad = interpretarCantidad(cantidadTexto);
  const cantidadExtraida = representable(valorCantidad, MAX_CANTIDAD);
  const precioUnitarioExtraido = representable(linea.precioUnitario, MAX_PRECIO);
  if (linea.precioUnitario !== null && precioUnitarioExtraido === null) motivos.push('El precio leído no es un número representable.');

  // Precarga para la revisión: solo valores claros.
  let cantidad = cantidadExtraida;
  if (!cantidadTexto) {
    motivos.push('La celda de cantidad está vacía o no se leyó.');
  } else if (valorCantidad === null) {
    motivos.push(`La cantidad impresa «${cantidadTexto}» no es un número claro.`);
  } else if (cantidadExtraida === null) {
    motivos.push(`La cantidad impresa «${cantidadTexto}» no es un número representable.`);
  } else if (cantidad <= 0) {
    motivos.push(`La cantidad leída (${cantidad}) no es válida: debe ser mayor a 0.`);
    cantidad = null;
  }

  let precioUnitario = precioUnitarioExtraido;
  if (precioUnitario === null) {
    if (precioTexto) motivos.push(`No se pudo interpretar el precio impreso «${precioTexto}».`);
  } else if (precioUnitario < 0) {
    motivos.push(`El precio leído (${precioUnitario}) es negativo.`);
    precioUnitario = null;
  } else if (precioUnitario === 0 && interpretarNumeroAr(precioTexto) !== 0) {
    motivos.push('El precio leído es 0 pero no figura un cero impreso.');
    precioUnitario = null;
  } else if (precioTexto) {
    const delTexto = interpretarNumeroAr(precioTexto);
    if (delTexto !== null && !coincide(precioUnitario, delTexto)) {
      motivos.push(`El precio interpretado (${precioUnitario}) no coincide con el impreso «${precioTexto}».`);
      precioUnitario = null;
    }
  }

  if (!codigo && !descripcion && cantidadExtraida === null) motivos.push('Línea sin datos legibles.');
  if (unidad && UNIDAD_AGRUPADA.test(unidad)) {
    motivos.push(`La cantidad está expresada en «${unidad}»: confirmar si corresponde convertirla a unidades.`);
  }
  if (linea.ilegible) motivos.push('La IA marcó la línea como dudosa.');
  const observacion = limpiar(linea.observacion);
  const sospechaObs = textoSospechoso('observacion', observacion);
  if (sospechaObs) motivos.push(sospechaObs);
  else if (observacion) motivos.push(`Observación de la IA: ${observacion}`);

  return {
    nroLinea: indice + 1,
    codigo,
    descripcion,
    unidad,
    cantidadTexto: typeof linea.cantidadTexto === 'string' ? linea.cantidadTexto : null,
    cantidadExtraida,
    precioUnitarioExtraido,
    cantidad,
    precioUnitario,
    motivosRevision: motivos,
  };
}

// Recibe la lectura ya validada por lecturaSchema.
export function normalizarLectura(lectura, { hoy = new Date() } = {}) {
  const motivos = [];
  const { documento, cabecera } = lectura;

  const ilegible = documento.legible === false && lectura.lineas.length === 0;
  if (documento.legible === false && lectura.lineas.length > 0) {
    motivos.push('La IA indicó que el documento no se lee bien.');
  }
  if (documento.manuscrito) motivos.push('El comprobante está escrito a mano: revisar todas las líneas.');
  if (documento.bajaCalidad) motivos.push('La imagen es de baja calidad: revisar todas las líneas.');

  const tipoLeido = limpiar(cabecera.tipo)?.toUpperCase() ?? null;
  const tipo = TIPOS.includes(tipoLeido) ? tipoLeido : null;
  if (tipoLeido && !tipo) motivos.push(`Tipo de comprobante leído no reconocido: «${cabecera.tipo}».`);

  const numero = limpiar(cabecera.numero);
  if (!numero) motivos.push('No se leyó el número del comprobante.');

  const { fecha, motivo: motivoFecha } = normalizarFecha(cabecera.fechaEmision, hoy);
  if (motivoFecha) motivos.push(motivoFecha);

  let totalDeclarado = representable(cabecera.totalDeclarado, MAX_TOTAL);
  if (cabecera.totalDeclarado !== null && (totalDeclarado === null || totalDeclarado < 0)) {
    motivos.push(`El total leído (${cabecera.totalDeclarado}) no es válido.`);
    totalDeclarado = null;
  }

  const lineas = lectura.lineas.map(normalizarLinea);
  if (!ilegible && lineas.length === 0) motivos.push('No se detectaron líneas de artículos.');

  // Control cruzado: total impreso vs. suma de las líneas con cantidad y precio.
  if (totalDeclarado !== null && lineas.length > 0) {
    const completas = lineas.filter((l) => l.cantidad !== null && l.precioUnitario !== null);
    const suma = Math.round(completas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0) * 100) / 100;
    const tolerancia = Math.max(1, totalDeclarado * 0.01);
    const incompletas = lineas.length - completas.length;
    if (incompletas > 0) {
      motivos.push(`No se pudo verificar el total impreso (${totalDeclarado}): ${incompletas} línea(s) sin cantidad o precio.`);
    }
    if (suma < totalDeclarado - tolerancia) {
      motivos.push(`El total impreso (${totalDeclarado}) supera la suma de las líneas leídas (${suma}): puede haber filas sin leer.`);
    } else if (incompletas === 0 && Math.abs(suma - totalDeclarado) > tolerancia) {
      motivos.push(`El total impreso (${totalDeclarado}) no coincide con la suma de las líneas (${suma}).`);
    }
  }

  return {
    ilegible,
    motivoIlegible: limpiar(documento.motivoIlegible),
    cabecera: {
      tipo,
      numero,
      numeroNormalizado: normalizarNumero(numero),
      fechaEmision: fecha,
      totalDeclarado,
      proveedorNombre: limpiar(cabecera.proveedorNombre),
      proveedorCuit: limpiar(cabecera.proveedorCuit),
    },
    lineas,
    motivosRevision: motivos,
    requiereRevision: motivos.length > 0 || lineas.some((l) => l.motivosRevision.length > 0),
  };
}
