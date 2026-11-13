// HU15 (RF3.3): asociación automática de cada línea leída con un producto del
// catálogo, con su nivel de confianza (0 a 1). Es solo una propuesta: la
// persona la revisa y puede cambiarla, y el stock entra recién al confirmar.
//
// Cómo se calcula (funciones puras, sin base de datos):
// 1. Si el código impreso coincide con el código de barras de un producto, la
//    confianza es 1.
// 2. Si no, se compara la descripción palabra por palabra con el nombre de
//    cada producto activo. Cada palabra leída vale 1 si es igual, 0,9 si es una
//    abreviatura de la del producto ("gall" → "galletitas") y hasta 0,9 si
//    difiere por un error de tipeo leve. Las medidas se comparan por su valor:
//    "1500ML" = "1,5 l", "1000G" = "1 kg", y un número sin unidad ("500")
//    coincide con cualquier medida de ese número ("500 ml"). El puntaje combina
//    cuánto de lo leído explica el producto (70 %) y cuánto del nombre aparece
//    en lo leído (30 %).
// 3. Si las medidas no coinciden, el puntaje se divide por 2.
// 4. La propuesta nunca es confiable (se limita a 0,79 y se destaca) si:
//    - otro producto queda casi empatado;
//    - alguna palabra leída no aparece en el producto: suele indicar otra
//      variante ("SIN palo" frente a "con palo", "LIGHT", otra marca);
//    - lo leído cubre poco del nombre del producto ("COLA" frente a
//      "Gaseosa cola 500 ml").

// Desde este valor la propuesta es confiable; por debajo, la línea se destaca.
export const UMBRAL_CONFIANZA = 0.8;
// Por debajo de este puntaje no se propone producto: se sugiere darlo de alta.
export const MINIMO_PROPUESTA = 0.5;
const EMPATE = 0.05;
// Tope de confianza de una asociación dudosa: siempre se destaca.
const TOPE_DUDOSA = UMBRAL_CONFIANZA - 0.01;
// Parte mínima del nombre del producto que tiene que aparecer en lo leído.
const COBERTURA_MINIMA_PRODUCTO = 0.6;

const UNIDADES = {
  ml: 'ml', cc: 'ml',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  g: 'g', gr: 'g', grs: 'g', gramos: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  u: 'u', un: 'u', unid: 'u', unidades: 'u',
};
// Unidad base de cada unidad y factor de conversión: 1500 ml = 1,5 l.
const BASE = { ml: ['l', 0.001], l: ['l', 1], g: ['kg', 0.001], kg: ['kg', 1], u: ['u', 1] };
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'x', 'en', 'para']);
// Palabras de envase o presentación: no distinguen un producto de otro.
const PALABRAS_ENVASE = new Set(['pack', 'caja', 'cja', 'bot', 'botella', 'paq', 'paquete', 'bulto', 'display', 'pet', 'lata', 'sachet', 'unidad']);

