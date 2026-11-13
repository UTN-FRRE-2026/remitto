import { z } from 'zod';

const UNIDADES = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'MILILITRO', 'METRO', 'PAQUETE'];

const decimalNoNeg = z.coerce.number().nonnegative('No puede ser negativo').max(999999999, 'Valor demasiado grande');

// Texto opcional: vacío o solo espacios se guarda como null. En una
// modificación, null borra el valor; omitir el campo lo deja como estaba.
const textoOpcional = (max) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max, `Máximo ${max} caracteres`).nullable().optional(),
  );

export const crearProductoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
  descripcion: textoOpcional(500),
  codigoBarras: textoOpcional(64),
  categoriaId: z.coerce.number().int().positive().optional().nullable(),
  unidadMedida: z.enum(UNIDADES).default('UNIDAD'),
  stockMinimo: decimalNoNeg.default(0),
  stockDeseado: decimalNoNeg.optional().nullable(),
});

export const actualizarProductoSchema = crearProductoSchema
  .partial()
  .extend({
    // Sin default: en una modificación, omitirlos no los cambia.
    unidadMedida: z.enum(UNIDADES).optional(),
    stockMinimo: decimalNoNeg.optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para aplicar' });

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
