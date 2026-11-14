import { z } from 'zod';

// HU21: claves de integración para que un sistema externo (punto de venta)
// informe salidas. Solo el propietario las administra.
export const crearClaveSchema = z
  .object({
    nombre: z
      .string({ required_error: 'Poné un nombre para reconocer la clave', invalid_type_error: 'Nombre no válido' })
      .trim()
      .min(1, 'Poné un nombre para reconocer la clave')
      .max(60, 'El nombre admite hasta 60 caracteres'),
  })
  .strict();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
