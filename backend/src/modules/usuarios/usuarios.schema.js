import { z } from 'zod';

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.string().trim().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.enum(['PROPIETARIO', 'EMPLEADO']).default('EMPLEADO'),
});

export const actualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    email: z.string().trim().email('Correo electrónico inválido').optional(),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
    rol: z.enum(['PROPIETARIO', 'EMPLEADO']).optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No hay cambios para aplicar' });

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
