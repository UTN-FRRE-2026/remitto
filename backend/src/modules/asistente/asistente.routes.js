import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar, exigirRol } from '../../middlewares/auth.js';
import { consultaSchema, eleccionSchema, idParamSchema, historialSchema } from './asistente.schema.js';
import * as asistente from './asistente.service.js';

const router = Router();

// HU25: el asistente es solo del propietario (las respuestas incluyen costos).
router.use(autenticar, exigirRol('PROPIETARIO'));

const responder = (res, { estadoHttp, ...cuerpo }) => res.status(estadoHttp).json(cuerpo);

router.post('/consultas', validar(consultaSchema), asyncHandler(async (req, res) => {
  responder(res, await asistente.consultar({ pregunta: req.body.pregunta, usuario: req.usuario }));
}));

router.post(
  '/consultas/:id/eleccion',
  validar(idParamSchema, 'params'),
  validar(eleccionSchema),
  asyncHandler(async (req, res) => {
    responder(res, await asistente.elegir({ consultaId: req.params.id, productoId: req.body.productoId, usuario: req.usuario }));
  }),
);

router.get('/consultas', validar(historialSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await asistente.historial(req.query));
}));

export default router;
