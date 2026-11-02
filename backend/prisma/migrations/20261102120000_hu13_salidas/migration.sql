-- HU13: salidas de stock desde el carrito.

-- Un reintento del mismo carrito (mismo id de operación generado por la app)
-- no descuenta dos veces. Las salidas de integración ya son únicas por
-- (clave_integracion_id, referencia_externa); en el carrito esa clave es nula,
-- por eso la unicidad es por usuario.
CREATE UNIQUE INDEX "uq_salida_carrito_operacion" ON "salidas" ("usuario_id", "referencia_externa")
  WHERE "origen" = 'CARRITO' AND "referencia_externa" IS NOT NULL;
