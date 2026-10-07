import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import {
  crearProveedorSchema,
  actualizarProveedorSchema,
  idParamSchema,
  listarQuerySchema,
} from './proveedores.schema.js';
import * as proveedores from './proveedores.service.js';

const router = Router();

router.use(autenticar);

router.get('/', validar(listarQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await proveedores.listar(req.query));
}));

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await proveedores.obtener(req.params.id));
}));

router.post('/', exigirRol('PROPIETARIO'), validar(crearProveedorSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await proveedores.crear(req.body));
}));

router.patch(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  validar(actualizarProveedorSchema),
  asyncHandler(async (req, res) => {
    res.json(await proveedores.actualizar(req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await proveedores.desactivar(req.params.id));
  }),
);

export default router;
