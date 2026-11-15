-- HU10: descuentos generales e impuestos del comprobante.
-- En una factura con IVA discriminado o con una bonificación sobre el
-- subtotal, el total no es la suma de las líneas: es
-- suma − descuento + impuestos. Los comprobantes existentes quedan en NULL
-- (sin descuentos ni impuestos cargados), como hasta ahora.
ALTER TABLE "comprobantes"
  ADD COLUMN "descuento_declarado" DECIMAL(14,2),
  ADD COLUMN "impuestos_declarados" DECIMAL(14,2);

-- Los dos importes se guardan en positivo: el descuento resta y los impuestos suman.
ALTER TABLE "comprobantes" ADD CONSTRAINT "chk_comprobante_descuento_impuestos" CHECK ((descuento_declarado IS NULL OR descuento_declarado >= 0) AND (impuestos_declarados IS NULL OR impuestos_declarados >= 0));