// Texto → palabras comparables. "AGUA S/GAS 1.5L" → ["agua", "sin", "gas", "1.5l"].
export function palabras(texto) {
  if (!texto) return [];
  const t = String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bc\.c\.?/g, 'cc')
    .replace(/\bc\//g, 'con ')
    .replace(/\bs\//g, 'sin ')
    // Fracción antes de una unidad: "1/2 KG" → "0.5 kg".
    .replace(/\b(\d+)\/(\d+)\s*(?=[a-z])/g, (m, a, b) => (Number(b) > 0 ? `${Number(a) / Number(b)} ` : m))
    // Punto de miles en medidas chicas: "1.000 GR" → "1000 gr" (nadie escribe 1,000 g).
    .replace(/\b(\d{1,3})\.(\d{3})\s*(ml|cc|g|gr|grs|gramos)\b/g, '$1$2 $3')
    .replace(/(\d)[.,](\d)/g, '$1.$2')
    // Número pegado o separado de su unidad: "500 ml" → "500ml".
    .replace(/(\d+(?:\.\d+)?)\s*([a-z]+)\b/g, (m, n, u) => (UNIDADES[u] ? ` ${Number(n)}${UNIDADES[u]} ` : m))
    .replace(/[^a-z0-9.]+/g, ' ');
  return t
    .split(' ')
    .map((p) => p.replace(/^\.+|\.+$/g, ''))
    .filter((p) => p && !PALABRAS_VACIAS.has(p) && !PALABRAS_ENVASE.has(p) && !/^x\d+$/.test(p));
}

// "1500ml" → { valor: 1500, unidad: 'ml', base: 1.5, unidadBase: 'l' }; "500" → { valor: 500 }.
// Una palabra con dígitos que no es una medida ("7up") se compara como texto.
export function medida(p) {
  const m = /^(\d+(?:\.\d+)?)(ml|l|g|kg|u)?$/.exec(p);
  if (!m) return null;
  const valor = Number(m[1]);
  if (!m[2]) return { valor };
  const [unidadBase, factor] = BASE[m[2]];
  return { valor, unidad: m[2], base: valor * factor, unidadBase };
}

const igual = (a, b) => Math.abs(a - b) < 1e-9;

export function medidasCompatibles(a, b) {
  const ma = medida(a);
  const mb = medida(b);
  if (!ma || !mb) return false;
  if (ma.unidad && mb.unidad) return ma.unidadBase === mb.unidadBase && igual(ma.base, mb.base);
  // Dos números sueltos se comparan como texto: la harina "000" no es la "0000".
  if (!ma.unidad && !mb.unidad) return a === b;
  // Número sin unidad: vale el número tal como está escrito o en la unidad base.
  const [suelto, otra] = ma.unidad ? [mb, ma] : [ma, mb];
  return igual(suelto.valor, otra.valor) || igual(suelto.valor, otra.base);
}

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

// Parecido de una palabra leída con una del producto, de 0 a 1. No es
// simétrico: lo leído puede abreviar al producto ("gall" → "galletitas"), pero
// una palabra corta del producto no explica una larga leída ("pan" no es
// "pañales"); solo se acepta si tiene al menos 4 letras ("gall." → "galletitas").
export function parecidoPalabra(leida, delProducto) {
  if (leida === delProducto) return 1;
  const ml = medida(leida);
  const mp = medida(delProducto);
  if (ml || mp) return ml && mp && medidasCompatibles(leida, delProducto) ? 1 : 0;
  if (delProducto.startsWith(leida)) return leida.length >= 3 ? 0.9 : 0.6;
  if (leida.startsWith(delProducto) && delProducto.length >= 4) return 0.8;
  const larga = Math.max(leida.length, delProducto.length);
  if (Math.min(leida.length, delProducto.length) >= 4) {
    const parecido = 1 - distancia(leida, delProducto) / larga;
    if (parecido >= 0.75) return parecido * 0.9;
  }
  return 0;
}

// Las palabras se repiten mucho entre productos: dentro de una búsqueda, cada
// par se compara una sola vez.
function parecidoConMemoria(memoria) {
  return (leida, delProducto) => {
    const clave = `${leida} ${delProducto}`;
    let valor = memoria.get(clave);
    if (valor === undefined) {
      valor = parecidoPalabra(leida, delProducto);
      memoria.set(clave, valor);
    }
    return valor;
  };
}

// Compara las palabras leídas con las de un producto.
function evaluar(leidas, delProducto, parecido = parecidoPalabra) {
  if (leidas.length === 0 || delProducto.length === 0) return { puntaje: 0, dudosa: false };
  const porLeida = leidas.map((p) => Math.max(0, ...delProducto.map((q) => parecido(p, q))));
  const coberturaLeida = porLeida.reduce((a, b) => a + b, 0) / leidas.length;
  const coberturaProducto =
    delProducto.reduce((suma, q) => suma + Math.max(0, ...leidas.map((p) => parecido(p, q))), 0) /
    delProducto.length;
  let puntaje = 0.7 * coberturaLeida + 0.3 * coberturaProducto;

  const medidasLeidas = leidas.filter(medida);
  const medidasProducto = delProducto.filter(medida);
  if (
    medidasLeidas.length > 0 &&
    medidasProducto.length > 0 &&
    !medidasLeidas.some((a) => medidasProducto.some((b) => medidasCompatibles(a, b)))
  ) {
    puntaje /= 2;
  }

  // Palabra leída (de 2 letras o más, no medida) que el producto no explica.
  const palabraSobrante = leidas.some((p, i) => porLeida[i] === 0 && p.length >= 2 && !medida(p));
  const dudosa = palabraSobrante || coberturaProducto < COBERTURA_MINIMA_PRODUCTO;
  return { puntaje, dudosa };
}

// Parecido entre la descripción leída y el nombre de un producto, de 0 a 1.
export function similitud(descripcion, nombre) {
  return evaluar(palabras(descripcion), palabras(nombre)).puntaje;
}

const redondear = (x) => Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000;
const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

// Las palabras de cada producto se calculan una sola vez por objeto, aunque el
// comprobante tenga muchas líneas.
const palabrasDeProducto = new WeakMap();
function palabrasDe(producto) {
  if (!palabrasDeProducto.has(producto)) palabrasDeProducto.set(producto, palabras(producto.nombre));
  return palabrasDeProducto.get(producto);
}

// Propuesta para una línea leída. productos: [{ id, nombre, codigoBarras }],
// solo activos. Devuelve { productoId, confianza }:
// - productoId con confianza: producto propuesto (dudoso si < UMBRAL_CONFIANZA).
// - productoId null y confianza 0: sin coincidencia, se propone el alta.
// - ambos null: la línea no tiene descripción ni código para buscar.
// Ante un empate exacto gana el de menor id, para que el resultado no dependa
// del orden en que llegan los productos.
export function proponerAsociacion({ codigo, descripcion }, productos) {
  const codigoLeido = soloDigitos(codigo);
  if (codigoLeido.length >= 8) {
    const exacto = productos.find((p) => soloDigitos(p.codigoBarras) === codigoLeido);
    if (exacto) return { productoId: exacto.id, confianza: 1 };
  }
  if (!descripcion?.trim()) return { productoId: null, confianza: codigo ? 0 : null };

  const leidas = palabras(descripcion);
  const parecido = parecidoConMemoria(new Map());
  let mejor = null;
  let segundo = 0;
  for (const p of productos) {
    const r = evaluar(leidas, palabrasDe(p), parecido);
    if (!mejor || r.puntaje > mejor.puntaje || (r.puntaje === mejor.puntaje && p.id < mejor.id)) {
      if (mejor) segundo = Math.max(segundo, mejor.puntaje);
      mejor = { id: p.id, ...r };
    } else if (r.puntaje > segundo) {
      segundo = r.puntaje;
    }
  }
  if (!mejor || mejor.puntaje < MINIMO_PROPUESTA) return { productoId: null, confianza: 0 };
  const dudosa = mejor.dudosa || mejor.puntaje - segundo < EMPATE;
  return { productoId: mejor.id, confianza: redondear(dudosa ? Math.min(mejor.puntaje, TOPE_DUDOSA) : mejor.puntaje) };
}

// La propuesta es dudosa (se destaca) si no llega al umbral, y también si no
// se encontró producto. Una asociación elegida por la persona tiene confianza
// null y no se destaca.
export function esDudosa({ productoId, confianza }) {
  if (confianza == null) return false;
  return !productoId || Number(confianza) < UMBRAL_CONFIANZA;
}
