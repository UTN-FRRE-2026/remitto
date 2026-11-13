import { z } from 'zod';

// HU3: el correo se guarda en minúsculas; «Juan@x.com» y «juan@x.com» son el mismo.
const correo = z
  .string()
  .trim()
  .email('Correo electrónico inválido')
  .max(255)
  .transform((v) => v.toLowerCase());

const clave = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(72, 'La contraseña puede tener hasta 72 caracteres'); // límite de bcrypt

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
  email: correo,
  password: clave,
  rol: z.enum(['PROPIETARIO', 'EMPLEADO']).default('EMPLEADO'),
});

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres').optional(),
    email: correo.optional(),
    password: clave.optional(),
    rol: z.enum(['PROPIETARIO', 'EMPLEADO']).optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para aplicar' });

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
