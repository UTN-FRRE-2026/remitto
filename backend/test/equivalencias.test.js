import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claveDescripcion,
  claveCodigo,
  buscarEquivalencia,
  planEquivalencia,
  anotarEquivalencias,
  elegirPropuesta,
  CONFIANZA_DUDOSA,
} from '../src/modules/comprobantes/comprobantes.equivalencias.js';
import { UMBRAL_CONFIANZA } from '../src/modules/comprobantes/comprobantes.asociacion.js';

test('clave de descripción: mayúsculas, acentos, puntuación, espacios y número con unidad', () => {
  const clave = claveDescripcion('GAS, COLA 500ML');
  for (const variante of ['gas cola 500 ml', '  Gas.  Cola   500ml ', 'GAS - COLA - 500 ML']) {
    assert.equal(claveDescripcion(variante), clave, variante);
  }
  assert.equal(clave, 'gas cola 500ml');
  assert.equal(claveDescripcion('AGUA S/GAS 1,5 L'), 'agua s gas 1.5l');
  assert.notEqual(claveDescripcion('GAS COLA 2.25L'), clave);
  assert.equal(claveDescripcion('  '), null);
  assert.equal(claveDescripcion(null), null);
});

test('clave de código: sin espacios y en mayúsculas', () => {
  assert.equal(claveCodigo(' ab 12 '), 'AB12');
  assert.equal(claveCodigo(''), null);
  assert.equal(claveCodigo(null), null);
});

test('la confianza dudosa queda por debajo del umbral', () => {
  assert.ok(CONFIANZA_DUDOSA < UMBRAL_CONFIANZA);
});

// Simula la tabla de un proveedor: aplica los planes como lo hace registrarEquivalencias.
function tablaDeProveedor() {
  let filas = [];
  let reloj = 0;
  return {
    get filas() {
      return filas;
    },
    confirmar({ codigo = null, descripcion, productoId }) {
      reloj += 1;
      const c = claveCodigo(codigo);
      const d = claveDescripcion(descripcion);
      const plan = planEquivalencia(
        { codigo, descripcion, productoId },
        {
          porCodigo: (c && filas.find((f) => f.codigo === c)) || null,
          porDescripcion: filas.find((f) => f.codigo === null && f.descripcion === d) ?? null,
        },
        new Date(Date.UTC(2026, 10, 14, 0, 0, reloj)),
      );
      for (const op of [plan.porCodigo, plan.porDescripcion]) {
        if (!op) continue;
        if (op.crear) filas.push({ id: filas.length + 1, ...op.crear });
        else filas = filas.map((f) => (f.id === op.actualizar.id ? { ...f, ...op.actualizar.data } : f));
      }
    },
    leer: (linea) => buscarEquivalencia(linea, filas),
  };
}

test('registrar: crea una fila por código y otra por descripción, con contador 1', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: '2210', descripcion: 'GAS, COLA 500ML', productoId: 10 });
  assert.deepEqual(
    t.filas.map((f) => [f.codigo, f.descripcion, f.productoId, f.vecesConfirmado]),
    [
      ['2210', 'gas cola 500ml', 10, 1],
      [null, 'gas cola 500ml', 10, 1],
    ],
  );
});

test('buscar: el código manda; sin código, la descripción confirmada (criterio 1)', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: '2210', descripcion: 'GAS, COLA 500ML', productoId: 10 });
  t.confirmar({ codigo: null, descripcion: 'YERBA C/P 1KG', productoId: 20 });
  assert.deepEqual(t.leer({ codigo: ' 2210', descripcion: 'GASEOSA COLA X 500' }), { productoId: 10, confianza: 1, vecesConfirmado: 1, motivo: 'codigo' });
  assert.deepEqual(t.leer({ codigo: null, descripcion: 'Yerba C/P 1 KG' }), { productoId: 20, confianza: 1, vecesConfirmado: 1, motivo: 'descripcion' });
  assert.equal(t.leer({ codigo: null, descripcion: 'GALL RELL CHOC 118G' }), null);
  assert.equal(t.leer({ codigo: null, descripcion: null }), null);
});

