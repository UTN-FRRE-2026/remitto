import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  idParamSchema,
} from './usuarios.schema.js';
import * as usuarios from './usuarios.service.js';

const router = Router();

// RF1.3: la administración de usuarios es exclusiva del propietario.
router.use(autenticar, exigirRol('PROPIETARIO'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await usuarios.listar());
}));

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await usuarios.obtener(req.params.id));
}));

router.post('/', validar(crearUsuarioSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await usuarios.crear(req.body));
}));

router.patch(
  '/:id',
  validar(idParamSchema, 'params'),
  validar(actualizarUsuarioSchema),
  asyncHandler(async (req, res) => {
    res.json(await usuarios.actualizar(req.params.id, req.body, req.usuario));
  }),
);

router.delete('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await usuarios.desactivar(req.params.id, req.usuario));
}));

export default router;
