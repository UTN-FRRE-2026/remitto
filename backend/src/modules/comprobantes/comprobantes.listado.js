// HU18 (RF3.7): consulta de los comprobantes cargados. Solo lectura: para
// retomar uno en revisión o ver el confirmado se usan las pantallas de lectura
// y revisión (HU9, HU10), que ya muestran el archivo original junto a las líneas.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rangoFechas } from '../movimientos/movimientos.service.js';

// Filtro de estado: EN_PROCESO agrupa PENDIENTE y PROCESANDO.
export function filtroEstado(estado) {
  if (!estado) return undefined;
  if (estado === 'EN_PROCESO') return { in: ['PENDIENTE', 'PROCESANDO'] };
  return estado;
}

export function condiciones({ proveedorId, estado, desde, hasta, numero } = {}) {
  const where = {};
  if (proveedorId) where.proveedorId = proveedorId;
  const porEstado = filtroEstado(estado);
  if (porEstado) where.estado = porEstado;
  const fecha = rangoFechas(desde, hasta);
  if (fecha) where.cargadoEn = fecha;
  if (numero) where.numero = { contains: numero, mode: 'insensitive' };
  return where;
}

// Qué pantalla abre cada comprobante desde el listado.
export function destino(estado) {
  if (estado === 'EN_REVISION') return 'REVISAR'; // se retoma la revisión
  if (estado === 'CONFIRMADO' || estado === 'ANULADO') return 'VER'; // revisión en solo lectura
  return 'LECTURA'; // pendiente, leyendo o con error: estado de la lectura
}

const decimal = (v) => (v == null ? null : new Prisma.Decimal(v).toNumber());

export async function listar(filtros = {}) {
  const { pagina = 1, limite = 20 } = filtros;
  const where = condiciones(filtros);
  // Los conteos por estado ignoran el filtro de estado: sirven para los chips.
  const sinEstado = condiciones({ ...filtros, estado: undefined });

  const [total, filas, grupos] = await prisma.$transaction([
    prisma.comprobante.count({ where }),
    prisma.comprobante.findMany({
      where,
      select: {
        id: true,
        tipo: true,
        numero: true,
        fechaEmision: true,
        totalDeclarado: true,
        estado: true,
        requiereRevision: true,
        archivoMime: true,
        cargadoEn: true,
        confirmadoEn: true,
        proveedor: { select: { id: true, razonSocial: true } },
        cargadoPor: { select: { id: true, nombre: true } },
        confirmadoPor: { select: { id: true, nombre: true } },
        _count: { select: { detalles: { where: { estado: { not: 'DESCARTADO' } } } } },
      },
      orderBy: [{ cargadoEn: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * limite,
      take: limite,
    }),
    prisma.comprobante.groupBy({ by: ['estado'], where: sinEstado, _count: { _all: true }, orderBy: { estado: 'asc' } }),
  ]);

  const ids = filas.map((c) => c.id);
  const [leidos, unidades] = ids.length
    ? await Promise.all([
        // Número leído por la IA: referencia mientras el definitivo no se cargó.
        prisma.$queryRaw`SELECT id, respuesta_ia->'normalizada'->'cabecera'->>'numero' AS numero
          FROM comprobantes WHERE id IN (${Prisma.join(ids)})`,
        prisma.detalleComprobante.groupBy({
          by: ['comprobanteId'],
          where: { comprobanteId: { in: ids }, estado: 'CONFIRMADO' },
          _sum: { cantidad: true },
          orderBy: { comprobanteId: 'asc' },
        }),
      ])
    : [[], []];
  const numeroLeido = new Map(leidos.map((f) => [f.id, f.numero]));
  const unidadesIngresadas = new Map(unidades.map((u) => [u.comprobanteId, decimal(u._sum.cantidad)]));

  const porEstado = Object.fromEntries(grupos.map((g) => [g.estado, g._count._all]));
  porEstado.EN_PROCESO = (porEstado.PENDIENTE ?? 0) + (porEstado.PROCESANDO ?? 0);
  porEstado.TODOS = grupos.reduce((s, g) => s + g._count._all, 0);

  return {
    comprobantes: filas.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      numero: c.numero,
      numeroLeido: numeroLeido.get(c.id) ?? null,
      fechaEmision: c.fechaEmision,
      totalDeclarado: decimal(c.totalDeclarado),
      estado: c.estado,
      requiereRevision: c.requiereRevision,
      esPdf: c.archivoMime === 'application/pdf',
      proveedor: c.proveedor,
      cargadoEn: c.cargadoEn,
      cargadoPor: c.cargadoPor,
      confirmadoEn: c.confirmadoEn,
      confirmadoPor: c.confirmadoPor,
      lineas: c._count.detalles,
      unidadesIngresadas: unidadesIngresadas.get(c.id) ?? null,
      destino: destino(c.estado),
    })),
    total,
    pagina,
    limite,
    hayMas: pagina * limite < total,
    porEstado,
  };
}
