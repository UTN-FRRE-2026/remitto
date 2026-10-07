# Documentación — Remitto

Documentación técnica del proyecto.

- `der-remitto.svg` — diagrama entidad-relación generado por Prisma
  (habilitar el `generator erd` en `backend/prisma/schema.prisma` y correr
  `npx prisma generate`; requiere `npm i -D prisma-erd-generator @mermaid-js/mermaid-cli`).
- `openapi.yaml` — contrato del endpoint de integración con el punto de venta
  (RF5.2, se agrega en el Sprint 2).
- Manual de usuario (etapa de cierre).

El modelo de datos de referencia (13 tablas) está en
`backend/prisma/schema.prisma`.
