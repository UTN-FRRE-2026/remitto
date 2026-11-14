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

// --- HU10: revisión del comprobante leído ---

export const detalleParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  detalleId: z.coerce.number().int().positive(),
});

// Números como number (no texto): así un campo vacío nunca se convierte en 0.
// La escala respeta las columnas Decimal(12,3) y Decimal(12,2).
const conDecimales = (max) => (v) => Math.abs(v * 10 ** max - Math.round(v * 10 ** max)) < 1e-6;

const cantidad = z
  .number({ invalid_type_error: 'La cantidad debe ser un número' })
  .positive('La cantidad debe ser mayor a 0')
  .max(999999999, 'La cantidad es demasiado grande')
  .refine(conDecimales(3), 'La cantidad admite hasta 3 decimales');

const precio = z
  .number({ invalid_type_error: 'El precio debe ser un número' })
  .nonnegative('El precio no puede ser negativo')
  .max(9999999999, 'El precio es demasiado grande')
  .refine(conDecimales(2), 'El precio admite hasta 2 decimales');

const productoId = z.number().int().positive();

export const actualizarDetalleSchema = z
  .object({
    productoId: productoId.nullable().optional(),
    cantidad: cantidad.nullable().optional(),
    precioUnitario: precio.nullable().optional(),
    descartada: z.boolean().optional(),
    // HU17: la persona confirma que revisó la línea.
    revisada: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');

export const agregarDetalleSchema = z
  .object({
    productoId: productoId.nullable().optional(),
    cantidad: cantidad.nullable().optional(),
    precioUnitario: precio.nullable().optional(),
  })
  .strict();

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD')
  .refine((t) => {
    const d = new Date(`${t}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(t);
  }, 'La fecha no es válida');

// Día de hoy en Argentina (AAAA-MM-DD), para comparar con fechas de calendario.
export const hoyArgentina = (ahora = new Date()) =>
  ahora.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

// La fecha de emisión que corrige una persona no puede ser futura: como la
// lectura de la IA (normalizar.js), y porque fija la vigencia del precio de
// compra (HU20, HU28): una fecha futura dominaría el «último precio».
const fechaEmision = fecha.refine((t) => t <= hoyArgentina(), 'La fecha de emisión no puede ser posterior a hoy.');

export const actualizarCabeceraSchema = z
  .object({
    numero: z
      .string()
      .trim()
      .max(50, 'El número es demasiado largo')
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    fechaEmision: fechaEmision.nullable().optional(),
    tipo: z.enum(['REMITO', 'FACTURA', 'OTRO']).optional(),
    totalDeclarado: z
      .number({ invalid_type_error: 'El total debe ser un número' })
      .nonnegative('El total no puede ser negativo')
      .max(999999999999, 'El total es demasiado grande')
      .refine(conDecimales(2), 'El total admite hasta 2 decimales')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar');

// --- HU18: comprobantes archivados ---

// Día calendario AAAA-MM-DD (hora de Argentina), como en Movimientos (HU12).
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Fecha inexistente');

// EN_PROCESO agrupa los que todavía no se leyeron (PENDIENTE) o se están leyendo.
export const ESTADOS_FILTRO = ['EN_PROCESO', 'PENDIENTE', 'PROCESANDO', 'EN_REVISION', 'CONFIRMADO', 'ERROR', 'ANULADO'];

export const listarComprobantesSchema = z
  .object({
    proveedorId: z.coerce.number().int().positive().optional(),
    estado: z.enum(ESTADOS_FILTRO).optional(),
    // Fecha de carga del comprobante; "hasta" es inclusivo.
    desde: dia.optional(),
    hasta: dia.optional(),
    // Número del comprobante (parte del número; sin distinguir mayúsculas).
    numero: z.string().trim().min(1).max(40).optional(),
    pagina: z.coerce.number().int().positive().max(10000).default(1),
    limite: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict()
  .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: 'La fecha "desde" no puede ser posterior a "hasta"',
    path: ['desde'],
  });
