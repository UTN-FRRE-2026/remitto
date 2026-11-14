import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticar } from '../../middlewares/auth.js';
import {
  crearComprobanteSchema,
  idParamSchema,
  detalleParamSchema,
  actualizarDetalleSchema,
  agregarDetalleSchema,
  actualizarCabeceraSchema,
  listarComprobantesSchema,
} from './comprobantes.schema.js';
import * as listado from './comprobantes.listado.js';
import * as precision from './comprobantes.precision.js';
import * as revision from './comprobantes.revision.js';
import { recibirArchivo } from './comprobantes.upload.js';
import * as comprobantes from './comprobantes.service.js';
import * as procesamiento from './comprobantes.procesamiento.js';

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

// HU18: comprobantes cargados, con filtros por proveedor, estado, fecha y número.
router.get('/', validar(listarComprobantesSchema, 'query'), asyncHandler(async (req, res) => {
  res.json(await listado.listar(req.query));
}));

// HU19: precisión de la lectura con IA (general y por comprobante confirmado).
// Va antes de /:id para que «precision» no se tome como un id.
router.get('/precision', asyncHandler(async (req, res) => {
  res.json(await precision.precision());
}));

router.get('/:id', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await comprobantes.obtener(req.params.id));
}));

// HU9: pide la lectura con IA. Responde 202 enseguida; el progreso se
// consulta en GET /:id/estado. Solo desde PENDIENTE o ERROR, con intentos.
router.post('/:id/procesar', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  await procesamiento.solicitar(req.params.id);
  res.status(202).json(await comprobantes.estadoProcesamiento(req.params.id));
}));

router.get('/:id/estado', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await comprobantes.estadoProcesamiento(req.params.id));
}));

// HU10: revisión (propietario y empleado). Guarda borradores; la
// confirmación del ingreso es POST /:id/confirmar (HU11).
router.patch(
  '/:id/cabecera',
  validar(idParamSchema, 'params'),
  validar(actualizarCabeceraSchema),
  asyncHandler(async (req, res) => {
    res.json(await revision.actualizarCabecera(req.params.id, req.body));
  }),
);

router.patch(
  '/:id/detalles/:detalleId',
  validar(detalleParamSchema, 'params'),
  validar(actualizarDetalleSchema),
  asyncHandler(async (req, res) => {
    const detalle = await revision.actualizarDetalle(req.params.id, req.params.detalleId, req.body);
    res.json(await comprobantes.anotarDetalle(req.params.id, detalle));
  }),
);

router.post(
  '/:id/detalles',
  validar(idParamSchema, 'params'),
  validar(agregarDetalleSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await revision.agregarDetalle(req.params.id, req.body));
  }),
);

// Solo evalúa si los datos están completos: no confirma ni toca el stock.
router.post('/:id/validar', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await comprobantes.validarRevision(req.params.id));
}));

// HU11: confirma el ingreso (propietario y empleado). Una sola transacción:
// CONFIRMADO, movimientos de entrada y precios de compra. Repetirlo da 409.
router.post('/:id/confirmar', validar(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await revision.confirmar(req.params.id, req.usuario.id));
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
