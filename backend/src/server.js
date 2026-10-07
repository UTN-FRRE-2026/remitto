import { crearApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const app = crearApp();

const server = app.listen(env.port, () => {
  console.log(`🧾 Remitto API escuchando en http://localhost:${env.port}/api`);
});

// Cierre ordenado: libera la conexión a la base.
async function apagar(signal) {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
