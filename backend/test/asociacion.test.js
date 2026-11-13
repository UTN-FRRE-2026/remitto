import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  palabras,
  medidasCompatibles,
  parecidoPalabra,
  similitud,
  proponerAsociacion,
  esDudosa,
  UMBRAL_CONFIANZA,
} from '../src/modules/comprobantes/comprobantes.asociacion.js';
import { cambiosDeDetalle, evaluarRevision } from '../src/modules/comprobantes/comprobantes.revision.js';

// Catálogo como el del seed (solo productos activos).
const catalogo = [
  'Gaseosa cola 500 ml',
  'Alfajor triple chocolate',
  'Yerba mate con palo 1 kg',
  'Papas fritas clásicas 80 g',
  'Leche entera 1 l',
  'Galletitas rellenas chocolate 118 g',
  'Agua sin gas 1,5 l',
  'Aceite de girasol 900 ml',
  'Pan lactal grande',
].map((nombre, i) => ({ id: i + 1, nombre, codigoBarras: i === 0 ? '7790001000012' : null }));
const nombre = (id) => catalogo.find((p) => p.id === id)?.nombre;
const proponer = (descripcion, codigo = null, productos = catalogo) => proponerAsociacion({ codigo, descripcion }, productos);

test('palabras: minúsculas, sin acentos, abreviaturas c/ y s/ y medidas unificadas', () => {
  assert.deepEqual(palabras('AGUA S/GAS 1.5L'), ['agua', 'sin', 'gas', '1.5l']);
  assert.deepEqual(palabras('Agua sin gas 1,5 l'), ['agua', 'sin', 'gas', '1.5l']);
  assert.deepEqual(palabras('YERBA C/P 1KG'), ['yerba', 'con', 'p', '1kg']);
  assert.deepEqual(palabras('Papas fritas clásicas 80 g'), ['papas', 'fritas', 'clasicas', '80g']);
  assert.deepEqual(palabras('Aceite de girasol 900CC'), ['aceite', 'girasol', '900ml']);
  assert.deepEqual(palabras(null), []);
});

test('coincidencias claras: las abreviaturas de un remito se asocian con confianza alta', () => {
  const casos = [
    ['GAS, COLA 500ML', 'Gaseosa cola 500 ml'],
    ['YERBA C/P 1KG', 'Yerba mate con palo 1 kg'],
    ['GALL, RELL, CHOC 118G', 'Galletitas rellenas chocolate 118 g'],
    ['ALF, TRIPLE CHOC', 'Alfajor triple chocolate'],
    ['PAPAS FRIT, CLAS 80G', 'Papas fritas clásicas 80 g'],
    ['AGUA S/GAS 1.5L', 'Agua sin gas 1,5 l'],
    ['ACEITE GIRASOL 900CC', 'Aceite de girasol 900 ml'],
  ];
  for (const [leido, esperado] of casos) {
    const r = proponer(leido);
    assert.equal(nombre(r.productoId), esperado, leido);
    assert.ok(r.confianza >= UMBRAL_CONFIANZA, `${leido}: ${r.confianza}`);
    assert.equal(esDudosa(r), false, leido);
  }
});

test('código impreso igual al código de barras: confianza 1 aunque la descripción no ayude', () => {
  assert.deepEqual(proponer('ART. 123', '7790001000012'), { productoId: 1, confianza: 1 });
  // Un código interno corto del proveedor no se compara con códigos de barras.
  assert.notEqual(proponer('DETERGENTE', '2210').confianza, 1);
});

test('coincidencia dudosa: dos productos casi igual de parecidos → se propone, pero se destaca', () => {
  const conDosLeches = [...catalogo, { id: 99, nombre: 'Leche descremada 1 l', codigoBarras: null }];
  const r = proponer('LECHE 1L', null, conDosLeches);
  assert.ok([5, 99].includes(r.productoId));
  assert.ok(r.confianza < UMBRAL_CONFIANZA && r.confianza >= 0.5, String(r.confianza));
  assert.equal(esDudosa(r), true);
});

