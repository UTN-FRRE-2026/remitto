import { z } from 'zod';

// HU12: filtros del historial de movimientos. Las fechas son días
// calendario (AAAA-MM-DD) en la hora de Argentina; "hasta" es inclusivo.
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Fecha inexistente');

export const listarMovimientosSchema = z
  .object({
    productoId: z.coerce.number().int().positive().optional(),
    tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']).optional(),
    desde: dia.optional(),
    hasta: dia.optional(),
    pagina: z.coerce.number().int().positive().max(10000).default(1),
    limite: z.coerce.number().int().positive().max(100).default(30),
  })
  .strict()
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: 'La fecha "desde" no puede ser posterior a "hasta"',
    path: ['desde'],
  });
