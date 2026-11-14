import { z } from 'zod';

// HU22 (RF5.2): venta informada por un sistema externo (punto de venta).
// El contrato público está en openapi.json, en esta misma carpeta.

export const MAX_LINEAS = 200;

// Como en el carrito: hasta 3 decimales (columnas Decimal(12,3)).
const conDecimales = (max) => (v) => Math.abs(v * 10 ** max - Math.round(v * 10 ** max)) < 1e-6;

const linea = z
  .object({
    productoId: z.number({ invalid_type_error: 'productoId debe ser un número entero' }).int().positive().optional(),
    codigoBarras: z
      .string({ invalid_type_error: 'codigoBarras debe ser un texto' })
      .trim()
      .min(1, 'codigoBarras está vacío')
      .max(64, 'codigoBarras admite hasta 64 caracteres')
      .optional(),
    cantidad: z
      .number({ invalid_type_error: 'La cantidad debe ser un número', required_error: 'Falta la cantidad' })
      .positive('La cantidad debe ser mayor a 0')
      .max(999999999, 'La cantidad es demasiado grande')
      .refine(conDecimales(3), 'La cantidad admite hasta 3 decimales'),
  })
  .strict()
  .superRefine((l, ctx) => {
    if ((l.productoId === undefined) === (l.codigoBarras === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['productoId'], message: 'Indicá productoId o codigoBarras (uno de los dos)' });
    }
  });

export const ventaSchema = z
  .object({
    // Identificador de la venta en el sistema externo (ticket, número de
    // operación). Es la clave de idempotencia junto con la clave de integración.
    referencia: z
      .string({ required_error: 'Falta la referencia de la venta', invalid_type_error: 'La referencia debe ser un texto' })
      .trim()
      .min(1, 'Falta la referencia de la venta')
      .max(100, 'La referencia admite hasta 100 caracteres')
      .regex(/^[\x20-\x7E -￿]+$/, 'La referencia tiene caracteres de control'),
    // Momento de la venta según el sistema externo (ISO 8601 con zona).
    fecha: z
      .string({ invalid_type_error: 'La fecha debe ser un texto ISO 8601' })
      .datetime({ offset: true, message: 'La fecha debe estar en formato ISO 8601 con zona horaria' })
      .transform((f) => new Date(f))
      .optional(),
    lineas: z
      .array(linea, { required_error: 'Faltan las líneas de la venta', invalid_type_error: 'lineas debe ser una lista' })
      .min(1, 'La venta no tiene líneas')
      .max(MAX_LINEAS, `Hasta ${MAX_LINEAS} líneas por venta`),
  })
  .strict();
