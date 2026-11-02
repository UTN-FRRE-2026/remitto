-- HU11: confirmación del ingreso. Solo agrega restricciones (RNF5); no
-- modifica datos. Se aplica sola al desplegar (prisma migrate deploy).

-- Una línea confirmada siempre tiene producto y una cantidad positiva.
ALTER TABLE "detalles_comprobante" ADD CONSTRAINT "chk_detalle_confirmado" CHECK (
  "estado" <> 'CONFIRMADO' OR ("producto_id" IS NOT NULL AND "cantidad" > 0)
);

-- El precio unitario confirmado nunca es negativo.
ALTER TABLE "detalles_comprobante" ADD CONSTRAINT "chk_detalle_precio" CHECK (
  "precio_unitario" IS NULL OR "precio_unitario" >= 0
);

-- Un comprobante confirmado registra quién y cuándo, y tiene número.
ALTER TABLE "comprobantes" ADD CONSTRAINT "chk_comprobante_confirmado" CHECK (
  "estado" <> 'CONFIRMADO' OR (
    "confirmado_por_id" IS NOT NULL AND "confirmado_en" IS NOT NULL AND "numero" IS NOT NULL
  )
);
