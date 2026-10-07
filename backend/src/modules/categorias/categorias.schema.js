import { z } from 'zod';

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
