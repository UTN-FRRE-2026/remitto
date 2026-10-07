import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import categoriasRoutes from './modules/categorias/categorias.routes.js';
import proveedoresRoutes from './modules/proveedores/proveedores.routes.js';
import productosRoutes from './modules/productos/productos.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, servicio: 'remitto-api' }));

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/categorias', categoriasRoutes);
router.use('/proveedores', proveedoresRoutes);
router.use('/productos', productosRoutes);

export default router;
