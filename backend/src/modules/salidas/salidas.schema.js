import { z } from 'zod';

// HU13: salida de stock desde el carrito (varios productos en una operación).
export const MOTIVOS_SALIDA = ['VENTA', 'CONSUMO_INTERNO', 'ROTURA', 'VENCIMIENTO', 'OTRO'];

// Como en la revisión de comprobantes: números como number, hasta 3
// decimales (columnas Decimal(12,3)).
const conDecimales = (max) => (v) => Math.abs(v * 10 ** max - Math.round(v * 10 ** max)) < 1e-6;

const cantidad = z
  .number({ invalid_type_error: 'La cantidad debe ser un número', required_error: 'Falta la cantidad' })
  .positive('La cantidad debe ser mayor a 0')
  .max(999999999, 'La cantidad es demasiado grande')
  .refine(conDecimales(3), 'La cantidad admite hasta 3 decimales');

const linea = z
  .object({
    productoId: z.number({ required_error: 'Falta el producto' }).int().positive(),
    cantidad,
  })
  .strict();

export const crearSalidaSchema = z
  .object({
    motivo: z.enum(MOTIVOS_SALIDA, { errorMap: () => ({ message: 'Motivo de salida no válido' }) }).default('VENTA'),
    observacion: z
      .string()
      .trim()
      .max(500, 'La observación admite hasta 500 caracteres')
      .optional()
      .transform((v) => v || undefined),
    // Lo genera la app por cada carrito: si el pedido se reenvía (red lenta,
    // doble toque), la salida no se registra dos veces.
    idOperacion: z.string().uuid('Identificador de operación no válido').optional(),
    lineas: z.array(linea).min(1, 'Agregá al menos un producto').max(100, 'Hasta 100 productos por salida'),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.motivo === 'OTRO' && !d.observacion) {
      ctx.addIssue({ code: 'custom', path: ['observacion'], message: 'Contá brevemente el motivo de la salida' });
    }
    // Un producto aparece una sola vez por salida (@@unique en la base).
    const vistos = new Set();
    d.lineas.forEach((l, i) => {
      if (vistos.has(l.productoId)) {
        ctx.addIssue({ code: 'custom', path: ['lineas', i, 'productoId'], message: 'El producto está repetido en el carrito' });
      }
      vistos.add(l.productoId);
    });
  });

export const listarSalidasSchema = z
  .object({
    limite: z.coerce.number().int().positive().max(50).default(20),
  })
  .strict();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
