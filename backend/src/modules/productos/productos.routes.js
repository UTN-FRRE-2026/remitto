import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import {
  crearProductoSchema,
  actualizarProductoSchema,
  idParamSchema,
  listarQuerySchema,
} from './productos.schema.js';
import * as productos from './productos.service.js';

const router = Router();

router.use(autenticar);

// Indicadores agregados (tablero y encabezado de productos).
router.get('/resumen', asyncHandler(async (req, res) => {
  res.json(await productos.resumen());
}));

router.get('/', validar(listarQuerySchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await productos.listar(req.query));
}));

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await productos.obtener(req.params.id));
}));

router.post('/', exigirRol('PROPIETARIO'), validar(crearProductoSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await productos.crear(req.body));
}));

router.patch(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  validar(actualizarProductoSchema),
  asyncHandler(async (req, res) => {
    res.json(await productos.actualizar(req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  exigirRol('PROPIETARIO'),
  validar(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await productos.desactivar(req.params.id));
  }),
);

export default router;
