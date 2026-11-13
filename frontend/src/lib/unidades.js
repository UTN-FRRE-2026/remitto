// Abreviatura de cada unidad de medida, para mostrar junto a las cantidades.
export const UNIDAD_CORTA = {
  UNIDAD: 'u.',
  KILOGRAMO: 'kg',
  GRAMO: 'g',
  LITRO: 'l',
  MILILITRO: 'ml',
  METRO: 'm',
  PAQUETE: 'paq.',
};

export const unidadCorta = (unidad) => UNIDAD_CORTA[unidad] ?? 'u.';

// Opciones de unidad de medida para los formularios (valor del backend, texto).
export const UNIDADES = [
  ['UNIDAD', 'Unidad'],
  ['KILOGRAMO', 'Kilogramo'],
  ['GRAMO', 'Gramo'],
  ['LITRO', 'Litro'],
  ['MILILITRO', 'Mililitro'],
  ['METRO', 'Metro'],
  ['PAQUETE', 'Paquete'],
];
