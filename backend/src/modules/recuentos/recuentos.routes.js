import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar } from '../../middlewares/auth.js';
import { crearRecuentoSchema, idParamSchema } from './recuentos.schema.js';
import * as recuentos from './recuentos.service.js';

const router = Router();

router.use(autenticar);

// Stock y versión (último movimiento) de un producto al agregarlo al recuento.
router.get('/producto/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await recuentos.productoParaRecuento(req.params.id));
}));

// HU14: registra un recuento físico (propietario y empleado). 201 si se
// registró algún ajuste; 200 si no había diferencias. 409 si algún producto
// tuvo movimientos desde que se leyó (no se ajusta ninguno).
router.post('/', validar(crearRecuentoSchema), asyncHandler(async (req, res) => {
  const recuento = await recuentos.crear(req.body, req.usuario.id);
  res.status(recuento.resumen.conDiferencia > 0 ? 201 : 200).json(recuento);
}));

export default router;
