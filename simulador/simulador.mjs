// HU23 (RF5.3): simulador de ventas de un punto de venta.
//
// Actúa como una caja: genera ventas aleatorias reproducibles (con semilla),
// las informa por la API de integración de HU22 con su clave (HU21), incluye
// reenvíos duplicados intencionales y calcula el stock esperado por su
// cuenta, con enteros en milésimas, para compararlo con el registrado.
// No tiene dependencias: solo fetch. El escenario
// backend/e2e/hu23-simulador.mjs lo corre contra una base descartable.

// --- Números exactos: enteros en milésimas -----------------------------------

// Texto decimal («500», «8.745», «-2», «500.000») → entero en milésimas, sin
// pasar por Number. Rechaza más de 3 decimales significativos.
export function aMilesimas(texto) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(texto).trim());
  if (!m) throw new Error(`Número no válido: ${texto}`);
  const decimales = (m[3] ?? '').replace(/0+$/, '');
  if (decimales.length > 3) throw new Error(`Más de 3 decimales: ${texto}`);
  const valor = Number(m[2]) * 1000 + Number(decimales.padEnd(3, '0'));
  if (!Number.isSafeInteger(valor)) throw new Error(`Número fuera de rango: ${texto}`);
  return m[1] === '-' && valor !== 0 ? -valor : valor;
}

// Milésimas → número para el cuerpo del pedido (JSON lo escribe con hasta 3
// decimales, por ejemplo 1255 → 1.255).
export const deMilesimas = (milesimas) => milesimas / 1000;

// --- Ventas reproducibles ----------------------------------------------------

// Generador con semilla (mulberry32): la misma semilla da la misma secuencia.
export function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIDADES_ENTERAS = new Set(['UNIDAD', 'PAQUETE']);
export const TAMANO_TANDA = 8;

// catalogo: [{ productoId, codigoBarras, unidadMedida }] (productos de prueba).
// Devuelve { ventas, tandas }:
// - ventas: [{ referencia, lineas: [{ productoId? | codigoBarras?, milesimas }] }],
//   todas con referencia distinta; cada línea identifica el producto por
//   código de barras o por id, como lo haría la caja.
// - tandas: listas de envíos que salen en paralelo. Cada envío es
//   { venta, tipo: 'primero' | 'reenvio', invertir }. Los reenvíos repiten la
//   misma referencia y contenido (a veces con las líneas en otro orden): la
//   mitad sale en la misma tanda que el primer envío de esa venta y la otra
//   mitad, al final.
export function generarVentas({ semilla, catalogo, ventas = 120, reenvios = 30 }) {
  if (!catalogo.length) throw new Error('El catálogo de prueba está vacío');
  const azar = generador(semilla);
  const entero = (n) => Math.floor(azar() * n);
  const lista = [];
  for (let i = 1; i <= ventas; i += 1) {
    const lineas = [];
    const cantidad = 1 + entero(4);
    for (let j = 0; j < cantidad; j += 1) {
      const p = catalogo[entero(catalogo.length)];
      const milesimas = UNIDADES_ENTERAS.has(p.unidadMedida) ? 1000 * (1 + entero(3)) : 1 + entero(2500);
      lineas.push(p.codigoBarras && azar() < 0.5 ? { codigoBarras: p.codigoBarras, milesimas } : { productoId: p.productoId, milesimas });
    }
    lista.push({ referencia: `SIM-${semilla}-${String(i).padStart(4, '0')}`, lineas });
  }

  const tandas = [];
  for (let i = 0; i < lista.length; i += TAMANO_TANDA) {
    tandas.push(lista.slice(i, i + TAMANO_TANDA).map((venta) => ({ venta, tipo: 'primero', invertir: false })));
  }
  const tardios = [];
  for (let r = 0; r < reenvios; r += 1) {
    const indice = entero(lista.length);
    const envio = { venta: lista[indice], tipo: 'reenvio', invertir: r % 3 === 0 };
    if (r < Math.ceil(reenvios / 2)) tandas[Math.floor(indice / TAMANO_TANDA)].push(envio);
    else tardios.push(envio);
  }
  for (let i = 0; i < tardios.length; i += TAMANO_TANDA) tandas.push(tardios.slice(i, i + TAMANO_TANDA));
  return { ventas: lista, tandas };
}

// Cuerpo del pedido de HU22 para una venta.
export function cuerpoVenta(venta, { invertir = false, referencia = venta.referencia } = {}) {
  const lineas = invertir ? [...venta.lineas].reverse() : venta.lineas;
  return {
    referencia,
    lineas: lineas.map((l) =>
      l.codigoBarras !== undefined
        ? { codigoBarras: l.codigoBarras, cantidad: deMilesimas(l.milesimas) }
        : { productoId: l.productoId, cantidad: deMilesimas(l.milesimas) },
    ),
  };
}

// --- Stock esperado independiente ---------------------------------------------