test('regresión caso 1: el mismo código con otra descripción no borra la descripción anterior', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: 'ABC01', descripcion: 'DESCRIPCION A', productoId: 10 });
  t.confirmar({ codigo: 'ABC01', descripcion: 'DESCRIPCION B', productoId: 10 });
  assert.deepEqual(t.leer({ codigo: null, descripcion: 'DESCRIPCION A' }), { productoId: 10, confianza: 1, vecesConfirmado: 1, motivo: 'descripcion' });
  assert.equal(t.leer({ codigo: null, descripcion: 'DESCRIPCION B' }).productoId, 10);
  // El código sumó las dos confirmaciones.
  assert.deepEqual(t.leer({ codigo: 'ABC01', descripcion: 'OTRA' }), { productoId: 10, confianza: 1, vecesConfirmado: 2, motivo: 'codigo' });
});

test('regresión caso 2: dos códigos con la misma descripción y distinto producto', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: 'LE01', descripcion: 'LECHE 1 L', productoId: 10 });
  t.confirmar({ codigo: 'LE02', descripcion: 'LECHE 1 L', productoId: 20 });
  // Cada código conserva su producto.
  assert.deepEqual(t.leer({ codigo: 'LE01', descripcion: 'LECHE 1 L' }), { productoId: 10, confianza: 1, vecesConfirmado: 1, motivo: 'codigo' });
  assert.equal(t.leer({ codigo: 'LE02', descripcion: 'LECHE 1 L' }).productoId, 20);
  // Sin código, o con un código nuevo, la descripción es ambigua: se propone, pero para revisar.
  for (const codigo of [null, 'LE03']) {
    const r = t.leer({ codigo, descripcion: 'LECHE 1 L' });
    assert.equal(r.motivo, 'ambigua', String(codigo));
    assert.equal(r.confianza, CONFIANZA_DUDOSA);
    assert.ok(r.confianza < UMBRAL_CONFIANZA);
  }
});

test('código nuevo con una descripción conocida y no ambigua: se propone para revisar', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: 'LE01', descripcion: 'LECHE 1 L', productoId: 10 });
  const r = t.leer({ codigo: 'LE09', descripcion: 'LECHE 1 L' });
  assert.deepEqual([r.productoId, r.motivo, r.confianza], [10, 'codigo-nuevo', CONFIANZA_DUDOSA]);
});

test('contador y corrección: confirmar de nuevo suma; elegir otro producto lo reemplaza (criterio 2)', () => {
  const t = tablaDeProveedor();
  t.confirmar({ descripcion: 'YERBA C/P 1KG', productoId: 3 });
  t.confirmar({ descripcion: 'yerba c/p 1 kg', productoId: 3 });
  assert.equal(t.filas.length, 1);
  assert.equal(t.filas[0].vecesConfirmado, 2);
  t.confirmar({ descripcion: 'YERBA C/P 1KG', productoId: 8 });
  assert.equal(t.filas.length, 1);
  assert.deepEqual([t.filas[0].productoId, t.filas[0].vecesConfirmado], [8, 1]);
  assert.deepEqual(t.leer({ descripcion: 'YERBA C/P 1KG' }), { productoId: 8, confianza: 1, vecesConfirmado: 1, motivo: 'descripcion' });
  // Corregir el producto de un código también lo reemplaza.
  t.confirmar({ codigo: 'Y1', descripcion: 'YERBA C/P 1KG', productoId: 8 });
  t.confirmar({ codigo: 'Y1', descripcion: 'YERBA C/P 1KG', productoId: 9 });
  assert.deepEqual([t.leer({ codigo: 'Y1', descripcion: null }).productoId, t.leer({ codigo: 'Y1', descripcion: null }).vecesConfirmado], [9, 1]);
});

test('si la fila por descripción falta (producto desactivado), se usa la fila por código más reciente', () => {
  const filas = [
    { productoId: 10, codigo: 'A1', descripcion: 'leche 1l', vecesConfirmado: 2, ultimaVez: new Date('2026-11-01') },
    { productoId: 10, codigo: 'A2', descripcion: 'leche 1l', vecesConfirmado: 1, ultimaVez: new Date('2026-11-10') },
  ];
  assert.deepEqual(buscarEquivalencia({ codigo: null, descripcion: 'LECHE 1L' }, filas), { productoId: 10, vecesConfirmado: 1, confianza: 1, motivo: 'descripcion' });
});

