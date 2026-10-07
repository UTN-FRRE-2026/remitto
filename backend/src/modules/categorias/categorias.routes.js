import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { categoriaSchema, idParamSchema } from './categorias.schema.js';
import * as categorias from './categorias.service.js';

const router = Router();

router.use(autenticar);

// Cualquier usuario autenticado puede consultar las categorías.
router.get('/', asyncHandler(async (req, res) => {
  res.json(await categorias.listar());
}));

// La administración del catálogo es del propietario (RF2).
router.post('/', exigirRol('PROPIETARIO'), validar(categoriaSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await categorias.crear(req.body));
}));

router.patch(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  validar(categoriaSchema),
  asyncHandler(async (req, res) => {
    res.json(await categorias.actualizar(req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await categorias.eliminar(req.params.id);
    res.status(204).end();
  }),
);

export default router;
