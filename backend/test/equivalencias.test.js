import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claveDescripcion,
  claveCodigo,
  buscarEquivalencia,
  planEquivalencia,
  anotarEquivalencias,
} from '../src/modules/comprobantes/comprobantes.equivalencias.js';

test('clave de descripción: mayúsculas, acentos, puntuación, espacios y número con unidad', () => {
  const clave = claveDescripcion('GAS, COLA 500ML');
  for (const variante of ['gas cola 500 ml', '  Gas.  Cola   500ml ', 'GAS - COLA - 500 ML']) {
    assert.equal(claveDescripcion(variante), clave, variante);
  }
  assert.equal(clave, 'gas cola 500ml');
  assert.equal(claveDescripcion('AGUA S/GAS 1,5 L'), 'agua s gas 1.5l');
  assert.equal(claveDescripcion('Aceite girasol 900cc'), 'aceite girasol 900cc');
  // Otra presentación es otra descripción.
  assert.notEqual(claveDescripcion('GAS COLA 2.25L'), clave);
  assert.equal(claveDescripcion('  '), null);
  assert.equal(claveDescripcion(null), null);
});

test('clave de código: sin espacios y en mayúsculas', () => {
  assert.equal(claveCodigo(' ab 12 '), 'AB12');
  assert.equal(claveCodigo('2210'), '2210');
  assert.equal(claveCodigo(''), null);
  assert.equal(claveCodigo(null), null);
});

const eq = (extra) => ({ id: 1, productoId: 10, codigo: null, descripcion: 'gas cola 500ml', vecesConfirmado: 1, ...extra });

test('buscar equivalencia: primero por código, después por descripción', () => {
  const equivalencias = [
    eq({ id: 1, productoId: 10, codigo: '2210', descripcion: 'gas cola 500ml' }),
    eq({ id: 2, productoId: 20, codigo: null, descripcion: 'yerba c p 1kg' }),
  ];
  // Descripción confirmada antes, escrita distinto: se reconoce.
  assert.equal(buscarEquivalencia({ codigo: null, descripcion: 'Yerba C/P 1 KG' }, equivalencias)?.productoId, 20);
  // El código manda aunque la descripción cambie.
  assert.equal(buscarEquivalencia({ codigo: ' 2210', descripcion: 'GASEOSA COLA X 500' }, equivalencias)?.productoId, 10);
  // Un código desconocido no impide reconocer la descripción.
  assert.equal(buscarEquivalencia({ codigo: '9999', descripcion: 'GAS, COLA 500ML' }, equivalencias)?.productoId, 10);
  assert.equal(buscarEquivalencia({ codigo: null, descripcion: 'GALL RELL CHOC 118G' }, equivalencias), null);
  assert.equal(buscarEquivalencia({ codigo: null, descripcion: null }, equivalencias), null);
});

test('registrar: la primera confirmación crea la equivalencia con contador 1', () => {
  const ahora = new Date('2026-11-14T12:00:00Z');
  assert.deepEqual(planEquivalencia({ codigo: '2210', descripcion: 'GAS, COLA 500ML', productoId: 10 }, {}, ahora), {
    crear: { productoId: 10, codigo: '2210', descripcion: 'gas cola 500ml', vecesConfirmado: 1, ultimaVez: ahora },
  });
});

test('registrar: confirmar de nuevo el mismo producto suma al contador', () => {
  const plan = planEquivalencia({ codigo: null, descripcion: 'gas cola 500 ml', productoId: 10 }, { porDescripcion: eq({ vecesConfirmado: 3 }) });
  assert.equal(plan.actualizar.id, 1);
  assert.equal(plan.actualizar.data.productoId, 10);
  assert.equal(plan.actualizar.data.vecesConfirmado, 4);
  assert.equal(plan.liberarCodigoDe, null);
});

test('registrar: si la persona eligió otro producto, la descripción pasa a ese (nunca apunta a dos)', () => {
  const plan = planEquivalencia({ codigo: null, descripcion: 'GAS COLA 500ML', productoId: 99 }, { porDescripcion: eq({ vecesConfirmado: 5 }) });
  // Se actualiza la misma fila: no se crea otra para la misma descripción.
  assert.equal(plan.crear, undefined);
  assert.equal(plan.actualizar.id, 1);
  assert.equal(plan.actualizar.data.productoId, 99);
  assert.equal(plan.actualizar.data.vecesConfirmado, 1);
});

