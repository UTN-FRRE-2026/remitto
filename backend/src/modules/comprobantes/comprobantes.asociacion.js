// HU15 (RF3.3): asociación automática de cada línea leída con un producto del
// catálogo, con su nivel de confianza (0 a 1). Es solo una propuesta: la
// persona la revisa y puede cambiarla, y el stock entra recién al confirmar.
//
// Cómo se calcula (funciones puras, sin base de datos):
// 1. Si el código impreso coincide con el código de barras de un producto, la
//    confianza es 1.
// 2. Si no, se compara la descripción palabra por palabra con el nombre de
//    cada producto activo. Cada palabra vale 1 si es igual, 0,9 si es una
//    abreviatura (prefijo: "gall" → "galletitas") y hasta 0,9 si difiere por
//    un error de tipeo leve. Las medidas ("500ml", "1.5l") tienen que ser
//    iguales. El puntaje combina cuánto de lo leído explica el producto (70 %)
//    y cuánto del nombre aparece en lo leído (30 %).
// 3. Si las medidas no coinciden, el puntaje se divide por 2. Si otro producto
//    queda casi empatado, la asociación es ambigua: la confianza se limita a
//    0,79, siempre por debajo del umbral, y la línea se destaca.

// Desde este valor la propuesta es confiable; por debajo, la línea se destaca.
export const UMBRAL_CONFIANZA = 0.8;
// Por debajo de este puntaje no se propone producto: se sugiere darlo de alta.
export const MINIMO_PROPUESTA = 0.5;
const EMPATE = 0.05;
// Tope de confianza de una asociación ambigua (empate): siempre se destaca.
const TOPE_EMPATE = UMBRAL_CONFIANZA - 0.01;

const UNIDADES = {
  ml: 'ml', cc: 'ml',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  g: 'g', gr: 'g', grs: 'g', gramos: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  u: 'u', un: 'u', unid: 'u', unidades: 'u',
};
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'x', 'en', 'para']);

// Texto → palabras comparables. "AGUA S/GAS 1.5L" → ["agua", "sin", "gas", "1.5l"].
export function palabras(texto) {
  if (!texto) return [];
  const t = String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bc\//g, 'con ')
    .replace(/\bs\//g, 'sin ')
    .replace(/(\d)[.,](\d)/g, '$1.$2')
    // Número pegado o separado de su unidad: "500 ml" → "500ml".
    .replace(/(\d+(?:\.\d+)?)\s*([a-z]+)\b/g, (m, n, u) => (UNIDADES[u] ? ` ${Number(n)}${UNIDADES[u]} ` : m))
    .replace(/[^a-z0-9.]+/g, ' ');
  return t
    .split(' ')
    .map((p) => p.replace(/^\.+|\.+$/g, ''))
    .filter((p) => p && !PALABRAS_VACIAS.has(p));
}

const esMedida = (p) => /\d/.test(p);

function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

// Parecido entre dos palabras, de 0 a 1.
export function parecidoPalabra(a, b) {
  if (a === b) return 1;
  if (esMedida(a) || esMedida(b)) return 0;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  if (larga.startsWith(corta)) return corta.length >= 3 ? 0.9 : 0.6;
  if (corta.length >= 4) {
    const parecido = 1 - distancia(a, b) / larga.length;
    if (parecido >= 0.75) return parecido * 0.9;
  }
  return 0;
}

const cobertura = (de, en) =>
  de.reduce((suma, p) => suma + Math.max(0, ...en.map((q) => parecidoPalabra(p, q))), 0) / de.length;

// Parecido entre la descripción leída y el nombre de un producto, de 0 a 1.
export function similitud(descripcion, nombre) {
  const leidas = palabras(descripcion);
  const delProducto = palabras(nombre);
  if (leidas.length === 0 || delProducto.length === 0) return 0;
  let puntaje = 0.7 * cobertura(leidas, delProducto) + 0.3 * cobertura(delProducto, leidas);
  const medidasLeidas = leidas.filter(esMedida);
  const medidasProducto = delProducto.filter(esMedida);
  if (medidasLeidas.length > 0 && medidasProducto.length > 0 && !medidasLeidas.some((m) => medidasProducto.includes(m))) {
    puntaje /= 2;
  }
  return puntaje;
}

const redondear = (x) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;
const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

// Propuesta para una línea leída. productos: [{ id, nombre, codigoBarras }],
// solo activos. Devuelve { productoId, confianza }:
// - productoId con confianza: producto propuesto (dudoso si < UMBRAL_CONFIANZA).
// - productoId null y confianza 0: sin coincidencia, se propone el alta.
// - ambos null: la línea no tiene descripción ni código para buscar.
export function proponerAsociacion({ codigo, descripcion }, productos) {
  const codigoLeido = soloDigitos(codigo);
  if (codigoLeido.length >= 8) {
    const exacto = productos.find((p) => soloDigitos(p.codigoBarras) === codigoLeido);
    if (exacto) return { productoId: exacto.id, confianza: 1 };
  }
  if (!descripcion?.trim()) return { productoId: null, confianza: codigo ? 0 : null };

  let mejor = null;
  let segundo = 0;
  for (const p of productos) {
    const puntaje = similitud(descripcion, p.nombre);
    if (!mejor || puntaje > mejor.puntaje) {
      segundo = mejor?.puntaje ?? 0;
      mejor = { id: p.id, puntaje };
    } else if (puntaje > segundo) {
      segundo = puntaje;
    }
  }
  if (!mejor || mejor.puntaje < MINIMO_PROPUESTA) return { productoId: null, confianza: 0 };
  const empate = mejor.puntaje - segundo < EMPATE;
  return { productoId: mejor.id, confianza: redondear(empate ? Math.min(mejor.puntaje, TOPE_EMPATE) : mejor.puntaje) };
}

// La propuesta es dudosa (se destaca) si no llega al umbral, y también si no
// se encontró producto. Una asociación elegida por la persona tiene confianza
// null y no se destaca.
export function esDudosa({ productoId, confianza }) {
  if (confianza == null) return false;
  return !productoId || Number(confianza) < UMBRAL_CONFIANZA;
}
