import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar } from '../../middlewares/auth.js';
import { crearSalidaSchema, listarSalidasSchema, idParamSchema } from './salidas.schema.js';
import * as salidas from './salidas.service.js';

const router = Router();

router.use(autenticar);

// HU13: registra una salida desde el carrito (propietario y empleado).
// 201 la primera vez; 200 con "repetida": true si se reenvía el mismo
// idOperacion (no se descuenta de nuevo).
router.post('/', validar(crearSalidaSchema), asyncHandler(async (req, res) => {
  const { salida, repetida } = await salidas.crear(req.body, req.usuario.id);
  res.status(repetida ? 200 : 201).json({ ...salida, repetida });
}));

router.get('/', validar(listarSalidasSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await salidas.listar(req.query));
}));

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await salidas.obtener(req.params.id));
}));

export default router;
