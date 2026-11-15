-- HU24: abre las alertas del stock que ya estaba bajo, en cero o negativo antes
-- de activar el observador de movimientos. Mismas reglas que tipoAlerta() en
-- src/modules/alertas/alertas.service.js. No cambia el esquema: la tabla
-- alertas_stock y el índice parcial uq_alerta_activa existen desde init.
INSERT INTO "alertas_stock" ("producto_id", "tipo", "stock_al_generar")
SELECT p."id",
       CASE
         WHEN p."stock_actual" < 0 THEN 'STOCK_NEGATIVO'::"TipoAlerta"
         WHEN p."stock_actual" = 0 THEN 'SIN_STOCK'::"TipoAlerta"
         ELSE 'STOCK_BAJO'::"TipoAlerta"
       END,
       p."stock_actual"
FROM "productos" p
WHERE p."activo"
  AND (p."stock_actual" <= 0 OR (p."stock_minimo" > 0 AND p."stock_actual" <= p."stock_minimo"))
  AND NOT EXISTS (
    SELECT 1 FROM "alertas_stock" a WHERE a."producto_id" = p."id" AND a."estado" = 'ACTIVA'
  );
