import { z } from 'zod';

// HU14: ajuste de stock por recuento físico. Mismas reglas numéricas que el
// carrito (HU13): números como number, hasta 3 decimales (Decimal(12,3)).
const conDecimales = (max) => (v) => Math.abs(v * 10 ** max - Math.round(v * 10 ** max)) < 1e-6;

const numero = (nombre, minimo, mensajeMinimo) =>
  z
    .number({ invalid_type_error: `${nombre} debe ser un número`, required_error: `Falta ${nombre.toLowerCase()}` })
    .min(minimo, mensajeMinimo)
    .max(999999999, `${nombre} es demasiado grande`)
    .refine(conDecimales(3), `${nombre} admite hasta 3 decimales`);

const linea = z
  .object({
    productoId: z.number({ required_error: 'Falta el producto' }).int().positive(),
    // Lo que se contó en el comercio. Puede ser 0 (no quedó nada).
    contado: numero('La cantidad contada', 0, 'La cantidad contada no puede ser negativa'),
    // Stock del sistema que vio la persona al contar (puede ser negativo si
    // se vendió lo no ingresado). Si cambió antes de confirmar (una venta,
    // otro recuento o un reenvío ya aplicado), no se ajusta: la diferencia
    // calculada ya no sería válida.
    stockRegistrado: numero('El stock registrado', -999999999, 'El stock registrado es demasiado chico'),
    // Versión del producto al leerlo: id de su último movimiento (null si no
    // tiene). Los ids solo crecen, así que detecta cualquier movimiento
    // posterior aunque el stock haya vuelto al mismo valor.
    ultimoMovimientoId: z
      .number({ required_error: 'Falta la versión del producto', invalid_type_error: 'Versión del producto no válida' })
      .int()
      .positive()
      .nullable(),
  })
  .strict();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const crearRecuentoSchema = z
  .object({
    observacion: z
      .string()
      .trim()
      .max(500, 'La observación admite hasta 500 caracteres')
      .optional()
      .transform((v) => v || undefined),
    lineas: z.array(linea).min(1, 'Agregá al menos un producto').max(200, 'Hasta 200 productos por recuento'),
  })
  .strict()
  .superRefine((d, ctx) => {
    const vistos = new Set();
    d.lineas.forEach((l, i) => {
      if (vistos.has(l.productoId)) {
        ctx.addIssue({ code: 'custom', path: ['lineas', i, 'productoId'], message: 'El producto está repetido en el recuento' });
      }
      vistos.add(l.productoId);
    });
  });
