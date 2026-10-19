import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESQUEMA_JSON, lecturaSchema, lineaSchema, VERSION_ESQUEMA } from '../src/ia/esquemaComprobante.js';

// El JSON Schema que ve el modelo y el Zod que valida deben declarar lo mismo.
const clavesZod = (schema) => Object.keys(schema.shape).sort();
const clavesJson = (nodo) => Object.keys(nodo.properties).sort();

test('JSON Schema y Zod declaran los mismos campos en cada nivel', () => {
  assert.deepEqual(clavesJson(ESQUEMA_JSON), clavesZod(lecturaSchema));
  assert.deepEqual(clavesJson(ESQUEMA_JSON.properties.documento), clavesZod(lecturaSchema.shape.documento));
  assert.deepEqual(clavesJson(ESQUEMA_JSON.properties.cabecera), clavesZod(lecturaSchema.shape.cabecera));
  assert.deepEqual(clavesJson(ESQUEMA_JSON.properties.lineas.items), clavesZod(lineaSchema));
});

const NODOS = [
  ESQUEMA_JSON,
  ESQUEMA_JSON.properties.documento,
  ESQUEMA_JSON.properties.cabecera,
  ESQUEMA_JSON.properties.lineas.items,
];

function recorrer(nodo, fn, ruta = '$') {
  fn(nodo, ruta);
  for (const [k, hijo] of Object.entries(nodo.properties ?? {})) recorrer(hijo, fn, `${ruta}.${k}`);
  if (nodo.items) recorrer(nodo.items, fn, `${ruta}[]`);
}

test('los campos obligatorios existen en el esquema', () => {
  for (const nodo of NODOS) {
    for (const r of nodo.required ?? []) assert.ok(clavesJson(nodo).includes(r), r);
  }
});

// Diagnóstico real del 19/10/2026: con gemini-3.8-flash el esquema mínimo es
// aceptado y el anterior (uniones con null, additionalProperties, maxItems)
// dio 400 invalid_request. El esquema enviado se mantiene en tipos simples.
test('el esquema enviado usa solo tipos simples (sin uniones, additionalProperties ni maxItems)', () => {
  const problemas = [];
  recorrer(ESQUEMA_JSON, (nodo, ruta) => {
    if (typeof nodo.type !== 'string') problemas.push(`${ruta}: type no simple`);
    for (const k of ['additionalProperties', 'maxItems', 'anyOf', 'oneOf', 'nullable']) {
      if (k in nodo) problemas.push(`${ruta}: ${k}`);
    }
  });
  assert.deepEqual(problemas, []);
});

test('los datos de lectura no son obligatorios: lo ilegible se omite (nunca se completa)', () => {
  const linea = ESQUEMA_JSON.properties.lineas.items;
  for (const campo of ['codigo', 'descripcion', 'precioUnitario', 'unidad', 'observacion']) {
    assert.ok(!(linea.required ?? []).includes(campo), `${campo} no debe ser obligatorio`);
  }
  assert.deepEqual(ESQUEMA_JSON.properties.cabecera.required ?? [], []);
});

// --- Versión 3: la cantidad se pide solo como texto obligatorio ---

test('v3: el esquema enviado no tiene "cantidad" numérica y exige "cantidadTexto" de texto', () => {
  const linea = ESQUEMA_JSON.properties.lineas.items;
  assert.equal(VERSION_ESQUEMA, 3);
  assert.equal('cantidad' in linea.properties, false);
  assert.equal(linea.properties.cantidadTexto.type, 'string');
  assert.ok(linea.required.includes('cantidadTexto'));
  assert.match(linea.properties.cantidadTexto.description, /Copia exacta del contenido de la celda de cantidad/);
  assert.match(linea.properties.cantidadTexto.description, /Cadena vacía si la celda está vacía o no se lee/);
});

test('v3: Zod exige cantidadTexto como texto y admite "" (celda vacía o ilegible)', () => {
  assert.equal(lineaSchema.safeParse({ ilegible: false }).success, false, 'falta cantidadTexto');
  assert.equal(lineaSchema.safeParse({ cantidadTexto: 12 }).success, false, 'número en lugar de texto');
  assert.equal(lineaSchema.safeParse({ cantidadTexto: null }).success, false, 'null no es la convención');
  assert.equal(lineaSchema.parse({ cantidadTexto: '' }).cantidadTexto, '');
});

test('v3: un campo "cantidad" que envíe el modelo se descarta (el número lo calcula el backend)', () => {
  const r = lineaSchema.parse({ cantidadTexto: '12', cantidad: 99 });
  assert.equal('cantidad' in r, false);
});

test('"unidad" sin ejemplos que induzcan un valor y sin valor por defecto', () => {
  const desc = ESQUEMA_JSON.properties.lineas.items.properties.unidad.description;
  assert.doesNotMatch(desc, /\b(UN|KG|CAJA|PACK)\b/);
  assert.match(desc, /explícitamente/);
  assert.match(desc, /no completar un valor por defecto/);
});

test('Zod mantiene el máximo de líneas aunque el esquema enviado no lo declare', () => {
  const linea = { ilegible: false, cantidadTexto: '1' };
  const lectura = (n) => ({ documento: { legible: true }, cabecera: {}, lineas: Array(n).fill(linea) });
  assert.equal(lecturaSchema.safeParse(lectura(200)).success, true);
  assert.equal(lecturaSchema.safeParse(lectura(201)).success, false);
});

test('Zod toma un campo ausente como null, nunca como 0', () => {
  const r = lineaSchema.parse({ descripcion: 'YERBA', cantidadTexto: '' });
  assert.equal(r.precioUnitario, null);
  assert.equal(r.unidad, null);
  assert.equal(r.ilegible, false);
});

test('Zod rechaza tipos incorrectos', () => {
  assert.equal(lineaSchema.safeParse({ cantidadTexto: '1', precioUnitario: '12' }).success, false);
  assert.equal(lecturaSchema.safeParse({ documento: { legible: 'si' }, cabecera: {}, lineas: [] }).success, false);
});
