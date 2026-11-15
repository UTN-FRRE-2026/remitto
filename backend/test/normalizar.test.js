import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lecturaSchema } from '../src/ia/esquemaComprobante.js';
import {
  normalizarLectura,
  interpretarNumeroAr,
  interpretarCantidad,
  normalizarNumero,
  textoSospechoso,
} from '../src/ia/normalizar.js';

const HOY = new Date(2026, 9, 19);

function lectura({ documento = {}, cabecera = {}, lineas = [] } = {}) {
  return lecturaSchema.parse({
    documento: { legible: true, motivoIlegible: null, manuscrito: false, bajaCalidad: false, ...documento },
    cabecera: {
      tipo: 'REMITO',
      numero: '0001-00045872',
      fechaEmision: '2026-09-28',
      totalDeclarado: null,
      totalTexto: null,
      proveedorNombre: null,
      proveedorCuit: null,
      ...cabecera,
    },
    lineas,
  });
}

// Forma del esquema v3: la cantidad llega solo como texto de la celda; sin
// unidad salvo que la prueba la indique.
const linea = (extra = {}) => ({
  codigo: '3301',
  descripcion: 'YERBA C/P 1KG',
  cantidadTexto: '12',
  precioUnitario: 2850,
  precioUnitarioTexto: '2.850,00',
  ilegible: false,
  ...extra,
});

test('interpreta números en formato argentino sin adivinar', () => {
  assert.equal(interpretarNumeroAr('2.850,00'), 2850);
  assert.equal(interpretarNumeroAr('1,5'), 1.5);
  assert.equal(interpretarNumeroAr('12'), 12);
  assert.equal(interpretarNumeroAr('1.250'), 1250);
  assert.equal(interpretarNumeroAr('$ 690,00'), 690);
  assert.equal(interpretarNumeroAr('4?'), null);
  assert.equal(interpretarNumeroAr(null), null);
});

test('normaliza el número de comprobante para comparar', () => {
  assert.equal(normalizarNumero(' N° 0001-00045872 '), '0001-00045872');
  assert.equal(normalizarNumero('0001 - 00045872'), '0001-00045872');
  assert.equal(normalizarNumero(''), null);
});

test('una lectura completa no requiere revisión y precarga los valores', () => {
  const n = normalizarLectura(lectura({ cabecera: { totalDeclarado: 34200 }, lineas: [linea()] }), { hoy: HOY });
  assert.equal(n.requiereRevision, false);
  assert.deepEqual(n.motivosRevision, []);
  const l = n.lineas[0];
  assert.equal(l.nroLinea, 1);
  assert.equal(l.cantidadExtraida, 12);
  assert.equal(l.cantidad, 12);
  assert.equal(l.precioUnitario, 2850);
  assert.equal(n.cabecera.fechaEmision, '2026-09-28');
});

test('no elimina líneas: las vacías o ilegibles se conservan y se marcan', () => {
  const vacia = linea({ codigo: null, descripcion: null, cantidadTexto: '', precioUnitario: null, precioUnitarioTexto: null, ilegible: true });
  const n = normalizarLectura(lectura({ lineas: [linea(), vacia] }), { hoy: HOY });
  assert.equal(n.lineas.length, 2);
  assert.ok(n.lineas[1].motivosRevision.some((m) => m.includes('sin datos')));
  assert.equal(n.requiereRevision, true);
});

test('cantidad 0 se conserva como leída pero no se precarga', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ cantidadTexto: '0' })] }), { hoy: HOY });
  assert.equal(n.lineas[0].cantidadExtraida, 0);
  assert.equal(n.lineas[0].cantidad, null);
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('mayor a 0')));
});

test('cantidad ilegible queda null con el texto original como motivo (nunca 0)', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ cantidadTexto: '4?' })] }), { hoy: HOY });
  assert.equal(n.lineas[0].cantidadExtraida, null);
  assert.equal(n.lineas[0].cantidad, null);
  assert.equal(n.lineas[0].cantidadTexto, '4?', 'el texto original se conserva');
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('«4?»')));
});

// --- v3: cantidad interpretada por el backend desde cantidadTexto ---

test('interpreta cantidades enteras, decimales y con separadores argentinos', () => {
  const casos = [
    ['7', 7],
    ['150', 150],
    [' 9 ', 9],
    ['1,5', 1.5],
    ['0,250', 0.25],
    ['2,75', 2.75],
    ['1.250', 1250],
    ['12.000', 12000],
    ['1.250,5', 1250.5],
    ['3.400,75', 3400.75],
  ];
  for (const [texto, esperado] of casos) assert.equal(interpretarCantidad(texto), esperado, texto);
});

