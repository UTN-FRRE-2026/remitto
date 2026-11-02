// =============================================================
//  Concilia el stock con los movimientos (HU11 / criterio de HU12).
//  Las bases cargadas con el seed anterior tienen stock_actual sin
//  ningún MovimientoStock. Este script registra, por cada producto
//  descuadrado, un AJUSTE / RECUENTO por la diferencia, de modo que
//  stock_actual = SUMA(movimientos). El stock_actual NO cambia.
//
//  Uso:
//    npm run conciliar-stock                muestra los productos descuadrados
//    npm run conciliar-stock -- --aplicar   registra los ajustes
//
//  Repetirlo no duplica ajustes: si ya está conciliado, no hay nada que hacer.
// =============================================================
import { PrismaClient, Prisma } from '@prisma/client';
import { productosDescuadrados } from '../src/modules/stock/stock.service.js';

const prisma = new PrismaClient();
const OBSERVACION = 'Conciliación de stock inicial';

function mostrar(filas) {
  for (const p of filas) {
    const diferencia = new Prisma.Decimal(p.stockActual).minus(p.sumaMovimientos);
    console.log(`  #${p.id}  ${p.nombre}: stock=${p.stockActual} movimientos=${p.sumaMovimientos} → ajuste ${diferencia}`);
  }
}

async function main() {
  const aplicar = process.argv.slice(2).includes('--aplicar');

  const descuadrados = await productosDescuadrados(prisma);
  if (descuadrados.length === 0) {
    console.log('✅ El stock de todos los productos coincide con la suma de sus movimientos.');
    return;
  }
  console.log(`Productos descuadrados: ${descuadrados.length}`);
  mostrar(descuadrados);
  if (!aplicar) {
    console.log('\nPara registrar los ajustes: npm run conciliar-stock -- --aplicar');
    return;
  }

  // Todo o nada. Se vuelve a calcular dentro de la transacción, con cada
  // producto bloqueado, por si otro proceso movió el stock mientras tanto.
  const registrados = await prisma.$transaction(async (tx) => {
    const propietario = await tx.usuario.findFirst({
      where: { rol: 'PROPIETARIO', activo: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    let total = 0;
    for (const { id } of descuadrados) {
      const [p] = await tx.$queryRaw`SELECT stock_actual FROM productos WHERE id = ${id} FOR UPDATE`;
      const suma = await tx.movimientoStock.aggregate({ where: { productoId: id }, _sum: { cantidad: true } });
      const sumaMovimientos = new Prisma.Decimal(suma._sum.cantidad ?? 0);
      const diferencia = new Prisma.Decimal(p.stock_actual).minus(sumaMovimientos);
      if (diferencia.isZero()) continue;
      // stockAnterior es el stock que "explican" los movimientos previos;
      // stockAnterior + cantidad = stock_actual, que queda igual.
      await tx.movimientoStock.create({
        data: {
          productoId: id,
          tipo: 'AJUSTE',
          motivo: 'RECUENTO',
          cantidad: diferencia,
          stockAnterior: sumaMovimientos,
          observacion: OBSERVACION,
          usuarioId: propietario?.id ?? null,
        },
      });
      total += 1;
    }
    return total;
  });

  const restantes = await productosDescuadrados(prisma);
  console.log(`\n✅ ${registrados} ajuste(s) registrado(s). Productos descuadrados ahora: ${restantes.length}.`);
  if (restantes.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('❌ Error al conciliar:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
