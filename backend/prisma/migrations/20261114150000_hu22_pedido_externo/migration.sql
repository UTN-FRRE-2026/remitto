-- HU22: petición original de cada venta informada por un sistema externo,
-- normalizada (líneas con su identificador original, productoId o
-- codigoBarras, y cantidades sumadas). Permite reconocer un reenvío aunque
-- el catálogo haya cambiado después de la venta.
ALTER TABLE "salidas" ADD COLUMN "pedido_externo" JSONB;

-- Las ventas de integración guardan su petición; las del carrito no.
ALTER TABLE "salidas" ADD CONSTRAINT "chk_pedido_externo" CHECK (
  ("origen" = 'INTEGRACION') = ("pedido_externo" IS NOT NULL)
) NOT VALID;

-- Si hubiera ventas de integración anteriores a esta migración, no se les
-- inventa una petición: se conservan tal cual y la restricción queda sin
-- validar para esas filas (rige para las nuevas). Si no hay, se valida.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "salidas" WHERE "origen" = 'INTEGRACION' AND "pedido_externo" IS NULL) THEN
    ALTER TABLE "salidas" VALIDATE CONSTRAINT "chk_pedido_externo";
  ELSE
    RAISE NOTICE 'Hay ventas de integración sin petición original: chk_pedido_externo queda sin validar para ellas.';
  END IF;
END $$;
