-- HU17: en un comprobante manuscrito o de baja calidad, cada línea se marca
-- como revisada antes de poder confirmar el ingreso. Las líneas existentes
-- quedan sin revisar; las agregadas a mano se crean revisadas.
ALTER TABLE "detalles_comprobante" ADD COLUMN "revisada" BOOLEAN NOT NULL DEFAULT false;
