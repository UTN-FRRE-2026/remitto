import { Router } from 'express';
import { autenticarIntegracion } from '../../middlewares/integracion.js';

// API para sistemas externos (punto de venta), autenticada con clave de
// integración en lugar de la sesión de usuario. HU22 agrega acá
// POST /salidas, que reutiliza autenticarIntegracion.
const router = Router();

router.use(autenticarIntegracion);

// Permite a quien programa la caja comprobar que su clave es válida.
// Cuenta como uso de la clave.
router.get('/estado', (req, res) => {
  const { nombre, prefijo } = req.claveIntegracion;
  res.json({ ok: true, clave: { nombre, prefijo } });
});

export default router;