test('registrar: sin descripción leída o sin producto no se guarda nada', () => {
  assert.equal(planEquivalencia({ codigo: '2210', descripcion: null, productoId: 10 }), null);
  assert.equal(planEquivalencia({ codigo: null, descripcion: 'gas cola', productoId: null }), null);
});

test('marca "Recordado": solo propuestas vigentes y confiables que coinciden con la equivalencia', () => {
  const t = tablaDeProveedor();
  t.confirmar({ codigo: '2210', descripcion: 'GAS, COLA 500ML', productoId: 10 });
  t.confirmar({ codigo: '2210', descripcion: 'GAS, COLA 500ML', productoId: 10 });
  t.confirmar({ codigo: 'LE01', descripcion: 'LECHE 1 L', productoId: 30 });
  t.confirmar({ codigo: 'LE02', descripcion: 'LECHE 1 L', productoId: 31 });
  const linea = (extra) => ({ codigoExtraido: '2210', descripcionExtraida: 'GAS, COLA 500ML', productoId: 10, confianza: '1.000', ...extra });
  const [propuesta, elegida, otroProducto, manual, ambigua] = anotarEquivalencias(
    [
      linea(),
      linea({ confianza: null }),
      linea({ productoId: 11, confianza: '0.900' }),
      linea({ agregadaManualmente: true }),
      linea({ codigoExtraido: null, descripcionExtraida: 'LECHE 1 L', productoId: 31, confianza: String(CONFIANZA_DUDOSA) }),
    ],
    t.filas,
  );
  assert.deepEqual(propuesta.equivalencia, { vecesConfirmado: 2 });
  assert.equal(elegida.equivalencia, null);
  assert.equal(otroProducto.equivalencia, null);
  assert.equal(manual.equivalencia, null);
  assert.equal(ambigua.equivalencia, null, 'una equivalencia ambigua no se marca como recordada');
});

// --- Precedencia entre equivalencias (HU16) y catálogo (HU15) ---

test('una equivalencia segura manda sobre el catálogo', () => {
  const segura = { productoId: 1, confianza: 1, motivo: 'descripcion' };
  assert.deepEqual(elegirPropuesta(segura, { productoId: 2, confianza: 1 }), { productoId: 1, confianza: 1 });
});

test('una equivalencia dudosa no tapa un código de barras exacto del catálogo', () => {
  // «GAS COLA 500» se confirmó con el producto 1, pero la línea trae el EAN del 2.
  const dudosa = { productoId: 1, confianza: CONFIANZA_DUDOSA, motivo: 'codigo-nuevo' };
  assert.deepEqual(elegirPropuesta(dudosa, { productoId: 2, confianza: 1 }), { productoId: 2, confianza: 1 });
  // Lo mismo con una coincidencia confiable por descripción.
  assert.deepEqual(elegirPropuesta(dudosa, { productoId: 3, confianza: 0.9 }), { productoId: 3, confianza: 0.9 });
});

test('si el catálogo no es confiable, se usa la equivalencia dudosa', () => {
  const ambigua = { productoId: 1, confianza: CONFIANZA_DUDOSA, motivo: 'ambigua' };
  assert.deepEqual(elegirPropuesta(ambigua, { productoId: 2, confianza: 0.6 }), { productoId: 1, confianza: CONFIANZA_DUDOSA });
  assert.deepEqual(elegirPropuesta(ambigua, { productoId: null, confianza: 0 }), { productoId: 1, confianza: CONFIANZA_DUDOSA });
  assert.ok(CONFIANZA_DUDOSA < UMBRAL_CONFIANZA);
});

test('sin equivalencia, queda la propuesta del catálogo', () => {
  assert.deepEqual(elegirPropuesta(null, { productoId: 2, confianza: 0.6 }), { productoId: 2, confianza: 0.6 });
  assert.deepEqual(elegirPropuesta(null, { productoId: null, confianza: null }), { productoId: null, confianza: null });
});
