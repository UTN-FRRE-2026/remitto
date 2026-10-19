-- AlterTable
ALTER TABLE "comprobantes" ADD COLUMN     "ia_intentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ia_solicitado_en" TIMESTAMP(3),
ADD COLUMN     "ia_trabajo_id" TEXT,
ADD COLUMN     "ia_vigente_hasta" TIMESTAMP(3),
ADD COLUMN     "procesando_desde" TIMESTAMP(3);

-- =============================================================
--  Restricciones de negocio (RNF5) – HU9
-- =============================================================

-- Las llamadas a la IA nunca son negativas
ALTER TABLE "comprobantes" ADD CONSTRAINT "chk_ia_intentos" CHECK ("ia_intentos" >= 0);

-- Un comprobante en PROCESANDO siempre tiene dueño, vigencia y hora de solicitud
ALTER TABLE "comprobantes" ADD CONSTRAINT "chk_procesando_con_trabajo" CHECK (
  "estado" <> 'PROCESANDO'
  OR ("ia_trabajo_id" IS NOT NULL AND "ia_vigente_hasta" IS NOT NULL AND "ia_solicitado_en" IS NOT NULL)
);
