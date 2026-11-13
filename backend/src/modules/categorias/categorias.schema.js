import { z } from 'zod';

export const categoriaSchema = z.object({
  // Espacios repetidos se reducen a uno: «Almacén  seco» = «Almacén seco».
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(60, 'Máximo 60 caracteres')
    .transform((v) => v.replace(/\s+/g, ' ')),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