test('cantidad ambigua o con texto no se interpreta (null)', () => {
  for (const texto of ['1.5', '12.34', '1,250.00', '1.25.0', '12 UN', '2 cajas', 'x6', '4?', 'doce', '1/2', '1,', ',5', '--3']) {
    assert.equal(interpretarCantidad(texto), null, texto);
  }
  assert.equal(interpretarCantidad(''), null);
  assert.equal(interpretarCantidad(null), null);
});

test('celda de cantidad vacía ("") → null, requiere revisión y la fila se conserva', () => {
  const n = normalizarLectura(lectura({ lineas: [linea(), linea({ codigo: '8000', cantidadTexto: '', ilegible: true })] }), { hoy: HOY });
  assert.equal(n.lineas.length, 2);
  const l = n.lineas[1];
  assert.equal(l.cantidadExtraida, null);
  assert.equal(l.cantidad, null);
  assert.equal(l.cantidadTexto, '');
  assert.ok(l.motivosRevision.some((m) => m.includes('celda de cantidad está vacía')));
  assert.equal(n.requiereRevision, true);
});

test('cantidad ambigua → null con revisión, conservando el texto', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ cantidadTexto: '1.5' })] }), { hoy: HOY });
  assert.equal(n.lineas[0].cantidad, null);
  assert.equal(n.lineas[0].cantidadTexto, '1.5');
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('no es un número claro')));
});

test('cantidad decimal válida se precarga sin revisión', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ cantidadTexto: '3,5', precioUnitario: 100, precioUnitarioTexto: '100,00' })] }), { hoy: HOY });
  assert.equal(n.lineas[0].cantidadExtraida, 3.5);
  assert.equal(n.lineas[0].cantidad, 3.5);
  assert.deepEqual(n.lineas[0].motivosRevision, []);
});

test('nunca deduce la cantidad desde el importe ni el precio', () => {
  // Total impreso y precio disponibles: aun así la cantidad vacía queda null.
  const n = normalizarLectura(
    lectura({
      cabecera: { totalDeclarado: 5000 },
      lineas: [linea({ cantidadTexto: '', precioUnitario: 250, precioUnitarioTexto: '250,00', ilegible: true })],
    }),
    { hoy: HOY },
  );
  assert.equal(n.lineas[0].cantidad, null);
  assert.equal(n.lineas[0].cantidadExtraida, null);
  assert.ok(n.motivosRevision.some((m) => m.includes('No se pudo verificar el total')));
});

test('sin unidad impresa no se completa ninguna unidad', () => {
  const n = normalizarLectura(lectura({ lineas: [linea()] }), { hoy: HOY });
  assert.equal(n.lineas[0].unidad, null);
});

test('precio 0 sin cero impreso no se acepta; con cero impreso sí', () => {
  const sinCero = normalizarLectura(lectura({ lineas: [linea({ precioUnitario: 0, precioUnitarioTexto: null })] }), { hoy: HOY });
  assert.equal(sinCero.lineas[0].precioUnitario, null);
  const conCero = normalizarLectura(lectura({ lineas: [linea({ precioUnitario: 0, precioUnitarioTexto: '0,00' })] }), { hoy: HOY });
  assert.equal(conCero.lineas[0].precioUnitario, 0);
});

test('precio ausente no inventa valor ni marca revisión por sí solo', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ precioUnitario: null, precioUnitarioTexto: null })] }), { hoy: HOY });
  assert.equal(n.lineas[0].precioUnitario, null);
  assert.deepEqual(n.lineas[0].motivosRevision, []);
});

test('no convierte bultos: conserva la cantidad impresa y pide confirmar', () => {
  const n = normalizarLectura(lectura({ lineas: [linea({ cantidadTexto: '2', unidad: 'CAJA x12' })] }), { hoy: HOY });
  assert.equal(n.lineas[0].cantidad, 2);
  assert.equal(n.lineas[0].unidad, 'CAJA x12');
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('CAJA x12')));
});

test('fecha futura o inválida no se escribe pero queda señalada', () => {
  const futura = normalizarLectura(lectura({ cabecera: { fechaEmision: '2099-01-01' }, lineas: [linea()] }), { hoy: HOY });
  assert.equal(futura.cabecera.fechaEmision, null);
  assert.ok(futura.motivosRevision.some((m) => m.includes('2099-01-01')));
  const invalida = normalizarLectura(lectura({ cabecera: { fechaEmision: '2026-02-30' }, lineas: [linea()] }), { hoy: HOY });
  assert.equal(invalida.cabecera.fechaEmision, null);
  assert.equal(invalida.requiereRevision, true);
});

test('documento ilegible sin líneas se informa como ilegible', () => {
  const n = normalizarLectura(lectura({ documento: { legible: false, motivoIlegible: 'borroso' } }), { hoy: HOY });
  assert.equal(n.ilegible, true);
  assert.equal(n.motivoIlegible, 'borroso');
});