test('empate perfecto: dos productos activos igual de compatibles, sin código de barras → queda destacada', () => {
  // Mismo nombre, o nombres que se normalizan igual: los dos puntúan 1.
  const pares = [
    [{ id: 1, nombre: 'Agua sin gas 1,5 l' }, { id: 2, nombre: 'Agua sin gas 1,5 l' }],
    [{ id: 1, nombre: 'Agua sin gas 1,5 l' }, { id: 2, nombre: 'AGUA S/GAS 1.5L' }],
  ];
  for (const productos of pares) {
    // Ante un empate exacto se propone siempre el de menor id, en cualquier orden.
    assert.equal(proponer('AGUA S/GAS 1.5L', null, [...productos].reverse()).productoId, 1);
    const r = proponer('AGUA S/GAS 1.5L', null, productos);
    assert.equal(r.productoId, 1);
    assert.ok(r.confianza < UMBRAL_CONFIANZA, `empate con confianza ${r.confianza}`);
    assert.equal(esDudosa(r), true);
  }
  // Con código de barras que distingue a uno, ya no es ambigua.
  const conCodigo = [{ id: 1, nombre: 'Agua sin gas 1,5 l', codigoBarras: '7790000000111' }, { id: 2, nombre: 'Agua sin gas 1,5 l' }];
  assert.deepEqual(proponer('AGUA S/GAS 1.5L', '7790000000111', conCodigo), { productoId: 1, confianza: 1 });
});

test('sin coincidencia: producto inexistente o de otra medida → sin propuesta, confianza 0 (se propone el alta)', () => {
  for (const leido of ['DETERGENTE LIMON 750ML', 'FIDEOS TALLARIN 500G', 'GASEOSA COLA 2.25L', 'GALLETITAS DE AGUA']) {
    const r = proponer(leido);
    assert.deepEqual(r, { productoId: null, confianza: 0 }, leido);
    assert.equal(esDudosa(r), true, leido);
  }
  // Catálogo vacío.
  assert.deepEqual(proponer('GAS, COLA 500ML', null, []), { productoId: null, confianza: 0 });
});

test('una medida distinta reduce el parecido a la mitad', () => {
  assert.ok(similitud('GASEOSA COLA 2.25L', 'Gaseosa cola 500 ml') < similitud('GASEOSA COLA', 'Gaseosa cola 500 ml') / 1.5);
});

test('línea sin descripción ni código: no hay nada que buscar y no se destaca por asociación', () => {
  const r = proponer(null);
  assert.deepEqual(r, { productoId: null, confianza: null });
  assert.equal(esDudosa(r), false);
});

test('correcciones de la persona: elegir o quitar el producto deja la confianza en null', () => {
  assert.deepEqual(cambiosDeDetalle({ productoId: 7 }), { productoId: 7, confianza: null });
  assert.deepEqual(cambiosDeDetalle({ productoId: null }), { productoId: null, confianza: null });
  // Editar cantidad o precio, o descartar, no toca la asociación propuesta.
  assert.deepEqual(cambiosDeDetalle({ cantidad: 3, precioUnitario: 10 }), { cantidad: 3, precioUnitario: 10 });
  assert.deepEqual(cambiosDeDetalle({ descartada: true }), { estado: 'DESCARTADO' });
  // Una asociación elegida por la persona no se marca como dudosa.
  assert.equal(esDudosa({ productoId: 7, confianza: null }), false);
});

const producto = { id: 1, nombre: 'Yerba', unidadMedida: 'UNIDAD', activo: true };
const linea = (extra = {}) => ({ nroLinea: 1, estado: 'PROPUESTO', productoId: 1, producto, cantidad: '12', precioUnitario: '10', ...extra });
const comprobante = (detalles) => ({ estado: 'EN_REVISION', numero: 'R-1', fechaEmision: new Date(), totalDeclarado: null, detalles });

test('validación: una propuesta dudosa avisa pero no impide confirmar; una confiable o elegida no avisa', () => {
  const dudosa = evaluarRevision(comprobante([linea({ confianza: '0.720' })]));
  assert.equal(dudosa.completo, true);
  assert.deepEqual(dudosa.avisos.filter((a) => a.campo === 'productoId').map((a) => a.mensaje), [
    'Línea 1: revisá el producto propuesto (confianza 72 %).',
  ]);
  for (const confianza of ['0.950', null]) {
    const r = evaluarRevision(comprobante([linea({ confianza })]));
    assert.equal(r.avisos.some((a) => a.campo === 'productoId'), false, String(confianza));
  }
});

test('validación: sin coincidencia en el catálogo impide confirmar y sugiere el alta', () => {
  const r = evaluarRevision(comprobante([linea({ productoId: null, producto: null, confianza: '0.000' })]));
  assert.equal(r.completo, false);
  assert.match(r.problemas[0].mensaje, /no hay un producto parecido en el catálogo; asociá uno o dalo de alta/);
  // Una línea agregada a mano sin producto conserva el mensaje anterior.
  const manual = evaluarRevision(comprobante([linea({ productoId: null, producto: null, confianza: null })]));
  assert.match(manual.problemas[0].mensaje, /falta asociar un producto/);
});

// --- Ajustes de la revisión del 13/11/2026 ---

