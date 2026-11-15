import { z } from 'zod';
import { dia, hoyArgentina, restarDias } from '../reportes/reportes.schema.js';

// HU25: esquemas del asistente (pedidos de la API, plan del modelo y
// argumentos de cada herramienta).

export const MAX_DIAS = 365;
export const MAX_FILAS = 20;

// --- Períodos -------------------------------------------------------------

// Error de período: la pregunta nombra un período que no se puede usar. El
// asistente responde pidiendo precisión, nunca lo cambia por otro.
export class ErrorPeriodo extends Error {}

// Período del modelo: { dias } (los últimos N días con hoy incluido) o
// { desde, hasta } (días calendario de Argentina). Se valida la forma; los
// límites se comprueban en resolverPeriodo, que necesita la fecha de hoy.
export const periodoSchema = z.union([
  z.object({ dias: z.number().int() }).strict(),
  z.object({ desde: z.string(), hasta: z.string() }).strict(),
]);

const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

const formatoDia = (d) => d.split('-').reverse().join('/');
export const describirPeriodo = ({ desde, hasta }) => `del ${formatoDia(desde)} al ${formatoDia(hasta)}`;

// Devuelve { desde, hasta, dias } o lanza ErrorPeriodo. Sin período, usa los
// últimos `porDefecto` días.
export function resolverPeriodo(periodo, porDefecto, hoy = hoyArgentina()) {
  if (periodo == null) return { desde: restarDias(hoy, porDefecto - 1), hasta: hoy, dias: porDefecto };
  if ('dias' in periodo) {
    if (periodo.dias < 1 || periodo.dias > MAX_DIAS) {
      throw new ErrorPeriodo(`Puedo consultar períodos de 1 a ${MAX_DIAS} días. ¿Qué período querés ver?`);
    }
    return { desde: restarDias(hoy, periodo.dias - 1), hasta: hoy, dias: periodo.dias };
  }
  const { desde, hasta } = periodo;
  if (!dia.safeParse(desde).success || !dia.safeParse(hasta).success) {
    throw new ErrorPeriodo('No pude entender las fechas del período. ¿Podés indicarlas de otra forma?');
  }
  if (desde > hasta) throw new ErrorPeriodo('El período empieza después de terminar. ¿Qué fechas querés consultar?');
  if (hasta > hoy) throw new ErrorPeriodo('El período incluye fechas futuras. ¿Qué período ya transcurrido querés consultar?');
  const dias = diasEntre(desde, hasta);
  if (dias > MAX_DIAS) throw new ErrorPeriodo(`Puedo consultar hasta ${MAX_DIAS} días por vez. ¿Qué parte de ese período querés ver?`);
  return { desde, hasta, dias };
}

// --- Argumentos de las herramientas (lo que puede pedir el modelo) --------

const producto = z.string().trim().min(2, 'Nombre de producto demasiado corto').max(80);
const limite = z.number().int().min(1).max(MAX_FILAS).default(10);
const soloVentas = z.boolean().default(false);
const sinArgumentos = z.object({}).strict();

export const argumentosSchema = {
  stock_producto: z.object({ producto }).strict(),
  faltantes: sinArgumentos,
  reposicion: sinArgumentos,
  salidas_producto: z.object({ producto, periodo: periodoSchema.optional(), soloVentas }).strict(),
  mas_salidas: z.object({ periodo: periodoSchema.optional(), soloVentas, limite }).strict(),
  sin_ventas: z.object({ periodo: periodoSchema.optional() }).strict(),
  evolucion_precio: z.object({ producto, periodo: periodoSchema.optional() }).strict(),
  mayores_aumentos: z
    .object({ periodo: periodoSchema.optional(), minimoPorcentaje: z.number().min(0).max(1000).optional(), limite })
    .strict(),
};

export const HERRAMIENTAS_HABILITADAS = Object.keys(argumentosSchema);

// --- Plan del modelo -------------------------------------------------------

// El nombre de la herramienta se valida aparte, para registrar el rechazo de
// una herramienta no habilitada.
export const planSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('herramienta'),
    herramienta: z.string().min(1).max(60),
    argumentos: z.record(z.unknown()).nullable().optional(),
    mensaje: z.string().nullable().optional(),
  }),
  z.object({ accion: z.literal('aclaracion'), mensaje: z.string().trim().min(1).max(400), herramienta: z.unknown().optional(), argumentos: z.unknown().optional() }),
  z.object({ accion: z.literal('fuera_de_alcance'), mensaje: z.string().max(400).nullable().optional(), herramienta: z.unknown().optional(), argumentos: z.unknown().optional() }),
]);

// --- Pedidos de la API -----------------------------------------------------

export const consultaSchema = z
  .object({
    pregunta: z
      .string({ required_error: 'Escribí una pregunta', invalid_type_error: 'La pregunta debe ser un texto' })
      .trim()
      .min(1, 'Escribí una pregunta')
      .max(500, 'La pregunta admite hasta 500 caracteres'),
  })
  .strict();

export const eleccionSchema = z.object({ productoId: z.number({ required_error: 'Elegí un producto' }).int().positive() }).strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const historialSchema = z.object({ limite: z.coerce.number().int().min(1).max(50).default(20) }).strict();