test('manuscrito, baja calidad y total que no coincide piden revisión', () => {
  const n = normalizarLectura(
    lectura({ documento: { manuscrito: true, bajaCalidad: true }, cabecera: { totalDeclarado: 99999 }, lineas: [linea()] }),
    { hoy: HOY },
  );
  assert.equal(n.requiereRevision, true);
  assert.ok(n.motivosRevision.some((m) => m.includes('a mano')));
  assert.ok(n.motivosRevision.some((m) => m.includes('baja calidad')));
  assert.ok(n.motivosRevision.some((m) => m.includes('supera la suma de las líneas leídas')));
});

// --- Correcciones tras la prueba real del comprobante #54 ---

// Respuesta original real de #54 (remito ficticio): una sola fila y
// razonamiento del modelo dentro de "unidad".
const ORIGINAL_54 = {
  documento: { legible: true, manuscrito: false, bajaCalidad: false },
  cabecera: {
    fechaEmision: '2026-10-15',
    numero: '0099-00001234',
    proveedorNombre: 'DISTRIBUIDORA NORTE S.R.L.',
    tipo: 'REMITO',
    totalDeclarado: 117480.0,
    totalTexto: '117.480,00',
  },
  lineas: [
    {
      ilegible: false,
      codigo: '2210',
      descripcion: 'GASEOSA COLA 500ML',
      unidad:
        "500MLDOC_OCR_PRESENTATION_SKIP_IF_NOT_EXPLICIT_UNIT_COLUMN_OR_PART_OF_DESC: no explicit unit column, description has 500ML, but let's check field definition: 'Unidad o presentación impresa, por ejemplo UN, CAJA x12 o KG.' Omit if not present separately, wait, does unit field require omission if in desc?",
    },
  ],
};

// #54 se leyó con el esquema v2 (sin cantidadTexto). Para reutilizarla con las
// reglas actuales se adapta a v3 agregando la celda de cantidad vacía.
const adaptado54 = () => {
  const r = structuredClone(ORIGINAL_54);
  r.lineas = r.lineas.map((l) => ({ ...l, cantidadTexto: '' }));
  return r;
};

test('compatibilidad: una respuesta con forma v2 (sin cantidadTexto) no pasa la validación v3', () => {
  // Las lecturas ya guardadas no se reinterpretan; solo las respuestas nuevas
  // deben cumplir v3. Así una respuesta incompleta no se acepta en silencio.
  assert.equal(lecturaSchema.safeParse(structuredClone(ORIGINAL_54)).success, false);
});

test('#54: la deliberación en "unidad" se señala, no se precarga y la lectura original queda intacta', () => {
  const original = adaptado54();
  const lect = lecturaSchema.parse(original);
  const n = normalizarLectura(lect, { hoy: HOY });
  assert.equal(n.lineas.length, 1, 'no se elimina la fila');
  assert.equal(n.lineas[0].unidad, null);
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('unidad')));
  assert.equal(lect.lineas[0].unidad, ORIGINAL_54.lineas[0].unidad, 'la lectura no se modifica');
  assert.equal(n.requiereRevision, true);
});

test('#54: el total impreso sin líneas que lo justifiquen avisa posibles filas sin leer', () => {
  const n = normalizarLectura(lecturaSchema.parse(adaptado54()), { hoy: HOY });
  assert.ok(n.motivosRevision.some((m) => m.includes('No se pudo verificar el total')));
  assert.ok(n.motivosRevision.some((m) => m.includes('puede haber filas sin leer')));
});

test('la presentación de la descripción (500ML) no se toma como unidad de venta', () => {
  const n = normalizarLectura(
    lectura({ lineas: [linea({ descripcion: 'GASEOSA COLA 500ML', unidad: '500ML' })] }),
    { hoy: HOY },
  );
  assert.equal(n.lineas[0].unidad, null);
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('presentación del producto')));
});

test('una unidad de venta legítima se conserva', () => {
  const un = normalizarLectura(lectura({ lineas: [linea({ unidad: 'UN' })] }), { hoy: HOY });
  assert.equal(un.lineas[0].unidad, 'UN');
  assert.deepEqual(un.lineas[0].motivosRevision, []);
  const kg = normalizarLectura(lectura({ lineas: [linea({ descripcion: 'QUESO CREMOSO', unidad: 'KG' })] }), { hoy: HOY });
  assert.equal(kg.lineas[0].unidad, 'KG');
});

test('texto ajeno en otros campos se conserva en la columna pero se señala', () => {
  const n = normalizarLectura(
    lectura({ lineas: [linea({ descripcion: "YERBA 1KG wait, let's check the rule" })] }),
    { hoy: HOY },
  );
  assert.equal(n.lineas[0].descripcion, "YERBA 1KG wait, let's check the rule");
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('texto ajeno')));
});

