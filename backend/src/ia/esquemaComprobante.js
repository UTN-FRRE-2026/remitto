import { z } from 'zod';

// HU9: estructura que se le pide a la IA. Hay dos versiones de la misma forma:
// - ESQUEMA_JSON: JSON Schema que se envía al modelo.
// - lecturaSchema: Zod 3, valida de forma estricta lo recibido.
// Un test verifica que ambas declaren los mismos campos.
//
// Compatibilidad (diagnóstico del 19/10/2026 con gemini-3.8-flash):
// el esquema mínimo es aceptado y la versión 1 —con uniones ["string","null"],
// additionalProperties y maxItems— fue rechazada con 400 invalid_request. Por
// eso el esquema enviado usa solo tipos simples: lo ilegible o ausente se
// OMITE y Zod lo convierte en null.
//
// Versión 3: la cantidad se pide solo como texto obligatorio (cantidadTexto),
// copiado de la celda; "" significa celda vacía o ilegible. El número lo
// obtiene el backend (normalizar.js). En la versión 2 el campo numérico
// opcional "cantidad" fue omitido por el modelo en todas las filas.
// Las lecturas ya guardadas con versiones anteriores no se reinterpretan.
export const VERSION_ESQUEMA = 3;
export const MAX_LINEAS = 200;

const texto = (description) => ({ type: 'string', description });
const numero = (description) => ({ type: 'number', description });
const booleano = (description) => ({ type: 'boolean', description });

// Las descripciones repiten las reglas de instrucciones.js (un test lo controla).
const ESQUEMA_LINEA = {
  type: 'object',
  description: 'Una fila de producto de la tabla. Se incluye aunque algún dato no se lea.',
  properties: {
    codigo: texto('Código del artículo tal como está impreso. Omitir si no figura.'),
    descripcion: texto('Nombre del producto tal como está impreso, incluida su presentación (por ejemplo 500ML).'),
    cantidadTexto: texto(
      'Obligatorio. Copia exacta del contenido de la celda de cantidad de la fila, sin calcularla ni convertirla. Cadena vacía si la celda está vacía o no se lee.',
    ),
    unidad: texto(
      'Solo si en la fila aparece escrita explícitamente una unidad de medida o de venta, en su propia columna o junto a la cantidad. No es la presentación de la descripción. Si no aparece, omitir: no completar un valor por defecto.',
    ),
    precioUnitario: numero('Precio unitario impreso. Omitir si no figura o no se lee.'),
    precioUnitarioTexto: texto('Precio unitario exactamente como figura en el papel.'),
    ilegible: booleano('true si algún dato impreso de la fila no se puede leer con seguridad o si la celda de cantidad está vacía.'),
    observacion: texto('Duda puntual sobre la fila, en pocas palabras. Sin explicaciones ni razonamientos.'),
  },
  required: ['cantidadTexto', 'ilegible'],
};

export const ESQUEMA_JSON = {
  type: 'object',
  properties: {
    documento: {
      type: 'object',
      properties: {
        legible: booleano('false si el documento no se puede leer en absoluto.'),
        motivoIlegible: texto('Motivo si no es legible: borroso, cortado o no es un comprobante.'),
        manuscrito: booleano('true si los datos principales están escritos a mano.'),
        bajaCalidad: booleano('true si la imagen está borrosa, oscura, inclinada o cortada.'),
      },
      required: ['legible', 'manuscrito', 'bajaCalidad'],
    },
    cabecera: {
      type: 'object',
      properties: {
        tipo: texto('Tipo de comprobante impreso: REMITO, FACTURA u OTRO. Omitir si no se distingue.'),
        numero: texto('Número del comprobante tal como está impreso, por ejemplo 0001-00045872.'),
        fechaEmision: texto('Fecha de emisión en formato AAAA-MM-DD. Omitir si no se lee completa.'),
        totalDeclarado: numero('Total impreso en el comprobante.'),
        totalTexto: texto('Total exactamente como figura en el papel.'),
        proveedorNombre: texto('Razón social del emisor tal como figura.'),
        proveedorCuit: texto('CUIT del emisor tal como figura.'),
      },
    },
    lineas: {
      type: 'array',
      description: 'Una entrada por cada fila de producto de la tabla, en el orden del papel, sin saltear ninguna.',
      items: ESQUEMA_LINEA,
    },
  },
  required: ['documento', 'cabecera', 'lineas'],
};

// Ausente se toma como null (dato no leído); nunca como 0 ni como texto vacío.
const textoZ = z.string().nullish().transform((v) => v ?? null);
const numeroZ = z.number().nullish().transform((v) => v ?? null);
const booleanoZ = z.boolean().nullish().transform((v) => v ?? false);

export const lineaSchema = z.object({
  codigo: textoZ,
  descripcion: textoZ,
  // Obligatorio desde la versión 3; "" = celda vacía o ilegible (no se completa).
  cantidadTexto: z.string(),
  unidad: textoZ,
  precioUnitario: numeroZ,
  precioUnitarioTexto: textoZ,
  ilegible: booleanoZ,
  observacion: textoZ,
});

export const lecturaSchema = z.object({
  documento: z.object({
    legible: z.boolean(),
    motivoIlegible: textoZ,
    manuscrito: booleanoZ,
    bajaCalidad: booleanoZ,
  }),
  cabecera: z.object({
    tipo: textoZ, // se valida contra REMITO/FACTURA/OTRO al normalizar
    numero: textoZ,
    fechaEmision: textoZ,
    totalDeclarado: numeroZ,
    totalTexto: textoZ,
    proveedorNombre: textoZ,
    proveedorCuit: textoZ,
  }),
  lineas: z.array(lineaSchema).max(MAX_LINEAS),
});
