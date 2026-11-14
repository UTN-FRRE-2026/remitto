import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { registrarSalida, incluirSalida, esUnico, OPCIONES_TRANSACCION } from '../salidas/salidas.service.js';

// HU22 (RF5.2): ventas informadas por un sistema externo (punto de venta),
// autenticado con su clave de integración (HU21).
// - Se registran con el mismo núcleo que el carrito (registrarSalida): una
//   cabecera Salida con origen INTEGRACION y un movimiento por producto, todo
//   en una transacción y bloqueando los productos en orden de id.
// - Idempotencia: la referencia de la venta es única por clave
//   (@@unique [clave_integracion_id, referencia_externa]). Cada venta guarda
//   su petición normalizada (pedido_externo). Un reenvío con las mismas
//   líneas normalizadas, con sus identificadores originales, devuelve la venta
//   ya registrada (200, repetida) sin consultar el catálogo ni descontar de
//   nuevo, aunque el código de barras haya cambiado o el producto se haya
//   desactivado. Con otras líneas, se rechaza (409). La fecha no participa.
// - La venta ya ocurrió en la caja: si el stock no alcanza se registra igual,
//   el stock queda negativo y la respuesta lo avisa (el recuento, HU14, lo
//   corrige). Un producto inexistente, desactivado o una fracción de algo que
//   se vende por unidad rechazan la venta entera (400), sin descontar nada.

const decimal = (v) => new Prisma.Decimal(v);

// Petición normalizada (pura): una línea por identificador tal como llegó
// (productoId o codigoBarras, que no se mezclan aunque sean el mismo
// producto), con las cantidades sumadas como texto decimal («2» y «2.0» son
// iguales) y en orden. No incluye la fecha: un reenvío es la misma venta.
export function normalizarPedido(lineas) {
  const porIdentificador = new Map();
  for (const l of lineas) {
    const clave = l.productoId !== undefined ? `p:${l.productoId}` : `c:${String(l.codigoBarras).trim()}`;
    porIdentificador.set(clave, (porIdentificador.get(clave) ?? decimal(0)).plus(l.cantidad));
  }
  return [...porIdentificador]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([clave, cantidad]) =>
      clave.startsWith('p:')
        ? { productoId: Number(clave.slice(2)), cantidad: cantidad.toFixed() }
        : { codigoBarras: clave.slice(2), cantidad: cantidad.toFixed() },
    );
}

