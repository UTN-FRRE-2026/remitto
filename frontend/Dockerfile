# =============================================================
#  Frontend Remitto – imagen de producción.
#  1) Compila la PWA con Vite.
#  2) La sirve con nginx, que además reenvía /api al backend
#     (en desarrollo eso lo hace el proxy de vite.config.js).
#  En desarrollo se sigue usando `npm run dev` fuera de Docker.
# =============================================================
FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27.5-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
