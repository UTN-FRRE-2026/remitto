import { z } from 'zod';

// Día calendario AAAA-MM-DD (hora de Argentina), como en Movimientos (HU12).
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Fecha inexistente');

export const hoyArgentina = (ahora = new Date()) =>
  ahora.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

// Resta días a un día calendario (sin zona horaria).
export function restarDias(diaTexto, dias) {
  const d = new Date(`${diaTexto}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export const DIAS_PREDETERMINADOS = 30;

// HU29: período a analizar; por defecto, los últimos 30 días (hoy incluido).
export const sinMovimientoSchema = z
  .object({
    desde: dia.optional(),
    hasta: dia.optional(),
  })
  .strict()
  .transform((f) => {
    const hasta = f.hasta ?? hoyArgentina();
    const desde = f.desde ?? restarDias(hasta, DIAS_PREDETERMINADOS - 1);
    return { desde, hasta };
  })
  .refine((f) => f.desde <= f.hasta, { message: 'La fecha "desde" no puede ser posterior a "hasta"', path: ['desde'] });
