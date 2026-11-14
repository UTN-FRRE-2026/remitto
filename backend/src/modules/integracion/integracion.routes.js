import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validar } from '../../middlewares/validar.js';
import { autenticarIntegracion } from '../../middlewares/integracion.js';
import { ventaSchema } from './integracion.schema.js';
import { registrarVenta } from './integracion.service.js';

// API para sistemas externos (punto de venta), autenticada con clave de
// integración (HU21) en lugar de la sesión de una persona.
const router = Router();

// Contrato OpenAPI (HU22): público, para quien programa la caja.
const contrato = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));
router.get('/openapi.json', (req, res) => res.json(contrato));

router.use(autenticarIntegracion);

// Permite a quien programa la caja comprobar que su clave es válida.
// Cuenta como uso de la clave.
router.get('/estado', (req, res) => {
  const { nombre, prefijo } = req.claveIntegracion;
  res.json({ ok: true, clave: { nombre, prefijo } });
});

// HU22: informa una venta. 201 la primera vez; 200 con "repetida": true si se
// reenvía la misma referencia con el mismo contenido (no descuenta de nuevo);
// 409 si la referencia ya se usó con otro contenido.
router.post('/salidas', validar(ventaSchema), asyncHandler(async (req, res) => {
  const { venta, repetida } = await registrarVenta(req.claveIntegracion, req.body);
  res.status(repetida ? 200 : 201).json({ ...venta, repetida });
}));

export default router;
