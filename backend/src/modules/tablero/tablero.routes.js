import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { autenticar } from '../../middlewares/auth.js';
import { tablero } from './tablero.service.js';

const router = Router();

// HU26: tablero de situación para el Inicio. Propietario y empleado; el valor
// del stock (costos) solo se incluye para el propietario.
router.use(autenticar);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await tablero(req.usuario));
}));

export default router;
