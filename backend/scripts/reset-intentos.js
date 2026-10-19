// =============================================================
//  Resetea los intentos de lectura con IA de comprobantes.
//  Deja el comprobante como recién subido (PENDIENTE, 0 intentos),
//  para poder volver a probar la lectura sin tocar la base a mano.
//
//  Uso:
//    npm run reset-intentos -- 2 3     resetea los comprobantes 2 y 3
//    npm run reset-intentos -- --all   resetea todos los que están en ERROR
//    npm run reset-intentos            muestra el estado actual y la ayuda
//
//  Por seguridad NO toca comprobantes ya EN_REVISION o CONFIRMADO
//  (eso descartaría una lectura buena). Usá --force para forzarlos igual.
// =============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Campos que dejan el comprobante listo para una lectura nueva.
const DATOS_RESET = {
  estado: 'PENDIENTE',
  iaIntentos: 0,
  errorProcesamiento: null,
  modeloIa: null,
  iaTrabajoId: null,
  iaSolicitadoEn: null,
  procesandoDesde: null,
  iaVigenteHasta: null,
};

const PROTEGIDOS = ['EN_REVISION', 'CONFIRMADO'];

async function listarEstado() {
  const todos = await prisma.comprobante.findMany({
    select: { id: true, estado: true, iaIntentos: true, errorProcesamiento: true },
    orderBy: { id: 'asc' },
  });
  if (todos.length === 0) {
    console.log('No hay comprobantes cargados.');
    return;
  }
  console.log('Comprobantes actuales:');
  for (const c of todos) {
    const err = c.errorProcesamiento ? `  ${c.errorProcesamiento}` : '';
    console.log(`  #${c.id}  ${c.estado.padEnd(12)} intentos=${c.iaIntentos}${err}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const resto = args.filter((a) => a !== '--force');

  if (resto.length === 0) {
    await listarEstado();
    console.log('\nUso: npm run reset-intentos -- <ids...> | --all  [--force]');
    return;
  }

  // Qué comprobantes tocar.
  let objetivos;
  if (resto.includes('--all')) {
    objetivos = await prisma.comprobante.findMany({
      where: { estado: 'ERROR' },
      select: { id: true, estado: true },
    });
    if (objetivos.length === 0) {
      console.log('No hay comprobantes en ERROR para resetear.');
      return;
    }
  } else {
    const ids = resto.map((a) => Number(a)).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      console.error('❌ Pasá IDs numéricos válidos, o --all. Ej: npm run reset-intentos -- 2 3');
      process.exitCode = 1;
      return;
    }
    objetivos = await prisma.comprobante.findMany({
      where: { id: { in: ids } },
      select: { id: true, estado: true },
    });
    const encontrados = new Set(objetivos.map((c) => c.id));
    for (const id of ids) if (!encontrados.has(id)) console.warn(`⚠️  No existe el comprobante #${id}, se omite.`);
  }

  // Protege lecturas ya buenas salvo --force.
  const aResetear = [];
  for (const c of objetivos) {
    if (PROTEGIDOS.includes(c.estado) && !force) {
      console.warn(`⚠️  #${c.id} está ${c.estado}; se omite (usá --force para resetearlo igual).`);
    } else {
      aResetear.push(c.id);
    }
  }

  if (aResetear.length === 0) {
    console.log('Nada para resetear.');
    return;
  }

  const { count } = await prisma.comprobante.updateMany({
    where: { id: { in: aResetear } },
    data: DATOS_RESET,
  });
  console.log(`✅ ${count} comprobante(s) reseteado(s) a PENDIENTE: ${aResetear.join(', ')}`);
  console.log('   Volvé a entrar a cada uno y usá "Leer con IA".');
}

main()
  .catch((e) => {
    console.error('❌ Error al resetear:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
