// =============================================================
//  Semilla de datos de Remitto
//  Reproduce el comercio de ejemplo de la maqueta ("Almacén Don Carlos").
//  Ejecutar:  npm run seed   (o  npx prisma migrate reset  que la corre sola)
// =============================================================
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos de ejemplo...');

  // --- Usuarios (RF1) ---
  const passwordHash = await bcrypt.hash('remitto123', 10);

  const propietario = await prisma.usuario.upsert({
    where: { email: 'carlos@doncarlos.com.ar' },
    update: {},
    create: {
      nombre: 'Carlos Gómez',
      email: 'carlos@doncarlos.com.ar',
      passwordHash,
      rol: 'PROPIETARIO',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'empleado@doncarlos.com.ar' },
    update: {},
    create: {
      nombre: 'Ana Pérez',
      email: 'empleado@doncarlos.com.ar',
      passwordHash,
      rol: 'EMPLEADO',
    },
  });

  // --- Categorías (RF2.2) ---
  const nombresCategorias = ['Bebidas', 'Golosinas', 'Almacén', 'Snacks', 'Lácteos', 'Galletitas'];
  const categorias = {};
  for (const nombre of nombresCategorias) {
    const cat = await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    categorias[nombre] = cat.id;
  }

  // --- Proveedores (RF2.3) ---
  const proveedores = [
    { razonSocial: 'Distribuidora Norte S.R.L.', cuit: '30712345678', contacto: 'Mesa de pedidos', direccion: 'Av. Sarmiento 1450, Resistencia' },
    { razonSocial: 'Mayorista Chaco', cuit: '30598765432', contacto: 'Ventas' },
    { razonSocial: 'Mayorista del Sur', cuit: '30611223344' },
    { razonSocial: 'Lácteos del Litoral', cuit: '30655667788' },
  ];
  for (const p of proveedores) {
    const existente = await prisma.proveedor.findUnique({ where: { cuit: p.cuit } });
    if (!existente) await prisma.proveedor.create({ data: p });
  }

  // --- Productos (RF2.1) con el stock de la maqueta ---
  const productos = [
    { nombre: 'Gaseosa cola 500 ml', categoria: 'Bebidas', stockActual: 58, stockMinimo: 24, stockDeseado: 72, codigoBarras: '7790001000012' },
    { nombre: 'Alfajor triple chocolate', categoria: 'Golosinas', stockActual: 5, stockMinimo: 10, stockDeseado: 30 },
    { nombre: 'Yerba mate con palo 1 kg', categoria: 'Almacén', stockActual: 0, stockMinimo: 8, stockDeseado: 24, codigoBarras: '7790001000029' },
    { nombre: 'Papas fritas clásicas 80 g', categoria: 'Snacks', stockActual: 18, stockMinimo: 12, stockDeseado: 36 },
    { nombre: 'Leche entera 1 l', categoria: 'Lácteos', stockActual: 3, stockMinimo: 12, stockDeseado: 36 },
    { nombre: 'Galletitas rellenas chocolate 118 g', categoria: 'Galletitas', stockActual: 42, stockMinimo: 15, stockDeseado: 48 },
    { nombre: 'Agua sin gas 1,5 l', categoria: 'Bebidas', stockActual: 27, stockMinimo: 18, stockDeseado: 48 },
    { nombre: 'Aceite de girasol 900 ml', categoria: 'Almacén', stockActual: 2, stockMinimo: 6, stockDeseado: 18 },
    { nombre: 'Pan lactal grande', categoria: 'Almacén', stockActual: 0, stockMinimo: 6, stockDeseado: 18 },
  ];

  for (const prod of productos) {
    const { categoria, ...resto } = prod;
    const yaExiste = await prisma.producto.findFirst({ where: { nombre: resto.nombre } });
    if (!yaExiste) {
      await prisma.producto.create({
        data: { ...resto, categoriaId: categorias[categoria] },
      });
    }
  }

  console.log('✅ Listo. Usuario propietario: carlos@doncarlos.com.ar / remitto123');
  console.log(`   (${propietario.nombre}, Almacén Don Carlos)`);
}

main()
  .catch((e) => {
    console.error('❌ Error al sembrar:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
