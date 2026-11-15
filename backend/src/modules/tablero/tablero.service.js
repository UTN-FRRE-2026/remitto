import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import * as productos from '../productos/productos.service.js';
import { contar, ordenarActivas } from '../alertas/alertas.service.js';
import { valorizacion } from '../reportes/reportes.service.js';
import { destino } from '../comprobantes/comprobantes.listado.js';

// HU26 (RF8.4): tablero de situación. Alertas activas, comprobantes
// pendientes, valor del stock (solo el propietario), resumen de stock y
// productos para reponer.
//
// Una sola foto de la base: todas las lecturas van dentro de una transacción
// REPEATABLE READ de solo lectura. En PostgreSQL la primera consulta toma la
// foto y las siguientes de la misma transacción ven exactamente esa, aunque
// mientras tanto se confirmen movimientos. Por eso los servicios reutilizados
// reciben la transacción (tx) y las consultas van una detrás de otra. Un único
// endpoint o un Promise.all de consultas sueltas no alcanza: en READ COMMITTED
// cada consulta ve su propio momento y los números pueden no coincidir.

// Pendientes: todo comprobante cargado que no está confirmado ni anulado.
export const ESTADOS_PENDIENTES = ['PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'ERROR'];
const CANTIDAD_REPONER = 4;
const CANTIDAD_ALERTAS = 5;
const CANTIDAD_EN_REVISION = 3;

// Conteo de pendientes por estado (pura): los cuatro estados, con ceros.
// filas: [{ estado, cantidad }]; CONFIRMADO, ANULADO u otros se ignoran.
export function pendientesPorEstado(filas) {
  const porEstado = Object.fromEntries(ESTADOS_PENDIENTES.map((e) => [e, 0]));
  for (const f of filas) {
    if (f.estado in porEstado) porEstado[f.estado] += Number(f.cantidad);
  }
  return { total: ESTADOS_PENDIENTES.reduce((s, e) => s + porEstado[e], 0), porEstado };
}

// Productos para reponer (pura): primero sin stock y después stock bajo, en
// el orden recibido (por nombre), hasta `cantidad`.
export function paraReponer(lista, cantidad = CANTIDAD_REPONER) {
  return [...lista.filter((p) => p.estadoStock === 'SIN_STOCK'), ...lista.filter((p) => p.estadoStock === 'STOCK_BAJO')]
    .slice(0, cantidad)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria ? { id: p.categoria.id, nombre: p.categoria.nombre } : null,
      unidadMedida: p.unidadMedida,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      estadoStock: p.estadoStock,
    }));
}

const numero = (v) => new Prisma.Decimal(v).toNumber();

// Alertas activas ordenadas por gravedad (también las usa el asistente, HU25).
export async function alertasActivas(tx, cantidad = CANTIDAD_ALERTAS) {
  const filas = await tx.alertaStock.findMany({
    where: { estado: 'ACTIVA' },
    include: { producto: { select: { id: true, nombre: true, unidadMedida: true, stockActual: true, stockMinimo: true } } },
  });
  const lista = ordenarActivas(
    filas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      creadaEn: a.creadaEn,
      producto: {
        id: a.producto.id,
        nombre: a.producto.nombre,
        unidadMedida: a.producto.unidadMedida,
        stockActual: numero(a.producto.stockActual),
        stockMinimo: numero(a.producto.stockMinimo),
      },
    })),
  );
  return { totales: contar(lista), principales: lista.slice(0, cantidad), todas: lista };
}

async function comprobantesPendientes(tx) {
  const grupos = await tx.comprobante.groupBy({
    by: ['estado'],
    where: { estado: { in: ESTADOS_PENDIENTES } },
    _count: { _all: true },
    orderBy: { estado: 'asc' },
  });
  const enRevision = await tx.comprobante.findMany({
    where: { estado: 'EN_REVISION' },
    select: { id: true, tipo: true, numero: true, estado: true, cargadoEn: true, proveedor: { select: { id: true, razonSocial: true } } },
    orderBy: [{ cargadoEn: 'desc' }, { id: 'desc' }],
    take: CANTIDAD_EN_REVISION,
  });
  // Número leído por la IA, de referencia mientras no se cargó el definitivo.
  const leidos = enRevision.length
    ? await tx.$queryRaw`SELECT id, respuesta_ia->'normalizada'->'cabecera'->>'numero' AS numero
        FROM comprobantes WHERE id IN (${Prisma.join(enRevision.map((c) => c.id))})`
    : [];
  const numeroLeido = new Map(leidos.map((f) => [f.id, f.numero]));
  return {
    ...pendientesPorEstado(grupos.map((g) => ({ estado: g.estado, cantidad: g._count._all }))),
    enRevision: enRevision.map((c) => ({ ...c, numeroLeido: numeroLeido.get(c.id) ?? null, destino: destino(c.estado) })),
  };
}

// usuario: { rol }. db: cliente de Prisma (en pruebas, el de otra base).
// Solo para pruebas: `aislamiento` cambia el nivel de la transacción y
// `entreLecturas` corre después de leer el resumen de stock (la primera
// lectura) y antes del resto.
export async function tablero(usuario, db = prisma, { aislamiento = 'RepeatableRead', entreLecturas } = {}) {
  const esPropietario = usuario?.rol === 'PROPIETARIO';
  return db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      // Primera lectura: acá PostgreSQL toma la foto de la transacción.
      const [{ generadoEn }] = await tx.$queryRaw`SELECT now() AS "generadoEn"`;
      const stock = await productos.resumen(tx);
      if (entreLecturas) await entreLecturas();
      const { todas: _todas, ...alertas } = await alertasActivas(tx);
      const comprobantes = await comprobantesPendientes(tx);
      const reponer = paraReponer(await productos.listar({}, tx));
      const respuesta = { generadoEn, stock, alertas, comprobantes, reponer };
      if (esPropietario) {
        // El mismo cálculo de HU28 (valorización a último precio de compra).
        const v = await valorizacion(tx);
        respuesta.valorStock = {
          total: v.total,
          productosValorizados: v.productosValorizados,
          productosSinPrecio: v.sinPrecio.length,
          productosStockNegativo: v.stockNegativo.length,
        };
      }
      return respuesta;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel[aislamiento], maxWait: 10_000, timeout: 20_000 },
  );
}
