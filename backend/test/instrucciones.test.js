import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUCCIONES } from '../src/ia/instrucciones.js';
import { ESQUEMA_JSON } from '../src/ia/esquemaComprobante.js';

const linea = ESQUEMA_JSON.properties.lineas;

test('pide todas las filas de productos, conservándolas aunque haya datos ilegibles', () => {
  assert.match(INSTRUCCIONES, /CADA fila de producto/);
  assert.match(INSTRUCCIONES, /sin saltear ninguna/);
  assert.match(INSTRUCCIONES, /conservá la fila/);
  assert.match(linea.description, /sin saltear ninguna/);
  assert.match(linea.items.description, /aunque algún dato no se lea/);
});

test('prohíbe comentarios o razonamientos dentro de los campos', () => {
  assert.match(INSTRUCCIONES, /No escribas comentarios, explicaciones ni razonamientos/);
  assert.match(linea.items.properties.observacion.description, /Sin explicaciones ni razonamientos/);
});

test('"unidad" igual en instrucciones y esquema: solo si es explícita, sin ejemplos ni valor por defecto', () => {
  const desc = linea.items.properties.unidad.description;
  const regla = INSTRUCCIONES.split('\n').find((l) => l.startsWith('6. '));
  assert.match(regla, /aparece escrita explícitamente/);
  assert.match(regla, /nunca completes un valor por defecto/);
  assert.match(regla, /presentación .* no es la unidad/);
  assert.match(desc, /explícitamente/);
  assert.match(desc, /no completar un valor por defecto/);
  // Sin ejemplos de unidades que puedan inducir un valor.
  for (const texto of [regla, desc]) assert.doesNotMatch(texto, /\b(UN|KG|CAJA|PACK|ML)\b/);
  assert.match(linea.items.properties.descripcion.description, /incluida su presentación/);
});

test('v3: "cantidadTexto" obligatorio, copia de la celda y "" solo para celda vacía o ilegible', () => {
  const regla = INSTRUCCIONES.split('\n').find((l) => l.startsWith('5. '));
  assert.match(regla, /"cantidadTexto" es obligatorio/);
  assert.match(regla, /copiá exactamente el contenido de la celda de cantidad/);
  assert.match(regla, /Si esa celda está vacía o no se lee, escribí "" y marcá "ilegible": true/);
  assert.match(regla, /No calcules la cantidad a partir del importe, del precio ni de otras filas/);
  // La regla general de omisión remite a la excepción y no prohíbe el "" de la regla 5.
  const regla4 = INSTRUCCIONES.split('\n').find((l) => l.startsWith('4. '));
  assert.match(regla4, /única excepción es "cantidadTexto"/);
  assert.doesNotMatch(regla4, /""/);
  assert.doesNotMatch(INSTRUCCIONES, /"cantidad" es/, 'no se pide el número de cantidad');
});

test('ninguna regla pide null ni 0 para datos faltantes', () => {
  assert.doesNotMatch(INSTRUCCIONES, /us[aá] null/i);
  assert.match(INSTRUCCIONES, /Nunca uses 0 ni valores estimados/);
});

test('no incluye valores de documentos concretos ni una cantidad fija de filas', () => {
  const textos = INSTRUCCIONES + JSON.stringify(ESQUEMA_JSON);
  for (const prohibido of ['0099-00001234', '2210', 'GASEOSA', '117.480', 'DISTRIBUIDORA', 'seis', '6 líneas', '6 filas']) {
    assert.ok(!textos.includes(prohibido), prohibido);
  }
  assert.ok(!('minItems' in linea), 'sin cantidad mínima de filas');
});