const catalogoAmplio = [
  ...catalogo,
  ...['Azúcar 1 kg', 'Harina 000 1 kg', 'Harina 0000 1 kg', 'Gaseosa cola 2,25 l', 'Detergente 500 cc'].map((nombre, i) => ({
    id: 100 + i,
    nombre,
    codigoBarras: null,
  })),
];
const proponerAmplio = (d) => proponerAsociacion({ codigo: null, descripcion: d }, catalogoAmplio);
const nombreAmplio = (id) => catalogoAmplio.find((p) => p.id === id)?.nombre;

test('medidas: conversiones, números sin unidad y formas de escribirlas', () => {
  assert.deepEqual(palabras('HARINA 1.000 GR'), ['harina', '1000g']); // punto de miles
  assert.deepEqual(palabras('DETERGENTE 500 C.C.'), ['detergente', '500ml']);
  assert.deepEqual(palabras('AZUCAR 1/2 KG'), ['azucar', '0.5kg']);
  assert.equal(medidasCompatibles('1500ml', '1.5l'), true);
  assert.equal(medidasCompatibles('1000g', '1kg'), true);
  assert.equal(medidasCompatibles('500', '500ml'), true); // número sin unidad
  assert.equal(medidasCompatibles('2.25', '2.25l'), true);
  assert.equal(medidasCompatibles('500ml', '500g'), false); // otra magnitud
  assert.equal(medidasCompatibles('000', '0000'), false); // la harina 000 no es la 0000
});

test('medidas: se asocian aunque estén escritas distinto', () => {
  const casos = [
    ['GASEOSA COLA 500', 'Gaseosa cola 500 ml'],
    ['AGUA S/GAS 1500ML', 'Agua sin gas 1,5 l'],
    ['AZUCAR 1000G', 'Azúcar 1 kg'],
    ['HARINA 000 1.000 GR', 'Harina 000 1 kg'],
    ['HARINA 0000 1KG', 'Harina 0000 1 kg'],
    ['DETERGENTE 500 C.C.', 'Detergente 500 cc'],
  ];
  for (const [leido, esperado] of casos) {
    const r = proponerAmplio(leido);
    assert.equal(nombreAmplio(r.productoId), esperado, leido);
    assert.ok(r.confianza >= UMBRAL_CONFIANZA, `${leido}: ${r.confianza}`);
  }
  // Otro tamaño no se propone: se sugiere el alta.
  assert.deepEqual(proponerAmplio('AZUCAR 1/2 KG'), { productoId: null, confianza: 0 });
});

test('variantes: una palabra leída que el producto no tiene nunca da una propuesta confiable', () => {
  const casos = [
    ['YERBA MATE SIN PALO 1KG', 'Yerba mate con palo 1 kg'],
    ['ALFAJOR TRIPLE CHOCOLATE BLANCO', 'Alfajor triple chocolate'],
    ['GASEOSA COLA LIGHT 500ML', 'Gaseosa cola 500 ml'],
  ];
  for (const [leido, propuesto] of casos) {
    const r = proponerAmplio(leido);
    assert.equal(nombreAmplio(r.productoId), propuesto, leido); // se propone…
    assert.ok(r.confianza < UMBRAL_CONFIANZA, `${leido}: ${r.confianza}`); // …pero se destaca
    assert.equal(esDudosa(r), true, leido);
  }
});

test('descripciones que cubren poco del nombre (una sola palabra) se destacan', () => {
  for (const leido of ['COLA', 'ENTERA', 'GIRASOL']) {
    const r = proponerAmplio(leido);
    assert.ok(r.productoId, leido);
    assert.equal(esDudosa(r), true, `${leido}: ${r.confianza}`);
  }
});

test('abreviaturas: lo leído abrevia al producto, no al revés con palabras cortas', () => {
  assert.equal(parecidoPalabra('gall', 'galletitas'), 0.9);
  assert.equal(parecidoPalabra('panales', 'pan'), 0); // "PAÑALES" no es "Pan"
  assert.equal(parecidoPalabra('galletitas', 'gall'), 0.8); // nombre abreviado en el catálogo
  assert.deepEqual(proponerAmplio('PAÑALES'), { productoId: null, confianza: 0 });
  assert.deepEqual(proponerAmplio('PAÑALES PAMPERS G'), { productoId: null, confianza: 0 });
});

test('envases y multiplicadores no cuentan como variantes', () => {
  assert.deepEqual(palabras('GAS, COLA 500ML X6 PACK'), ['gas', 'cola', '500ml']);
  const r = proponerAmplio('LECHE ENTERA 1L PACK');
  assert.equal(nombreAmplio(r.productoId), 'Leche entera 1 l');
  assert.ok(r.confianza >= UMBRAL_CONFIANZA);
});
