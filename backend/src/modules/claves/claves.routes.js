import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { crearClaveSchema, idParamSchema } from './claves.schema.js';
import * as claves from './claves.service.js';

const router = Router();

// HU21: solo el propietario administra las claves de integración.
router.use(autenticar, exigirRol('PROPIETARIO'));

// Listado con prefijo y fechas; nunca la clave completa ni su hash.
router.get('/', asyncHandler(async (req, res) => {
  res.json(await claves.listar());
}));

// 201 con la clave completa en "clave": se muestra esta única vez.
router.post('/', validar(crearClaveSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await claves.crear(req.body, req.usuario.id));
}));

// Revoca (no borra). Desde ese momento la clave se rechaza.
router.delete('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await claves.revocar(req.params.id));
}));

export default router;
