import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar } from '../../middlewares/auth.js';
import { loginSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  validar(loginSchema),
  asyncHandler(async (req, res) => {
    const resultado = await authService.login(req.body);
    res.json(resultado);
  }),
);

// GET /api/auth/me – perfil del usuario autenticado
router.get(
  '/me',
  autenticar,
  asyncHandler(async (req, res) => {
    const usuario = await authService.perfil(req.usuario.id);
    res.json(usuario);
  }),
);

export default router;
