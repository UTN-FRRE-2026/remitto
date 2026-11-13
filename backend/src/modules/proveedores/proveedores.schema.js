import { z } from 'zod';

// Vacío o solo espacios → null. En una modificación, null borra el valor;
// omitir el campo lo deja como estaba.
const vacioANull = (esquema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), esquema.nullable().optional());

const textoOpcional = vacioANull(z.string().trim().max(255, 'Máximo 255 caracteres'));

export const crearProveedorSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria').max(255, 'Máximo 255 caracteres'),
  // CUIT argentino: 11 dígitos (acepta con o sin guiones, se guarda sin ellos).
  cuit: vacioANull(
    z
      .string()
      .trim()
      .regex(/^\d{2}-?\d{8}-?\d$/, 'El CUIT debe tener 11 dígitos')
      .transform((v) => v.replace(/-/g, '')),
  ),
  telefono: textoOpcional,
  email: vacioANull(z.string().trim().email('Correo inválido')),
  direccion: textoOpcional,
  contacto: textoOpcional,
});

export const actualizarProveedorSchema = crearProveedorSchema
  .partial()
  .extend({
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para aplicar' });

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listarQuerySchema = z.object({
  q: z.string().trim().optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
