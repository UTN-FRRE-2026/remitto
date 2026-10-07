import { z } from 'zod';

const textoOpcional = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const crearProveedorSchema = z.object({
  razonSocial: z.string().trim().min(1, 'La razón social es obligatoria'),
  // CUIT argentino: 11 dígitos (acepta con o sin guiones, se normaliza).
  cuit: z
    .string()
    .trim()
    .regex(/^\d{2}-?\d{8}-?\d$/, 'El CUIT debe tener 11 dígitos')
    .transform((v) => v.replace(/-/g, ''))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefono: textoOpcional,
  email: z.string().trim().email('Correo inválido').optional().or(z.literal('').transform(() => undefined)),
  direccion: textoOpcional,
  contacto: textoOpcional,
});

export const actualizarProveedorSchema = crearProveedorSchema.partial().extend({
  activo: z.boolean().optional(),
});

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