// Cantidades de una venta por producto, en milésimas, resolviendo los códigos
// de barras con el catálogo de prueba conocido.
export function descuentosDeVenta(venta, catalogo) {
  const porCodigo = new Map(catalogo.map((p) => [p.codigoBarras, p.productoId]));
  const total = new Map();
  for (const l of venta.lineas) {
    const id = l.codigoBarras !== undefined ? porCodigo.get(l.codigoBarras) : l.productoId;
    if (id === undefined) throw new Error(`Código de barras fuera del catálogo de prueba: ${l.codigoBarras}`);
    total.set(id, (total.get(id) ?? 0) + l.milesimas);
  }
  return total;
}

// inicial: Map productoId → milésimas. Cada referencia descuenta una sola vez,
// aunque aparezca repetida (los reenvíos no descuentan).
export function stockEsperado(inicial, ventas, catalogo) {
  const esperado = new Map(inicial);
  const vistas = new Set();
  for (const venta of ventas) {
    if (vistas.has(venta.referencia)) continue;
    vistas.add(venta.referencia);
    for (const [id, milesimas] of descuentosDeVenta(venta, catalogo)) {
      if (!esperado.has(id)) throw new Error(`Producto ${id} sin stock inicial`);
      esperado.set(id, esperado.get(id) - milesimas);
    }
  }
  return esperado;
}

// Diferencias producto por producto (en milésimas). Vacía si coinciden.
export function compararStock(esperado, registrado) {
  const ids = [...new Set([...esperado.keys(), ...registrado.keys()])].sort((a, b) => a - b);
  return ids
    .filter((id) => esperado.get(id) !== registrado.get(id))
    .map((id) => ({ productoId: id, esperado: esperado.get(id), registrado: registrado.get(id), diferencia: (registrado.get(id) ?? 0) - (esperado.get(id) ?? 0) }));
}

// --- Envío ---------------------------------------------------------------------

const esperarMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Segundos de Retry-After (entero positivo); si falta o no es válido, 1.
export function segundosDeEspera(valor) {
  const s = Number(valor);
  return Number.isInteger(s) && s > 0 ? s : 1;
}

// Envía las tandas en orden; los envíos de una tanda salen en paralelo. Ante
// un 503 reenvía el mismo cuerpo (misma referencia) después de Retry-After,
// hasta maxReintentos veces. Devuelve un registro por envío lógico.
export async function simular({ base, clave, tandas, fetch = globalThis.fetch, esperar = esperarMs, maxReintentos = 3 }) {
  let intentosHttp = 0;
  const registros = [];

  async function enviar(envio) {
    const cuerpo = JSON.stringify(cuerpoVenta(envio.venta, envio));
    const registro = { referencia: envio.referencia ?? envio.venta.referencia, tipo: envio.tipo, intentos: 0, esperas: [] };
    registros.push(registro);
    for (;;) {
      registro.intentos += 1;
      intentosHttp += 1;
      let res;
      try {
        res = await fetch(`${base}/v1/integracion/salidas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
          body: cuerpo,
        });
      } catch (err) {
        Object.assign(registro, { status: null, error: err.message, completo: false });
        return;
      }
      if (res.status === 503 && registro.intentos <= maxReintentos) {
        const segundos = segundosDeEspera(res.headers.get('retry-after'));
        registro.esperas.push(segundos);
        await esperar(segundos * 1000);
        continue;
      }
      const body = await res.json().catch(() => null);
      Object.assign(registro, {
        status: res.status,
        id: body?.id ?? null,
        repetida: body?.repetida === true,
        completo: res.status === 201 || res.status === 200,
        ...(res.status >= 400 ? { error: body?.error ?? `HTTP ${res.status}` } : {}),
      });
      return;
    }
  }

  for (const tanda of tandas) await Promise.all(tanda.map(enviar));
  return {
    registros,
    intentosHttp,
    enviosLogicos: registros.length,
    ventasUnicas: new Set(registros.map((r) => r.referencia)).size,
    incompletos: registros.filter((r) => !r.completo),
  };
}

// Respuestas por referencia: exactamente un 201, el resto 200 con repetida y
// el mismo id; ids distintos entre referencias. Devuelve los problemas.
export function verificarRespuestas(registros) {
  const problemas = [];
  const porReferencia = new Map();
  for (const r of registros) {
    if (!porReferencia.has(r.referencia)) porReferencia.set(r.referencia, []);
    porReferencia.get(r.referencia).push(r);
  }
  const duenoDelId = new Map();
  for (const [referencia, lista] of porReferencia) {
    const creadas = lista.filter((r) => r.status === 201).length;
    if (creadas !== 1) problemas.push(`${referencia}: ${creadas} respuestas 201 (se esperaba 1)`);
    const otras = lista.filter((r) => r.status !== 201);
    if (otras.some((r) => r.status !== 200 || !r.repetida)) problemas.push(`${referencia}: un reenvío no respondió 200 con repetida`);
    const ids = new Set(lista.map((r) => r.id));
    if (ids.size !== 1) problemas.push(`${referencia}: respuestas con ids distintos (${[...ids].join(', ')})`);
    const id = lista[0].id;
    if (duenoDelId.has(id)) problemas.push(`${referencia} y ${duenoDelId.get(id)} comparten el id ${id}`);
    duenoDelId.set(id, referencia);
  }
  return problemas;
}
