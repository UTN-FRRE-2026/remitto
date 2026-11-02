import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { listarMovimientosSchema } from './movimientos.schema.js';
import * as movimientos from './movimientos.service.js';

const router = Router();

router.use(autenticar);

// HU12: historial de movimientos (propietario y empleado). Con productoId
// agrega las existencias del producto y si coinciden con sus movimientos.
router.get('/', validar(listarMovimientosSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await movimientos.listar(req.query));
}));

// HU12: productos cuyo stock no coincide con la suma de sus movimientos.
// Se corrige con `npm run conciliar-stock -- --aplicar`.
router.get('/conciliacion', exigirRol('PROPIETARIO'), asyncHandler(async (req, res) => {
  res.json(await movimientos.conciliacion());
}));

export default router;
