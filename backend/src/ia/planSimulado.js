// HU25: planificador simulado del asistente (pruebas sin red; nunca en
// producción). Reconoce palabras clave de forma determinística y devuelve el
// mismo tipo de plan que el modelo. Es pura: recibe la pregunta y la fecha de
// hoy (AAAA-MM-DD).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

const normalizar = (t) =>
  String(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fecha = (d) => d.toISOString().slice(0, 10);
const diaUtc = (texto) => new Date(`${texto}T00:00:00Z`);
const sumarDias = (texto, n) => {
  const d = diaUtc(texto);
  d.setUTCDate(d.getUTCDate() + n);
  return fecha(d);
};
const ultimoDiaDelMes = (anio, mes) => fecha(new Date(Date.UTC(anio, mes, 0)));

// Período nombrado en la pregunta: { periodo, texto } (texto: lo reconocido,
// para quitarlo antes de buscar el producto) o null si no nombra ninguno.
export function periodoDe(t, hoy) {
  const [anio, mes] = hoy.split('-').map(Number);
  let m = /\b(?:en|de|durante) (?:el mes de )?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: (?:de |del )?(\d{4}))?\b/.exec(t);
  if (m) {
    const numeroMes = MESES.indexOf(m[1]) + 1;
    const anioMes = m[2] ? Number(m[2]) : numeroMes <= mes ? anio : anio - 1;
    const desde = `${anioMes}-${String(numeroMes).padStart(2, '0')}-01`;
    const fin = ultimoDiaDelMes(anioMes, numeroMes);
    return { periodo: { desde, hasta: fin > hoy && desde <= hoy ? hoy : fin }, texto: m[0] };
  }
  m = /\b(?:en|durante) (?:el (?:ano|año) )?(\d{4})\b/.exec(t);
  if (m) return { periodo: { desde: `${m[1]}-01-01`, hasta: `${m[1]}-12-31` }, texto: m[0] };
  const lunes = sumarDias(hoy, -((diaUtc(hoy).getUTCDay() + 6) % 7));
  m = /\b(?:la )?semana pasada\b/.exec(t);
  if (m) return { periodo: { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) }, texto: m[0] };
  m = /\besta semana\b/.exec(t);
  if (m) return { periodo: { desde: lunes, hasta: hoy }, texto: m[0] };
  m = /\beste mes\b/.exec(t);
  if (m) return { periodo: { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }, texto: m[0] };
  m = /\b(?:los )?ultimos (\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce) (dias|meses|semanas)\b/.exec(t);
  if (m) {
    const n = NUMEROS[m[1]] ?? Number(m[1]);
    return { periodo: { dias: m[2] === 'meses' ? n * 30 : m[2] === 'semanas' ? n * 7 : n }, texto: m[0] };
  }
  m = /\beste trimestre\b/.exec(t);
  if (m) return { periodo: { dias: 90 }, texto: m[0] };
  m = /\b(?:este|el ultimo) ano\b/.exec(t);
  if (m) return { periodo: { dias: 365 }, texto: m[0] };
  return null;
}

const VACIAS = new Set(
  `que cual cuales cuanto cuanta cuantos cuantas me te se nos mi mis tu queda quedan hay tengo tenemos de del la el los las lo un una unos unas en a al
  y o con por para sobre fue es son esta este estan salio salieron salida salidas vendi vendio vendimos vendieron vendido vendidos venta ventas
  aumento aumentaron subio subieron precio precios stock compra costo cuesta cuestan evolucion como cambio cambiaron otros otras productos producto
  mas menos todavia ahora hoy`
    .split(/\s+/)
    .filter(Boolean),
);

function productoDe(t, periodoTexto) {
  const sinPeriodo = periodoTexto ? t.replace(periodoTexto, ' ') : t;
  const palabras = sinPeriodo
    .replace(/\d+([.,]\d+)?\s*%/g, ' ')
    .split(' ')
    .filter((p) => p && !VACIAS.has(p) && !/^\d+$/.test(p));
  return palabras.length ? palabras.join(' ') : null;
}

export function planSimulado(pregunta, hoy) {
  const t = normalizar(pregunta);
  const encontrado = periodoDe(t, hoy);
  const periodo = encontrado?.periodo;
  const producto = productoDe(t, encontrado?.texto);
  const conPeriodo = (args) => (periodo ? { ...args, periodo } : args);
  const herramienta = (nombre, argumentos) => ({ accion: 'herramienta', herramienta: nombre, argumentos, mensaje: null });
  const pedirProducto = { accion: 'aclaracion', herramienta: null, argumentos: null, mensaje: '¿De qué producto querés saberlo?' };
  const vende = /\bvend/.test(t);

  if (/\bfalt|\balertas?\b/.test(t)) return herramienta('faltantes', {});
  if (/\brepon|reposici|que (tengo que )?(pedir|comprar)\b/.test(t)) return herramienta('reposicion', {});
  if (/no se vend|no vend|sin ventas/.test(t)) return herramienta('sin_ventas', conPeriodo({}));
  if (/aumentaron|subieron|mayores aumentos/.test(t)) {
    const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(t);
    return herramienta('mayores_aumentos', conPeriodo(m ? { minimoPorcentaje: Number(m[1].replace(',', '.')) } : {}));
  }
  if (/mas vendid|lo mas vend|mas se vend|mas salid|mas salio|mas salieron|que mas (sale|salio|vend)/.test(t)) {
    const cuantos = /\blos (\d+) (?:productos )?mas\b/.exec(t);
    return herramienta('mas_salidas', conPeriodo({ soloVentas: vende, ...(cuantos ? { limite: Number(cuantos[1]) } : {}) }));
  }
  if (/aument|subio|precio|cuesta|costo/.test(t)) {
    return producto ? herramienta('evolucion_precio', conPeriodo({ producto })) : pedirProducto;
  }
  if (/\bsalio|salieron|salidas|\bvend/.test(t)) {
    return producto ? herramienta('salidas_producto', conPeriodo({ producto, soloVentas: vende })) : pedirProducto;
  }
  if (/queda|stock|\bhay\b|tengo/.test(t)) {
    return producto ? herramienta('stock_producto', { producto }) : pedirProducto;
  }
  return {
    accion: 'fuera_de_alcance',
    herramienta: null,
    argumentos: null,
    mensaje: 'Puedo responder sobre stock, faltantes, reposición, salidas y ventas, productos sin ventas y precios de compra.',
  };
}
