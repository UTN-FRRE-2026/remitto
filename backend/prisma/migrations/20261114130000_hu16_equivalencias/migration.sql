-- HU16: equivalencias por proveedor con dos tipos de fila. La descripción es
-- única solo en las filas por descripción (codigo nulo); en las filas por
-- código se repite, porque dos códigos pueden imprimirse con la misma
-- descripción. Las filas existentes no se modifican.
DROP INDEX "codigos_proveedor_proveedor_id_descripcion_key";
CREATE INDEX "codigos_proveedor_proveedor_id_descripcion_idx" ON "codigos_proveedor"("proveedor_id", "descripcion");

-- Una descripción de un proveedor tiene una sola fila por descripción.
CREATE UNIQUE INDEX "uq_codigo_proveedor_descripcion" ON "codigos_proveedor" ("proveedor_id", "descripcion")
  WHERE "codigo" IS NULL;
