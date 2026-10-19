// Números en formato argentino para los campos editables (HU10).
// Acepta "12", "1,5", "1.250", "1.250,50". Lo ambiguo ("1.5", "12 u") no se
// interpreta: devuelve NaN para que la pantalla pida corregirlo.
export function leerNumero(texto) {
  const t = String(texto ?? '').trim().replace(/^\$\s*/, '');
  if (t === '') return null;
  let normal = null;
  if (/^\d+$/.test(t)) normal = t;
  else if (/^\d+,\d+$/.test(t)) normal = t.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.');
  return normal === null ? NaN : Number(normal);
}

export function mostrarNumero(valor, decimales = 0) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor).toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: Math.max(decimales, 3) });
}

export const pesos = (valor) => (valor == null ? '—' : `$ ${mostrarNumero(valor, 2)}`);
