import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { validar } from '../../middlewares/validar.js';
import { sinMovimientoSchema } from './reportes.schema.js';
import * as reportes from './reportes.service.js';

const router = Router();

// HU27, HU28, HU29: los reportes exponen costos de compra; los consulta el propietario.
router.use(autenticar, exigirRol('PROPIETARIO'));

router.get('/valorizacion', asyncHandler(async (req, res) => {
  res.json(await reportes.valorizacion());
}));

// HU27: qué comprar y cuánto, agrupado por el último proveedor.
router.get('/reposicion', asyncHandler(async (req, res) => {
  res.json(await reportes.reposicion());
}));

// HU29: productos con stock sin salidas en el período (?desde=&hasta=).
router.get('/sin-movimiento', validar(sinMovimientoSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await reportes.sinMovimiento(req.query));
}));

export default router;