test('nombres de productos comunes no se marcan como sospechosos', () => {
  for (const d of ['HUEVOS DE CAMPO X 30', 'GALLETITAS RELLENAS CHOCOLATE 118G', 'AGUA MINERAL SIN GAS 1,5L', 'PAN DE MOLDE BLANCO']) {
    assert.equal(textoSospechoso('descripcion', d), null, d);
  }
  assert.equal(textoSospechoso('observacion', 'cantidad borrosa'), null);
});

test('observación con razonamiento se señala en lugar de mostrarse como observación', () => {
  const n = normalizarLectura(
    lectura({ lineas: [linea({ observacion: "Omit unit? Let's check the definition instead" })] }),
    { hoy: HOY },
  );
  assert.ok(n.lineas[0].motivosRevision.some((m) => m.includes('observacion contiene texto ajeno')));
  assert.ok(!n.lineas[0].motivosRevision.some((m) => m.startsWith('Observación de la IA')));
});

test('tipo desconocido no se fuerza a un valor válido', () => {
  const n = normalizarLectura(lectura({ cabecera: { tipo: 'TICKET' }, lineas: [linea()] }), { hoy: HOY });
  assert.equal(n.cabecera.tipo, null);
  assert.ok(n.motivosRevision.some((m) => m.includes('TICKET')));
});

// --- v4: descuentos e impuestos entre los artículos y el total ---

const conAjustes = (ajustes, totalDeclarado) =>
  lecturaSchema.parse({ ...lectura({ cabecera: { tipo: 'FACTURA', totalDeclarado }, lineas: [linea()] }), ajustes });

test('v4: factura A con bonificación e IVA: el total cuadra y no pide revisión', () => {
  // 12 × 2.850 = 34.200; bonificación 5 % 1.710; IVA 21 % sobre 32.490 = 6.822,90.
  const n = normalizarLectura(
    conAjustes(
      [
        { concepto: 'Bonificación 5 %', tipo: 'DESCUENTO', importe: 1710 },
        { concepto: 'IVA 21 %', tipo: 'IMPUESTO', importe: 6822.9 },
        { concepto: 'Percepción IIBB', tipo: 'impuesto', importe: 974.7 },
      ],
      40287.6,
    ),
    { hoy: HOY },
  );
  assert.equal(n.cabecera.descuentoDeclarado, 1710);
  assert.equal(n.cabecera.impuestosDeclarados, 7797.6);
  assert.equal(n.ajustes.length, 3);
  assert.deepEqual(n.motivosRevision, []);
  assert.equal(n.requiereRevision, false);
});

test('v4: sin los ajustes, la misma factura avisa que puede haber impuestos sin cargar', () => {
  const n = normalizarLectura(conAjustes([], 40287.6), { hoy: HOY });
  assert.equal(n.cabecera.descuentoDeclarado, null);
  assert.equal(n.cabecera.impuestosDeclarados, null);
  assert.ok(n.motivosRevision.some((m) => m.includes('impuestos (IVA, percepciones) sin cargar')));
});

test('v4: un descuento sin impuestos que deja el total por debajo de la suma se explica', () => {
  const n = normalizarLectura(conAjustes([], 32490), { hoy: HOY });
  assert.ok(n.motivosRevision.some((m) => m.includes('puede haber un descuento sin cargar')));
  const ok = normalizarLectura(conAjustes([{ concepto: 'Desc. pronto pago', tipo: 'DESCUENTO', importe: -1710 }], 32490), { hoy: HOY });
  assert.equal(ok.cabecera.descuentoDeclarado, 1710, 'el signo menos impreso se toma en positivo');
  assert.deepEqual(ok.motivosRevision, []);
});

test('v4: un ajuste sin importe o sin tipo no se inventa: se informa y no se verifica el total', () => {
  const n = normalizarLectura(
    conAjustes(
      [
        { concepto: 'IVA 21 %', tipo: 'IMPUESTO', importe: null },
        { concepto: 'Otros', tipo: 'VARIOS', importe: 100 },
      ],
      41000,
    ),
    { hoy: HOY },
  );
  assert.equal(n.cabecera.impuestosDeclarados, null);
  assert.ok(n.motivosRevision.some((m) => m.includes('importe válido para «IVA 21 %»')));
  assert.ok(n.motivosRevision.some((m) => m.includes('«Otros» suma o resta')));
  assert.ok(n.motivosRevision.some((m) => m.includes('algún descuento o impuesto no se leyó')));
  assert.equal(n.requiereRevision, true);
});

test('v4: una lectura v3 (sin "ajustes") se normaliza igual que antes', () => {
  const { ajustes, ...v3 } = conAjustes([], 34200);
  const n = normalizarLectura(lecturaSchema.parse(v3), { hoy: HOY });
  assert.deepEqual(n.ajustes, []);
  assert.deepEqual(n.motivosRevision, []);
});