test('registrar: el código conserva el último dato y pasa a la descripción más reciente', () => {
  // Sin código en la línea: se mantiene el que ya tenía.
  assert.equal(
    planEquivalencia({ codigo: null, descripcion: 'gas cola 500ml', productoId: 10 }, { porDescripcion: eq({ codigo: '2210' }) }).actualizar.data.codigo,
    '2210',
  );
  // El código 2210 estaba en otra fila: se libera allí y queda en la de esta descripción.
  const plan = planEquivalencia(
    { codigo: '2210', descripcion: 'gas cola 500ml', productoId: 10 },
    { porDescripcion: eq({ id: 1 }), porCodigo: eq({ id: 7, codigo: '2210', descripcion: 'gaseosa cola' }) },
  );
  assert.equal(plan.liberarCodigoDe, 7);
  assert.equal(plan.actualizar.id, 1);
  assert.equal(plan.actualizar.data.codigo, '2210');
  // Encontrada solo por código: el proveedor cambió la descripción del artículo.
  const renombrada = planEquivalencia({ codigo: '2210', descripcion: 'GASEOSA COLA PET 500', productoId: 10 }, { porCodigo: eq({ id: 7, codigo: '2210' }) });
  assert.equal(renombrada.actualizar.id, 7);
  assert.equal(renombrada.actualizar.data.descripcion, 'gaseosa cola pet 500');
  assert.equal(renombrada.liberarCodigoDe, null);
});

test('registrar: sin descripción leída o sin producto no se guarda nada', () => {
  assert.equal(planEquivalencia({ codigo: '2210', descripcion: null, productoId: 10 }), null);
  assert.equal(planEquivalencia({ codigo: null, descripcion: 'gas cola', productoId: null }), null);
});

test('flujo: confirmar, confirmar otra vez y corregir el producto', () => {
  // Simula la tabla de un proveedor a lo largo de tres confirmaciones.
  let tabla = [];
  const confirmar = (linea) => {
    const d = claveDescripcion(linea.descripcion);
    const plan = planEquivalencia(linea, { porDescripcion: tabla.find((e) => e.descripcion === d) ?? null });
    if (plan.crear) tabla.push({ id: tabla.length + 1, ...plan.crear });
    else tabla = tabla.map((e) => (e.id === plan.actualizar.id ? { ...e, ...plan.actualizar.data } : e));
  };
  confirmar({ codigo: null, descripcion: 'YERBA C/P 1KG', productoId: 3 });
  assert.equal(buscarEquivalencia({ descripcion: 'YERBA C/P 1KG' }, tabla).productoId, 3);
  confirmar({ codigo: null, descripcion: 'yerba c/p 1 kg', productoId: 3 });
  assert.equal(tabla.length, 1);
  assert.equal(tabla[0].vecesConfirmado, 2);
  confirmar({ codigo: null, descripcion: 'YERBA C/P 1KG', productoId: 8 });
  assert.equal(tabla.length, 1);
  assert.deepEqual([tabla[0].productoId, tabla[0].vecesConfirmado], [8, 1]);
});

test('marca "Recordado": solo propuestas vigentes que coinciden con la equivalencia', () => {
  const equivalencias = [eq({ productoId: 10, codigo: '2210', vecesConfirmado: 3 })];
  const linea = (extra) => ({ codigoExtraido: '2210', descripcionExtraida: 'GAS, COLA 500ML', productoId: 10, confianza: '1.000', ...extra });
  const [propuesta, elegida, otroProducto, manual] = anotarEquivalencias(
    [linea(), linea({ confianza: null }), linea({ productoId: 11, confianza: '0.900' }), linea({ agregadaManualmente: true })],
    equivalencias,
  );
  assert.deepEqual(propuesta.equivalencia, { vecesConfirmado: 3 });
  assert.equal(elegida.equivalencia, null);
  assert.equal(otroProducto.equivalencia, null);
  assert.equal(manual.equivalencia, null);
});
