import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar } from '../../middlewares/auth.js';
import { crearComprobanteSchema, idParamSchema } from './comprobantes.schema.js';
import { recibirArchivo } from './comprobantes.upload.js';
import * as comprobantes from './comprobantes.service.js';

const router = Router();

// La autenticación va antes de leer el multipart: sin sesión no se recibe nada.
router.use(autenticar);

// HU8: carga de la foto o PDF de un comprobante (queda PENDIENTE).
router.post(
  '/',
  recibirArchivo,
  validar(crearComprobanteSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await comprobantes.crear(req.body, req.file, req.usuario.id));
  }),
);

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await comprobantes.obtener(req.params.id));
}));

// Archivo original, solo con sesión (RNF1): uploads no se publica como estático.
router.get('/:id/archivo', validar(idParamSchema, 'params'), asyncHandler(async (req, res, next) => {
  const { ruta, mime, nombre } = await comprobantes.archivo(req.params.id);
  res.set({
    'Content-Type': mime,
    'Content-Disposition': `inline; filename="${nombre}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(ruta, (err) => {
    if (err && !res.headersSent) next(err);
  });
}));

export default router;
