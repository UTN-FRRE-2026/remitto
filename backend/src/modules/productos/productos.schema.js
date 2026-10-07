import { z } from 'zod';

const UNIDADES = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'MILILITRO', 'METRO', 'PAQUETE'];

const decimalNoNeg = z.coerce.number().nonnegative('No puede ser negativo');

export const crearProductoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  codigoBarras: z
    .string()
    .trim()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  categoriaId: z.coerce.number().int().positive().optional().nullable(),
  unidadMedida: z.enum(UNIDADES).default('UNIDAD'),
  stockMinimo: decimalNoNeg.default(0),
  stockDeseado: decimalNoNeg.optional().nullable(),
});

export const actualizarProductoSchema = crearProductoSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  // Filtros de la pantalla de productos (maqueta): Todos / Stock bajo / Sin stock.
  estado: z.enum(['TODOS', 'EN_STOCK', 'STOCK_BAJO', 'SIN_STOCK']).default('TODOS'),
  incluirInactivos: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