// Firma comparable de una petición normalizada: una lista de tuplas
// [tipo, identificador, cantidad] ordenada y serializada con JSON. Las
// comillas y separadores de JSON la hacen inequívoca para cualquier código de
// barras (una concatenación de texto confundía «a=1|c:b» con «a» y «b»). No
// depende del orden de las claves de cada objeto (jsonb las reordena).
const compararTuplas = (a, b) => {
  for (let i = 0; i < 2; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};
export const firmaPedido = (pedido) =>
  JSON.stringify(
    pedido
      .map((l) =>
        l.productoId !== undefined
          ? ['productoId', String(l.productoId), decimal(l.cantidad).toFixed()]
          : ['codigoBarras', String(l.codigoBarras), decimal(l.cantidad).toFixed()],
      )
      .sort(compararTuplas),
  );

// Junta las líneas del mismo producto (una caja puede escanear dos veces el
// mismo artículo). Devuelve [{ productoId, cantidad: Decimal }] ordenado por id.
export function agruparLineas(lineas) {
  const porProducto = new Map();
  for (const l of lineas) {
    porProducto.set(l.productoId, (porProducto.get(l.productoId) ?? decimal(0)).plus(l.cantidad));
  }
  return [...porProducto]
    .map(([productoId, cantidad]) => ({ productoId, cantidad }))
    .sort((a, b) => a.productoId - b.productoId);
}

// ¿El reenvío trae los mismos productos y cantidades que la venta registrada?
// Solo para ventas anteriores a pedido_externo (no se les inventa la
// petición): compara los productos ya resueltos.
// registrada: [{ productoId, cantidad }] con cantidades positivas.
export function mismoContenido(registrada, pedida) {
  if (registrada.length !== pedida.length) return false;
  const pedidas = new Map(pedida.map((l) => [l.productoId, decimal(l.cantidad)]));
  return registrada.every((l) => pedidas.get(l.productoId)?.eq(l.cantidad) === true);
}

// Respuesta de la API: datos públicos de la venta, con un aviso por cada
// producto que quedó con stock negativo.
export function mapearVenta(s) {
  const lineas = s.movimientos.map((m) => {
    const cantidad = decimal(m.cantidad);
    const stockAnterior = decimal(m.stockAnterior);
    return {
      producto: m.producto,
      cantidad: cantidad.negated().toNumber(),
      stockAnterior: stockAnterior.toNumber(),
      stockNuevo: stockAnterior.plus(cantidad).toNumber(),
    };
  });
  return {
    id: s.id,
    referencia: s.referenciaExterna,
    fecha: s.fechaExterna,
    registradaEn: s.registradaEn,
    lineas,
    advertencias: lineas
      .filter((l) => l.stockNuevo < 0)
      .map((l) => ({
        productoId: l.producto.id,
        mensaje: `${l.producto.nombre} quedó con stock negativo (${l.stockNuevo.toLocaleString('es-AR')}). Conviene hacer un recuento.`,
      })),
  };
}

const incluirVenta = {
  ...incluirSalida,
  movimientos: {
    include: { producto: { select: { id: true, nombre: true, codigoBarras: true, unidadMedida: true } } },
    orderBy: { productoId: 'asc' },
  },
};

// Traduce los códigos de barras a productos. Un código desconocido es un
// problema de la venta (400), con el índice de la línea para ubicarlo.
async function resolverProductos(lineas) {
  const codigos = [...new Set(lineas.filter((l) => l.codigoBarras !== undefined).map((l) => l.codigoBarras))];
  const productos = codigos.length
    ? await prisma.producto.findMany({ where: { codigoBarras: { in: codigos } }, select: { id: true, codigoBarras: true } })
    : [];
  const porCodigo = new Map(productos.map((p) => [p.codigoBarras, p.id]));
  const problemas = [];
  const resueltas = lineas.map((l, i) => {
    if (l.productoId !== undefined) return { productoId: l.productoId, cantidad: l.cantidad };
    const productoId = porCodigo.get(l.codigoBarras);
    if (!productoId) {
      problemas.push({ campo: `lineas.${i}.codigoBarras`, mensaje: `No hay un producto con el código de barras ${l.codigoBarras}.` });
    }
    return { productoId, cantidad: l.cantidad };
  });
  if (problemas.length) throw ApiError.invalido('Revisá la venta: no se descontó ningún producto.', problemas);
  return resueltas;
}

function previa(claveId, referencia) {
  return prisma.salida.findFirst({
    where: { origen: 'INTEGRACION', claveIntegracionId: claveId, referenciaExterna: referencia },
    include: incluirVenta,
  });
}

// La venta ya estaba registrada: misma petición → la devuelve; otra → 409.
async function respuestaReenvio(registrada, pedido, lineas) {
  const venta = mapearVenta(registrada);
  let igual;
  if (registrada.pedidoExterno) {
    igual = firmaPedido(registrada.pedidoExterno) === firmaPedido(pedido);
  } else {
    // Venta anterior a la migración: se comparan los productos resueltos.
    const anteriores = venta.lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad }));
    igual = mismoContenido(anteriores, agruparLineas(await resolverProductos(lineas).catch(() => [])));
  }
  if (!igual) {
    throw ApiError.conflicto(
      `La venta ${registrada.referenciaExterna} ya se registró con otros productos o cantidades. Usá una referencia nueva para otra venta.`,
    );
  }
  return { venta, repetida: true };
}

export async function registrarVenta(clave, { referencia, fecha, lineas }) {
  // Primero se busca la venta: un reenvío se reconoce por la petición, sin
  // consultar el catálogo (que puede haber cambiado desde la venta).
  const pedido = normalizarPedido(lineas);
  const anterior = await previa(clave.id, referencia);
  if (anterior) return respuestaReenvio(anterior, pedido, lineas);

  const agrupadas = agruparLineas(await resolverProductos(lineas));

  try {
    const registrada = await prisma.$transaction(
      async (tx) => {
        // La clave se vuelve a comprobar dentro de la transacción, con un
        // bloqueo compartido: si se revoca al mismo tiempo, o la venta termina
        // antes de la revocación o se rechaza. Nunca entra una venta después.
        const [vigente] = await tx.$queryRaw`
          SELECT activa FROM claves_integracion WHERE id = ${clave.id} FOR SHARE`;
        if (!vigente?.activa) throw ApiError.noAutorizado('Clave de integración inválida o revocada');

        return registrarSalida(tx, {
          cabecera: {
            origen: 'INTEGRACION',
            motivo: 'VENTA',
            claveIntegracionId: clave.id,
            referenciaExterna: referencia,
            fechaExterna: fecha ?? null,
            pedidoExterno: pedido,
          },
          lineas: agrupadas,
          permitirNegativo: true,
          mensajeProblemas: 'Revisá la venta: no se descontó ningún producto.',
          include: incluirVenta,
        });
      },
      OPCIONES_TRANSACCION,
    );
    return { venta: mapearVenta(registrada), repetida: false };
  } catch (err) {
    // Dos envíos simultáneos de la misma venta: el segundo choca con el
    // índice único y responde con la venta que registró el primero.
    if (esUnico(err)) {
      const ganadora = await previa(clave.id, referencia);
      if (ganadora) return respuestaReenvio(ganadora, pedido, lineas);
    }
    throw err;
  }
}
