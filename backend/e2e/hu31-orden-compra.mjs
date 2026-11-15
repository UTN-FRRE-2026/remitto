// HU31: orden de compra desde la sugerencia de reposición (criterio: la orden
// incluye producto, cantidad y proveedor; un documento por proveedor que se
// puede descargar). El texto del PDF se compara con /reportes/reposicion.
import { textoPdf, textoPlano } from '../test/pdf-texto.js';
import { formatoCantidad } from '../src/modules/reportes/ordenCompra.js';

const UNIDAD = { UNIDAD: 'u.', KILOGRAMO: 'kg', GRAMO: 'g', LITRO: 'l', MILILITRO: 'ml', METRO: 'm', PAQUETE: 'paq.' };

export default async function hu31({ api, check, db, dueño, empleado, base }) {
  // Descarga binaria (el helper api() lee texto).
  const descargar = async (proveedor, token = dueño) => {
    const res = await fetch(`${base}/reportes/reposicion/orden${proveedor === undefined ? '' : `?proveedor=${proveedor}`}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const cuerpo = Buffer.from(await res.arrayBuffer());
    return { status: res.status, tipo: res.headers.get('content-type'), disposicion: res.headers.get('content-disposition'), cuerpo };
  };
  const ultimoMovimiento = async (productoId) =>
    (await db.movimientoStock.findFirst({ where: { productoId }, orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? null;
  const fijarStock = async (productoId, contado) => {
    const p = await db.producto.findUnique({ where: { id: productoId } });
    await api('POST', '/recuentos', {
      token: dueño,
      cuerpo: { lineas: [{ productoId, contado, stockRegistrado: Number(p.stockActual), ultimoMovimientoId: await ultimoMovimiento(productoId) }] },
    });
  };
  const crear = async (datos, stock) => {
    const p = (await api('POST', '/productos', { token: dueño, cuerpo: datos })).body;
    if (stock) await fijarStock(p.id, stock);
    return p;
  };
  const nuevoProveedor = async (razonSocial, cuit) => (await api('POST', '/proveedores', { token: dueño, cuerpo: { razonSocial, cuit } })).body;
  const precio = (productoId, proveedorId, precioUnitario) =>
    db.precioCompra.create({ data: { productoId, proveedorId, precioUnitario, fechaVigencia: new Date('2026-11-01T00:00:00Z') } });

  // --- Datos: dos proveedores, un producto sin compras, uno por kilo y uno sin deseado ---
  const norte = await nuevoProveedor('Distribuidora Ñandú S.R.L.', '30-71234567-1');
  const lacteos = await nuevoProveedor('Lácteos del Litoral', '30-71234568-9');
  const sinPedido = await nuevoProveedor('Proveedor sin pedido', '30-71234569-7');
  const yerba = await crear({ nombre: 'Yerba compuesta con cáscara de naranja 1 kg', stockMinimo: 8, stockDeseado: 24 }, 2);
  const fideos = await crear({ nombre: 'Fideos tirabuzón', stockMinimo: 10, stockDeseado: 30 }, 4);
  const queso = await crear({ nombre: 'Queso cremoso', unidadMedida: 'KILOGRAMO', stockMinimo: 2, stockDeseado: 3 }, 0.625);
  const nuevo = await crear({ nombre: 'Producto nunca comprado', stockMinimo: 5, stockDeseado: 9 }, 1);
  const sinDeseado = await crear({ nombre: 'Sin deseado', stockMinimo: 5 }, 1);
  await precio(yerba.id, norte.id, 2000);
  await precio(fideos.id, norte.id, 900);
  await precio(sinDeseado.id, norte.id, 100);
  await precio(queso.id, lacteos.id, 8000);

  const sugerencia = (await api('GET', '/reportes/reposicion', { token: dueño })).body;
  const grupo = (id) => sugerencia.proveedores.find((g) => g.id === id);
  const lineaPdf = (p) => `${p.nombre} ${formatoCantidad(p.cantidad)} ${UNIDAD[p.unidadMedida]}`;
  const antes = await db.$queryRaw`SELECT (SELECT count(*) FROM movimientos_stock)::int AS movimientos, (SELECT sum(stock_actual) FROM productos)::float AS stock`;

  // --- Un documento por proveedor ---
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  const a = await descargar(norte.id);
  check(
    a.status === 200 && a.tipo === 'application/pdf' && a.cuerpo.subarray(0, 5).toString() === '%PDF-',
    'descarga: 200, application/pdf y un PDF válido',
  );
  check(a.disposicion === `attachment; filename="orden-compra-distribuidora-nandu-s-r-l-${hoy}.pdf"`, `se descarga como archivo (${a.disposicion})`);
  const textoA = textoPlano(textoPdf(a.cuerpo));
  check(textoA.includes('Proveedor: Distribuidora Ñandú S.R.L.') && textoA.includes('CUIT 30-71234567-1'), 'criterio: la orden incluye el proveedor');
  check(
    grupo(norte.id).productos.every((p) => textoA.includes(lineaPdf(p))) && grupo(norte.id).productos.length === 2,
    `criterio: incluye cada producto con su cantidad (${grupo(norte.id).productos.map(lineaPdf).join('; ')})`,
  );
  check(!textoA.includes('Queso cremoso') && !textoA.includes('Sin deseado') && !textoA.includes('$'), 'solo productos de ese proveedor, sin el que no tiene deseado y sin precios');

  const b = await descargar(lacteos.id);
  const textoB = textoPlano(textoPdf(b.cuerpo));
  check(b.status === 200 && textoB.includes('Proveedor: Lácteos del Litoral') && textoB.includes('Queso cremoso 2,375 kg'), 'cantidad decimal con su unidad (2,375 kg)');
  check(!textoB.includes('Fideos'), 'cada proveedor tiene su propio documento');

  const sin = await descargar('sin');
  const textoSin = textoPlano(textoPdf(sin.cuerpo));
  check(
    sin.status === 200 && /sin-proveedor/.test(sin.disposicion) && textoSin.includes('Proveedor: a definir') && textoSin.includes(lineaPdf(grupo(null).productos.find((p) => p.id === nuevo.id))),
    'productos sin proveedor: lista con «a definir» e incluye el producto nunca comprado',
  );

  // --- Proveedor sin pedido y parámetros ---
  check((await descargar(sinPedido.id)).status === 404, 'proveedor sin productos para pedir: 404');
  check((await descargar(999999)).status === 404, 'proveedor inexistente: 404');
  check((await descargar('abc')).status === 400 && (await descargar()).status === 400, 'parámetro inválido o ausente: 400');

  // --- Permisos ---
  check((await descargar(norte.id, empleado)).status === 403, 'el empleado no descarga órdenes (403)');
  check((await descargar(norte.id, null)).status === 401, 'sin sesión: 401');

  // --- Sin efectos ---
  const despues = await db.$queryRaw`SELECT (SELECT count(*) FROM movimientos_stock)::int AS movimientos, (SELECT sum(stock_actual) FROM productos)::float AS stock`;
  check(JSON.stringify(antes) === JSON.stringify(despues), 'descargar no modifica stock ni movimientos');
}
