import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { autenticar } from '../../middlewares/auth.js';
import { prisma } from '../../lib/prisma.js';
import * as alertas from './alertas.service.js';

const router = Router();

// HU24: propietario y empleado ven las alertas activas (las genera el sistema;
// no hay altas ni bajas manuales).
router.use(autenticar);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await alertas.listar({}, prisma));
}));

export default router;
