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
