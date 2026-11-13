import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { registrarMovimiento } from '../stock/stock.service.js';

// HU14: ajuste de stock por recuento físico. Se cargan las cantidades
// contadas; por cada producto con diferencia se registra un movimiento
// AJUSTE/RECUENTO por (contado - registrado). Sin diferencia, no hay
// movimiento. El movimiento guarda stockAnterior, así lo contado se
// reconstruye como stockAnterior + cantidad.

// Unidades que no se fraccionan (mismo criterio que el carrito, HU13).
const UNIDADES_ENTERAS = new Set(['UNIDAD', 'PAQUETE']);

const numero = (d) => new Prisma.Decimal(d).toNumber().toLocaleString('es-AR', { maximumFractionDigits: 3 });

// Revisa el recuento contra los productos bloqueados (pura, sin base de datos).
// productos: Map id → { id, nombre, activo, unidadMedida, stockActual, ultimoMovimientoId }.
// - problemas: datos que no se pueden registrar (400).
// - cambios: productos que tuvieron movimientos desde que se leyeron (409).
//   Se compara la versión (último movimiento) además del stock: si el stock
//   cambió y volvió al mismo valor, o si se reenvía un recuento ya aplicado,
//   la versión es otra y no se ajusta.
// - lineas: diferencia calculada por producto, en el orden recibido.
export function analizarRecuento(lineas, productos) {
  const problemas = [];
  const cambios = [];
  const resultado = [];
  lineas.forEach((l, i) => {
    const p = productos.get(l.productoId);
    const campo = `lineas.${i}`;
    if (!p) return problemas.push({ campo: `${campo}.productoId`, productoId: l.productoId, mensaje: `El producto #${l.productoId} no existe.` });
    if (!p.activo) return problemas.push({ campo: `${campo}.productoId`, productoId: p.id, mensaje: `${p.nombre} está desactivado.` });
    const contado = new Prisma.Decimal(l.contado);
    if (UNIDADES_ENTERAS.has(p.unidadMedida) && !contado.isInteger()) {
      return problemas.push({ campo: `${campo}.contado`, productoId: p.id, mensaje: `${p.nombre} se cuenta en unidades enteras.` });
    }
    const actual = new Prisma.Decimal(p.stockActual);
    const version = p.ultimoMovimientoId ?? null;
    const mismoStock = actual.equals(l.stockRegistrado);
    if (!mismoStock || version !== (l.ultimoMovimientoId ?? null)) {
      cambios.push({
        campo: `${campo}.ultimoMovimientoId`,
        productoId: p.id,
        stockActual: actual.toNumber(),
        ultimoMovimientoId: version,
        mensaje: mismoStock
          ? `${p.nombre} tuvo movimientos mientras contabas (el stock volvió a ${numero(actual)}). Revisá el conteo.`
          : `El stock de ${p.nombre} cambió mientras contabas: era ${numero(l.stockRegistrado)} y ahora es ${numero(actual)}. Revisá el conteo.`,
      });
    }
    resultado.push({ productoId: p.id, stockRegistrado: actual, contado, diferencia: contado.minus(actual) });
    return undefined;
  });
  return { problemas, cambios, lineas: resultado };
}

// Totales para el resumen de diferencias.
export function resumir(lineas) {
  const r = { productos: lineas.length, conDiferencia: 0, sinDiferencia: 0, faltantes: 0, sobrantes: 0 };
  for (const l of lineas) {
    const d = new Prisma.Decimal(l.diferencia);
    if (d.isZero()) r.sinDiferencia += 1;
    else {
      r.conDiferencia += 1;
      if (d.isNegative()) r.faltantes += 1;
      else r.sobrantes += 1;
    }
  }
  return r;
}

// Último movimiento de cada producto (su versión). Dentro de la transacción se
// consulta después de bloquear los productos: como todo movimiento bloquea su
// producto antes de registrarse, no puede aparecer uno nuevo hasta el final.
async function versiones(db, ids) {
  const filas = await db.$queryRaw`
    SELECT producto_id AS "productoId", MAX(id) AS "ultimo"
    FROM movimientos_stock WHERE producto_id IN (${Prisma.join(ids)}) GROUP BY producto_id`;
  return new Map(filas.map((f) => [f.productoId, f.ultimo]));
}

// Estado de un producto para cargarlo en el recuento: stock y versión leídos
// en una sola consulta, así corresponden al mismo momento.
export async function productoParaRecuento(id) {
  const [p] = await prisma.$queryRaw`
    SELECT p.id, p.nombre, p.activo, p.unidad_medida::text AS "unidadMedida", p.stock_actual AS "stockActual",
           (SELECT MAX(m.id) FROM movimientos_stock m WHERE m.producto_id = p.id) AS "ultimoMovimientoId"
    FROM productos p WHERE p.id = ${id}`;
  if (!p) throw ApiError.noEncontrado('Producto no encontrado');
  return { ...p, stockActual: new Prisma.Decimal(p.stockActual).toNumber() };
}

export function crear({ observacion, lineas }, usuarioId) {
  return prisma.$transaction(
    async (tx) => {
      // Bloquea todos los productos de una vez y en orden de id, como las
      // salidas (HU13) y la confirmación de ingresos (HU11): las operaciones
      // sobre los mismos productos se aplican una detrás de la otra sin
      // trabarse entre sí.
      const ids = lineas.map((l) => l.productoId).sort((a, b) => a - b);
      const filas = await tx.$queryRaw`
        SELECT id, nombre, activo, unidad_medida::text AS "unidadMedida", stock_actual AS "stockActual"
        FROM productos WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const ultimos = await versiones(tx, ids);
      const productos = new Map(filas.map((f) => [f.id, { ...f, ultimoMovimientoId: ultimos.get(f.id) ?? null }]));
      const analisis = analizarRecuento(lineas, productos);
      if (analisis.problemas.length > 0) {
        throw ApiError.invalido('Revisá el recuento: no se ajustó ningún producto.', analisis.problemas);
      }
      if (analisis.cambios.length > 0) {
        throw new ApiError(
          409,
          'Algunos productos tuvieron movimientos mientras contabas. No se ajustó ninguno: revisá el conteo y confirmá de nuevo.',
          analisis.cambios,
        );
      }

      const fecha = new Date();
      const movimientos = new Map();
      for (const l of [...analisis.lineas].sort((a, b) => a.productoId - b.productoId)) {
        if (l.diferencia.isZero()) continue; // HU14: sin diferencia no hay ajuste.
        const { movimiento } = await registrarMovimiento(tx, {
          productoId: l.productoId,
          tipo: 'AJUSTE',
          motivo: 'RECUENTO',
          cantidad: l.diferencia,
          usuarioId,
          observacion: observacion ?? null,
          fecha,
        });
        movimientos.set(l.productoId, movimiento.id);
      }

      const respuesta = analisis.lineas.map((l) => {
        const p = productos.get(l.productoId);
        return {
          producto: { id: p.id, nombre: p.nombre, unidadMedida: p.unidadMedida },
          stockAnterior: l.stockRegistrado.toNumber(),
          contado: l.contado.toNumber(),
          diferencia: l.diferencia.toNumber(),
          movimientoId: movimientos.get(l.productoId) ?? null,
        };
      });
      return { fecha, observacion: observacion ?? null, lineas: respuesta, resumen: resumir(analisis.lineas) };
    },
    { timeout: 20_000 },
  );
}
