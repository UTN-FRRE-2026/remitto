-- HU21: se normalizan las filas existentes antes de agregar la restricción,
-- para conservar los datos (una clave inactiva sin fecha toma la de creación).
UPDATE "claves_integracion" SET "revocada_en" = COALESCE("revocada_en", "creada_en") WHERE NOT "activa";
UPDATE "claves_integracion" SET "activa" = false WHERE "activa" AND "revocada_en" IS NOT NULL;

-- Una clave activa no tiene fecha de revocación y una revocada sí.
ALTER TABLE "claves_integracion" ADD CONSTRAINT "chk_clave_revocada" CHECK (
  ("activa" AND "revocada_en" IS NULL) OR (NOT "activa" AND "revocada_en" IS NOT NULL)
);
