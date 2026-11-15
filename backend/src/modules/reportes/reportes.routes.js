import { Router } from 'express';
import { asyncHandler, ApiError } from '../../lib/errors.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { sinMovimientoSchema, preciosSchema, productoParamSchema, ordenCompraSchema } from './reportes.schema.js';
import { prisma } from '../../lib/prisma.js';
import { ordenDeCompra, nombreArchivo, generarPdf } from './ordenCompra.js';
import * as reportes from './reportes.service.js';

const router = Router();

// HU20, HU27, HU28, HU29: los reportes exponen costos de compra; los consulta el propietario.
router.use(autenticar, exigirRol('PROPIETARIO'));

router.get('/valorizacion', asyncHandler(async (req, res) => {
  res.json(await reportes.valorizacion());
}));

// HU27: qué comprar y cuánto, agrupado por el último proveedor.
router.get('/reposicion', asyncHandler(async (req, res) => {
  res.json(await reportes.reposicion());
}));

// HU31: la sugerencia de un proveedor como orden de compra (PDF para
// descargar). Usa el mismo cálculo de HU27; "sin" = productos sin compras.
router.get('/reposicion/orden', validar(ordenCompraSchema, 'query'), asyncHandler(async (req, res) => {
  const clave = req.query.proveedor;
  const proveedor = clave === 'sin' ? null : await prisma.proveedor.findUnique({ where: { id: clave } });
  const orden = ordenDeCompra(await reportes.reposicion(), clave, proveedor);
  if (!orden) throw ApiError.noEncontrado('Ese proveedor no tiene productos para pedir en la sugerencia actual');
  const pdf = await generarPdf(orden);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${nombreArchivo(orden)}"`,
    'Cache-Control': 'no-store',
    'Content-Length': pdf.length,
  });
  res.send(pdf);
}));

// HU29: productos con stock sin salidas en el período (?desde=&hasta=).
router.get('/sin-movimiento', validar(sinMovimientoSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await reportes.sinMovimiento(req.query));
}));

// HU20: productos con precios de compra en el período (?desde=&hasta=), los que más aumentaron primero.
router.get('/precios', validar(preciosSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await reportes.precios(req.query));
}));

// HU20: historial de un producto por proveedor y comparación del último precio.
router.get(
  '/precios/:productoId',
  validar(productoParamSchema, 'params'),
  validar(preciosSchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await reportes.preciosDeProducto(req.params.productoId, req.query));
  }),
);

export default router;
