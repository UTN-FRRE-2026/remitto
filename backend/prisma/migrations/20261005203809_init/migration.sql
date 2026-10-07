-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('PROPIETARIO', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'MILILITRO', 'METRO', 'PAQUETE');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('REMITO', 'FACTURA', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenArchivo" AS ENUM ('FOTO', 'PDF');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'CONFIRMADO', 'ERROR', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoDetalle" AS ENUM ('PROPUESTO', 'CONFIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MotivoMovimiento" AS ENUM ('COMPRA', 'VENTA', 'CONSUMO_INTERNO', 'ROTURA', 'VENCIMIENTO', 'RECUENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenSalida" AS ENUM ('CARRITO', 'INTEGRACION');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('STOCK_BAJO', 'SIN_STOCK', 'STOCK_NEGATIVO');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ACTIVA', 'RESUELTA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claves_integracion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "hash_clave" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_por_id" INTEGER NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMP(3),
    "revocada_en" TIMESTAMP(3),

    CONSTRAINT "claves_integracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "codigo_barras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria_id" INTEGER,
    "unidad_medida" "UnidadMedida" NOT NULL DEFAULT 'UNIDAD',
    "stock_actual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_deseado" DECIMAL(12,3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "razon_social" TEXT NOT NULL,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "contacto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_proveedor" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "veces_confirmado" INTEGER NOT NULL DEFAULT 1,
    "ultima_vez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "tipo" "TipoComprobante" NOT NULL DEFAULT 'REMITO',
    "numero" TEXT,
    "fecha_emision" DATE,
    "total_declarado" DECIMAL(14,2),
    "archivo_url" TEXT NOT NULL,
    "archivo_mime" TEXT NOT NULL,
    "origen_archivo" "OrigenArchivo" NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "requiere_revision" BOOLEAN NOT NULL DEFAULT false,
    "respuesta_ia" JSONB,
    "modelo_ia" TEXT,
    "error_procesamiento" TEXT,
    "cargado_por_id" INTEGER NOT NULL,
    "confirmado_por_id" INTEGER,
    "cargado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmado_en" TIMESTAMP(3),

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_comprobante" (
    "id" SERIAL NOT NULL,
    "comprobante_id" INTEGER NOT NULL,
    "nro_linea" INTEGER NOT NULL,
    "agregada_manualmente" BOOLEAN NOT NULL DEFAULT false,
    "codigo_extraido" TEXT,
    "descripcion_extraida" TEXT,
    "cantidad_extraida" DECIMAL(12,3),
    "precio_unitario_extraido" DECIMAL(12,2),
    "producto_id" INTEGER,
    "confianza" DECIMAL(4,3),
    "cantidad" DECIMAL(12,3),
    "precio_unitario" DECIMAL(12,2),
    "estado" "EstadoDetalle" NOT NULL DEFAULT 'PROPUESTO',

    CONSTRAINT "detalles_comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salidas" (
    "id" SERIAL NOT NULL,
    "origen" "OrigenSalida" NOT NULL,
    "motivo" "MotivoMovimiento" NOT NULL DEFAULT 'VENTA',
    "observacion" TEXT,
    "usuario_id" INTEGER,
    "clave_integracion_id" INTEGER,
    "referencia_externa" TEXT,
    "fecha_externa" TIMESTAMP(3),
    "registrada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "motivo" "MotivoMovimiento" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "stock_anterior" DECIMAL(12,3) NOT NULL,
    "observacion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER,
    "detalle_comprobante_id" INTEGER,
    "salida_id" INTEGER,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_compra" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "fecha_vigencia" DATE NOT NULL,
    "detalle_comprobante_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precios_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_stock" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ACTIVA',
    "stock_al_generar" DECIMAL(12,3) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_en" TIMESTAMP(3),

    CONSTRAINT "alertas_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas_agente" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT,
    "herramientas" JSONB,
    "exitosa" BOOLEAN NOT NULL DEFAULT true,
    "duracion_ms" INTEGER,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_agente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "claves_integracion_prefijo_key" ON "claves_integracion"("prefijo");

-- CreateIndex
CREATE UNIQUE INDEX "claves_integracion_hash_clave_key" ON "claves_integracion"("hash_clave");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_barras_key" ON "productos"("codigo_barras");

-- CreateIndex
CREATE INDEX "productos_nombre_idx" ON "productos"("nombre");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_cuit_key" ON "proveedores"("cuit");

-- CreateIndex
CREATE INDEX "codigos_proveedor_producto_id_idx" ON "codigos_proveedor"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_proveedor_proveedor_id_codigo_key" ON "codigos_proveedor"("proveedor_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_proveedor_proveedor_id_descripcion_key" ON "codigos_proveedor"("proveedor_id", "descripcion");

-- CreateIndex
CREATE INDEX "comprobantes_estado_idx" ON "comprobantes"("estado");

-- CreateIndex
CREATE INDEX "comprobantes_cargado_en_idx" ON "comprobantes"("cargado_en");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_proveedor_id_tipo_numero_key" ON "comprobantes"("proveedor_id", "tipo", "numero");

-- CreateIndex
CREATE INDEX "detalles_comprobante_producto_id_idx" ON "detalles_comprobante"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "detalles_comprobante_comprobante_id_nro_linea_key" ON "detalles_comprobante"("comprobante_id", "nro_linea");

-- CreateIndex
CREATE INDEX "salidas_registrada_en_idx" ON "salidas"("registrada_en");

-- CreateIndex
CREATE INDEX "salidas_origen_registrada_en_idx" ON "salidas"("origen", "registrada_en");

-- CreateIndex
CREATE UNIQUE INDEX "salidas_clave_integracion_id_referencia_externa_key" ON "salidas"("clave_integracion_id", "referencia_externa");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_stock_detalle_comprobante_id_key" ON "movimientos_stock"("detalle_comprobante_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_producto_id_fecha_idx" ON "movimientos_stock"("producto_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_stock_tipo_fecha_idx" ON "movimientos_stock"("tipo", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_stock_salida_id_producto_id_key" ON "movimientos_stock"("salida_id", "producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "precios_compra_detalle_comprobante_id_key" ON "precios_compra"("detalle_comprobante_id");

-- CreateIndex
CREATE INDEX "precios_compra_producto_id_proveedor_id_fecha_vigencia_idx" ON "precios_compra"("producto_id", "proveedor_id", "fecha_vigencia" DESC);

-- CreateIndex
CREATE INDEX "alertas_stock_estado_producto_id_idx" ON "alertas_stock"("estado", "producto_id");

-- CreateIndex
CREATE INDEX "consultas_agente_creada_en_idx" ON "consultas_agente"("creada_en");

-- AddForeignKey
ALTER TABLE "claves_integracion" ADD CONSTRAINT "claves_integracion_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_proveedor" ADD CONSTRAINT "codigos_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_proveedor" ADD CONSTRAINT "codigos_proveedor_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_cargado_por_id_fkey" FOREIGN KEY ("cargado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_confirmado_por_id_fkey" FOREIGN KEY ("confirmado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobante" ADD CONSTRAINT "detalles_comprobante_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comprobante" ADD CONSTRAINT "detalles_comprobante_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas" ADD CONSTRAINT "salidas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salidas" ADD CONSTRAINT "salidas_clave_integracion_id_fkey" FOREIGN KEY ("clave_integracion_id") REFERENCES "claves_integracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_detalle_comprobante_id_fkey" FOREIGN KEY ("detalle_comprobante_id") REFERENCES "detalles_comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_salida_id_fkey" FOREIGN KEY ("salida_id") REFERENCES "salidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_compra" ADD CONSTRAINT "precios_compra_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_compra" ADD CONSTRAINT "precios_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_compra" ADD CONSTRAINT "precios_compra_detalle_comprobante_id_fkey" FOREIGN KEY ("detalle_comprobante_id") REFERENCES "detalles_comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_stock" ADD CONSTRAINT "alertas_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_agente" ADD CONSTRAINT "consultas_agente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================
--  RESTRICCIONES DE NEGOCIO (RNF5)
--  Reglas que Prisma no expresa en el schema. Ver notas del
--  modelo de datos (remitto_schema_prisma).
-- =============================================================

-- Signo de la cantidad según el tipo de movimiento
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "chk_signo_cantidad" CHECK (
  ("tipo" = 'ENTRADA' AND "cantidad" > 0) OR
  ("tipo" = 'SALIDA'  AND "cantidad" < 0) OR
  ("tipo" = 'AJUSTE'  AND "cantidad" <> 0)
);

-- Toda salida pertenece a una cabecera Salida
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "chk_salida_con_cabecera" CHECK (
  ("tipo" = 'SALIDA') = ("salida_id" IS NOT NULL)
);

-- Origen de la salida coherente con quién la registró
ALTER TABLE "salidas" ADD CONSTRAINT "chk_origen_salida" CHECK (
  ("origen" = 'CARRITO'     AND "usuario_id" IS NOT NULL AND "clave_integracion_id" IS NULL) OR
  ("origen" = 'INTEGRACION' AND "usuario_id" IS NULL AND "clave_integracion_id" IS NOT NULL
                            AND "referencia_externa" IS NOT NULL)
);

-- Motivos válidos para una salida
ALTER TABLE "salidas" ADD CONSTRAINT "chk_motivo_salida" CHECK (
  "motivo" IN ('VENTA', 'CONSUMO_INTERNO', 'ROTURA', 'VENCIMIENTO', 'OTRO')
);

-- Confianza de la IA entre 0 y 1
ALTER TABLE "detalles_comprobante" ADD CONSTRAINT "chk_confianza" CHECK (
  "confianza" IS NULL OR ("confianza" >= 0 AND "confianza" <= 1)
);

-- Una sola alerta activa por producto y tipo
CREATE UNIQUE INDEX "uq_alerta_activa" ON "alertas_stock" ("producto_id", "tipo")
  WHERE "estado" = 'ACTIVA';
