import { z } from 'zod';

// Campos de texto del multipart de carga (HU8). El archivo lo valida el servicio.
export const crearComprobanteSchema = z.object({
  proveedorId: z.coerce
    .number({ invalid_type_error: 'Elegí un proveedor' })
    .int('Elegí un proveedor')
    .positive('Elegí un proveedor'),
  tipo: z.enum(['REMITO', 'FACTURA', 'OTRO']).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
