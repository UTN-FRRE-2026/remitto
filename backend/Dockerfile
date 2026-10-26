# =============================================================
#  Backend Remitto – imagen para ejecutar la API en contenedor.
#  En desarrollo se sigue usando `npm run dev` fuera de Docker.
#  Los comprobantes subidos viven en /app/uploads, que se monta
#  como volumen (ver docker-compose.yml) para que persistan.
# =============================================================
FROM node:24.15.0-bookworm-slim

# Prisma necesita OpenSSL para detectar y usar su motor de consultas.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
# Se instalan también las devDependencies: el CLI de Prisma genera el
# cliente y permite aplicar migraciones (`prisma migrate deploy`).
RUN npm ci --no-audit --no-fund && node_modules/.bin/prisma generate

COPY src ./src

RUN mkdir -p uploads && chown -R node:node uploads
USER node

ENV PORT=4000 UPLOADS_DIR=/app/uploads
EXPOSE 4000
# Aplica las migraciones pendientes antes de levantar la API (no borra datos
# ni corre el seed). `exec` deja a node como proceso principal para que
# reciba SIGTERM y haga el cierre ordenado de server.js.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node src/server.js"]
