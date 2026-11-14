import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import * as reportes from './reportes.service.js';

const router = Router();

// HU28: el reporte expone los costos de compra; lo consulta el propietario.
router.use(autenticar, exigirRol('PROPIETARIO'));

router.get('/valorizacion', asyncHandler(async (req, res) => {
  res.json(await reportes.valorizacion());
}));

export default router;
