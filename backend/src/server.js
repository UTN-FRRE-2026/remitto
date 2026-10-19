import { crearApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { iniciarProcesamiento, detenerProcesamiento } from './modules/comprobantes/comprobantes.procesamiento.js';

const app = crearApp();

const server = app.listen(env.port, () => {
  console.log(`🧾 Remitto API escuchando en http://localhost:${env.port}/api`);
  // HU9: latido de los trabajos propios y recuperación de lecturas abandonadas.
  iniciarProcesamiento();
});

// Cierre ordenado: libera la conexión a la base.
async function apagar(signal) {
  console.log(`\n${signal} recibido, cerrando...`);
  await detenerProcesamiento().catch((err) => console.error('[IA]', err.message));
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
