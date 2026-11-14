// HU19 (RF3.8): precisión de la lectura con IA. Compara lo que leyó la IA
// (columnas *Extraido, que no se modifican) con lo que la persona confirmó.
// Solo cuentan los comprobantes confirmados que tuvieron lectura de IA.
//
// Cada línea del comprobante real cae en uno de estos casos:
// - CORRECTA: la IA la leyó y se confirmó con la misma cantidad y el mismo
//   precio unitario (si la IA no leyó precio, la persona tampoco lo cargó).
// - CORREGIDA: la IA la leyó y la persona cambió la cantidad o el precio.
// - DESCARTADA: la IA leyó una línea que la persona descartó (por ejemplo,
//   un subtotal o un renglón ilegible).
// - OMITIDA: la persona la agregó a mano porque la IA no la leyó.
// Las líneas agregadas a mano y después descartadas no cuentan.
//
// Precisión = líneas correctas / líneas contadas. La asociación con el
// catálogo (HU15) no entra: es local, no de la IA.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// Meta del plan: 85 % de líneas correctas sobre veinte comprobantes.
export const META = { porcentaje: 85, comprobantes: 20 };

const PREFIJO_SIMULADO = 'simulado:';
export const esSimulada = (modeloIa) => Boolean(modeloIa?.startsWith(PREFIJO_SIMULADO));

const iguales = (a, b) => (a == null || b == null ? a == null && b == null : new Prisma.Decimal(a).eq(b));

// Clasifica una línea (pura). Devuelve null si no cuenta.
export function clasificarLinea(d) {
  if (d.agregadaManualmente) return d.estado === 'DESCARTADO' ? null : { caso: 'OMITIDA' };
  if (d.estado === 'DESCARTADO') return { caso: 'DESCARTADA' };
  const cantidad = iguales(d.cantidadExtraida, d.cantidad);
  const precio = iguales(d.precioUnitarioExtraido, d.precioUnitario);
  return cantidad && precio ? { caso: 'CORRECTA' } : { caso: 'CORREGIDA', cantidad, precio };
}

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

// Indicador de un conjunto de líneas (pura).
export function medir(detalles) {
  const r = { lineas: 0, correctas: 0, corregidas: 0, descartadas: 0, omitidas: 0, erroresCantidad: 0, erroresPrecio: 0 };
  for (const d of detalles) {
    const c = clasificarLinea(d);
    if (!c) continue;
    r.lineas += 1;
    if (c.caso === 'CORRECTA') r.correctas += 1;
    else if (c.caso === 'DESCARTADA') r.descartadas += 1;
    else if (c.caso === 'OMITIDA') r.omitidas += 1;
    else {
      r.corregidas += 1;
      if (!c.cantidad) r.erroresCantidad += 1;
      if (!c.precio) r.erroresPrecio += 1;
    }
  }
  return { ...r, porcentaje: porcentaje(r.correctas, r.lineas) };
}

// Suma de varios indicadores ya medidos (pura).
export function sumar(indicadores) {
  const total = { lineas: 0, correctas: 0, corregidas: 0, descartadas: 0, omitidas: 0, erroresCantidad: 0, erroresPrecio: 0 };
  for (const i of indicadores) for (const k of Object.keys(total)) total[k] += i[k];
  return { ...total, porcentaje: porcentaje(total.correctas, total.lineas) };
}

// Indicador de un comprobante: solo si está confirmado y lo leyó la IA.
export function precisionDeComprobante(c) {
  if (c.estado !== 'CONFIRMADO' || !c.modeloIa) return null;
  return { ...medir(c.detalles), simulada: esSimulada(c.modeloIa) };
}

// General y por comprobante. Las lecturas simuladas (pruebas sin IA real) se
// listan, pero no entran en el indicador general ni en la meta.
export async function precision(db = prisma) {
  const comprobantes = await db.comprobante.findMany({
    where: { estado: 'CONFIRMADO', modeloIa: { not: null } },
    select: {
      id: true,
      tipo: true,
      numero: true,
      modeloIa: true,
      confirmadoEn: true,
      proveedor: { select: { id: true, razonSocial: true } },
      detalles: {
        select: {
          agregadaManualmente: true,
          estado: true,
          cantidadExtraida: true,
          cantidad: true,
          precioUnitarioExtraido: true,
          precioUnitario: true,
        },
      },
    },
    orderBy: [{ confirmadoEn: 'desc' }, { id: 'desc' }],
  });

  const lista = comprobantes.map(({ detalles, ...c }) => ({ ...c, simulada: esSimulada(c.modeloIa), ...medir(detalles) }));
  const reales = lista.filter((c) => !c.simulada);
  const general = sumar(reales);
  return {
    general: { ...general, comprobantes: reales.length },
    simuladas: lista.length - reales.length,
    meta: {
      ...META,
      // null mientras no haya veinte comprobantes reales: la muestra no alcanza.
      cumple: reales.length >= META.comprobantes ? general.porcentaje >= META.porcentaje : null,
    },
    comprobantes: lista,
  };
}
