// Genera docs/base-de-datos.md (diseño de la base de datos) a partir del
// modelo de Prisma y de las restricciones SQL de las migraciones.
// Uso: npm run doc-bd. No se conecta a la base.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, '..', 'docs', 'base-de-datos.md');
const textoEsquema = readFileSync(join(raiz, 'prisma', 'schema.prisma'), 'utf8');
const { models, enums } = Prisma.dmmf.datamodel;

const tabla = (m) => m.dbName ?? m.name;
const columna = (f) => f.dbName ?? f.name;
// La documentación del DMMF trae los saltos de línea escapados ("\\n").
const unaLinea = (t) =>
  (t ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Descripción de las tablas que no tienen comentario /// en el esquema.
const DESCRIPCION_TABLA = {
  Usuario: 'Personas que operan el sistema, con rol propietario o empleado. No se borran: se desactivan.',
  Categoria: 'Agrupación de productos para la navegación y los reportes. Un producto puede no tener categoría.',
  Producto: 'Catálogo del comercio, con unidad de medida, stock mínimo y deseado. No se borra: se desactiva.',
  Proveedor: 'Proveedores que envían los comprobantes. El CUIT, si se informa, es único. No se borra: se desactiva.',
  Comprobante: 'Remito o factura de compra cargado como imagen o PDF, con su estado, la respuesta original de la IA y quién lo cargó y confirmó.',
};
const descripcionTabla = (m) => unaLinea(m.documentation) || DESCRIPCION_TABLA[m.name] || '';
const celda = (t) => unaLinea(t).replace(/\|/g, '\\|');

// Tipo nativo (@db.Decimal(12, 3), @db.VarChar(…)) leído del texto del esquema.
const nativos = {};
for (const bloque of textoEsquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  nativos[bloque[1]] = {};
  for (const linea of bloque[2].split('\n')) {
    const m = /^\s+(\w+)\s+\S+.*@db\.(\w+(?:\([^)]*\))?)/.exec(linea);
    if (m) nativos[bloque[1]][m[1]] = m[2];
  }
}

const TIPOS_SQL = { Int: 'integer', String: 'text', Boolean: 'boolean', DateTime: 'timestamp(3)', Decimal: 'decimal', Json: 'jsonb', BigInt: 'bigint' };
function tipoSql(modelo, f) {
  if (f.kind === 'enum') return `enum ${f.type}`;
  const nativo = nativos[modelo.name]?.[f.name];
  if (nativo) return nativo.replace(/\s+/g, '').toLowerCase().replace('timestamptz', 'timestamptz');
  return TIPOS_SQL[f.type] ?? f.type;
}

// Índices únicos compuestos e índices, leídos de los atributos @@ del esquema.
function atributosModelo(nombre, atributo) {
  const bloque = new RegExp(`^model ${nombre} \\{([\\s\\S]*?)^\\}`, 'm').exec(textoEsquema)?.[1] ?? '';
  return [...bloque.matchAll(new RegExp(`@@${atributo}\\(\\[([^\\]]*)\\]`, 'g'))].map((m) =>
    m[1].split(',').map((c) => c.trim().replace(/\(.*\)/, '')),
  );
}

// Restricciones CHECK e índices únicos parciales escritos a mano en las migraciones.
const restricciones = [];
const dirMigraciones = join(raiz, 'prisma', 'migrations');
for (const dir of readdirSync(dirMigraciones).sort()) {
  let sql;
  try {
    // En Windows (core.autocrlf) las migraciones tienen CRLF: sin normalizar,
    // los comentarios "--" que explican cada regla no se reconocen.
    sql = readFileSync(join(dirMigraciones, dir, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    continue;
  }
  // Las líneas de comentario (--) inmediatamente anteriores explican la regla.
  const comentario = (bloque) =>
    (bloque ?? '')
      .split('\n')
      .map((l) => l.replace(/^--\s*/, '').trim())
      .filter(Boolean)
      .join(' ');
  for (const m of sql.matchAll(/((?:--.*\n)*)ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)" CHECK \(([\s\S]*?)\);/g)) {
    restricciones.push({ tabla: m[2], nombre: m[3], tipo: 'CHECK', regla: unaLinea(m[4]), comentario: comentario(m[1]) });
  }
  for (const m of sql.matchAll(/((?:--.*\n)*)CREATE UNIQUE INDEX "(\w+)" ON "(\w+)" \(([^)]*)\)\s*WHERE ([\s\S]*?);/g)) {
    restricciones.push({ tabla: m[3], nombre: m[2], tipo: 'UNIQUE parcial', regla: `(${m[4]}) WHERE ${unaLinea(m[5])}`, comentario: comentario(m[1]) });
  }
}

// --- Relaciones (lado que tiene la clave foránea) ---
const relaciones = [];
for (const m of models) {
  for (const f of m.fields) {
    if (f.kind !== 'object' || !f.relationFromFields?.length) continue;
    const padre = models.find((x) => x.name === f.type);
    const fks = f.relationFromFields.map((n) => m.fields.find((x) => x.name === n));
    const fkUnica = fks.length === 1 && fks[0].isUnique;
    relaciones.push({
      padre: tabla(padre),
      hija: tabla(m),
      columnas: fks.map(columna).join(', '),
      opcional: !f.isRequired,
      unoAUno: fkUnica,
      // Predeterminado de Prisma: Restrict si la relación es obligatoria, SetNull si es opcional.
      alBorrar: f.relationOnDelete ?? `${f.isRequired ? 'Restrict' : 'SetNull'} (predeterminado)`,
      nombre: f.name,
    });
  }
}

// --- Diagrama Mermaid ---
const tipoMermaid = (t) => t.replace(/^enum /, '').replace(/[^a-zA-Z0-9_]/g, (c) => (c === '(' || c === ',' ? '_' : '')).replace(/_+$/, '');
const lineasDer = ['erDiagram'];
for (const r of relaciones) {
  const izquierda = r.opcional ? '|o' : '||';
  const derecha = r.unoAUno ? 'o|' : 'o{';
  lineasDer.push(`  ${r.padre} ${izquierda}--${derecha} ${r.hija} : "${r.nombre}"`);
}
for (const m of models) {
  lineasDer.push(`  ${tabla(m)} {`);
  const fksModelo = new Set(m.fields.flatMap((f) => (f.kind === 'object' ? f.relationFromFields ?? [] : [])));
  for (const f of m.fields) {
    if (f.kind === 'object') continue;
    const claves = [f.isId && 'PK', fksModelo.has(f.name) && 'FK', f.isUnique && 'UK'].filter(Boolean).join(',');
    lineasDer.push(`    ${tipoMermaid(tipoSql(m, f))} ${columna(f)}${claves ? ` ${claves}` : ''}`);
  }
  lineasDer.push('  }');
}
const mermaid = lineasDer.join('\n');
writeFileSync(join(raiz, '..', 'docs', 'referencias', 'der-remitto.mmd'), `${mermaid}\n`);

// --- Documento ---
const salida = [];
const p = (...l) => salida.push(...l);
p(
  '# Diseño de la base de datos de Remitto',
  '',
  '> Documento generado con `npm run doc-bd` (en `backend/`) a partir de `backend/prisma/schema.prisma` y de las migraciones. No editar a mano: regenerarlo cuando cambie el modelo.',
  '',
  `Motor: PostgreSQL 16, con Prisma ${Prisma.prismaVersion.client} como ORM. ${models.length} tablas y ${enums.length} tipos enumerados.`,
  '',
  '## Criterios de diseño',
  '',
  '- **El stock se deriva de los movimientos.** `productos.stock_actual` es un valor cacheado: cada cambio pasa por un registro en `movimientos_stock`, en la misma transacción y con el stock anterior, y `stock_actual` coincide con la suma de los movimientos.',
  '- **Lo leído por la IA se conserva aparte de lo confirmado.** `detalles_comprobante` guarda las columnas `*_extraido` y, por separado, el producto, la cantidad y el precio confirmados. `comprobantes.respuesta_ia` guarda la respuesta original.',
  '- **Las reglas de negocio principales se aplican en la base** (RNF5): claves únicas, restricciones `CHECK` e índices únicos parciales, detallados más abajo.',
  '- **No se borran registros con historia**: usuarios, productos y proveedores se desactivan (`activo`).',
  '- Cantidades y precios se guardan como `decimal` exacto, nunca como punto flotante.',
  '',
  '## Diagrama entidad-relación',
  '',
  'Las imágenes [der-remitto.svg](referencias/der-remitto.svg) y [der-remitto.png](referencias/der-remitto.png) (para documentos e impresión) muestran el mismo diagrama, generado desde [der-remitto.mmd](referencias/der-remitto.mmd) con Mermaid. Al regenerar este documento, volver a renderizar las imágenes.',
  '',
  '```mermaid',
  mermaid,
  '```',
  '',
  'Notación: `||` uno obligatorio, `|o` cero o uno, `o{` cero o muchos. PK clave primaria, FK clave foránea, UK valor único.',
  '',
  '## Tablas',
  '',
  '| Tabla | Descripción |',
  '| --- | --- |',
  ...models.map((m) => `| [${tabla(m)}](#${tabla(m)}) | ${celda(descripcionTabla(m)) || '—'} |`),
  '',
);

for (const m of models) {
  const fksModelo = new Map();
  for (const f of m.fields) {
    if (f.kind === 'object' && f.relationFromFields?.length) {
      const padre = models.find((x) => x.name === f.type);
      for (const n of f.relationFromFields) fksModelo.set(n, `FK → ${tabla(padre)}`);
    }
  }
  p(`### ${tabla(m)}`, '');
  if (descripcionTabla(m)) p(descripcionTabla(m), '');
  p('| Columna | Tipo | Nulo | Clave / predeterminado | Descripción |', '| --- | --- | --- | --- | --- |');
  for (const f of m.fields) {
    if (f.kind === 'object') continue;
    const marcas = [];
    if (f.isId) marcas.push('PK');
    if (fksModelo.has(f.name)) marcas.push(fksModelo.get(f.name));
    if (f.isUnique) marcas.push('único');
    if (f.default !== undefined) {
      const d = f.default;
      marcas.push(`= ${typeof d === 'object' ? `${d.name}()` : d}`);
    }
    if (f.isUpdatedAt) marcas.push('se actualiza solo');
    p(`| \`${columna(f)}\` | ${tipoSql(m, f)} | ${f.isRequired ? 'no' : 'sí'} | ${marcas.join(' · ') || '—'} | ${celda(f.documentation) || '—'} |`);
  }
  const unicos = atributosModelo(m.name, 'unique');
  const indices = atributosModelo(m.name, 'index');
  const nombreCol = (n) => columna(m.fields.find((f) => f.name === n) ?? { name: n });
  if (unicos.length || indices.length) p('');
  for (const u of unicos) p(`- Único: (${u.map(nombreCol).join(', ')})`);
  for (const i of indices) p(`- Índice: (${i.map(nombreCol).join(', ')})`);
  const propias = restricciones.filter((r) => r.tabla === tabla(m));
  for (const r of propias) p(`- ${r.tipo} \`${r.nombre}\`: \`${r.regla}\`${r.comentario ? ` — ${r.comentario}` : ''}`);
  p('');
}

p('## Relaciones', '', '| Tabla padre | Tabla hija | Columna | Cardinalidad | Al borrar el padre |', '| --- | --- | --- | --- | --- |');
for (const r of relaciones) {
  const card = `${r.opcional ? '0..1' : '1'} a ${r.unoAUno ? '0..1' : '0..N'}`;
  p(`| ${r.padre} | ${r.hija} | \`${r.columnas}\` | ${card} | ${r.alBorrar} |`);
}
p('', '## Tipos enumerados', '', '| Tipo | Valores |', '| --- | --- |');
for (const e of enums) p(`| ${e.name} | ${e.values.map((v) => `\`${v.name}\``).join(', ')} |`);
p(
  '',
  '## Restricciones adicionales en SQL',
  '',
  'Prisma no expresa estas reglas; se agregaron en las migraciones (`backend/prisma/migrations/`).',
  '',
  '| Tabla | Restricción | Tipo | Regla | Motivo |',
  '| --- | --- | --- | --- | --- |',
);
for (const r of restricciones) p(`| ${r.tabla} | \`${r.nombre}\` | ${r.tipo} | \`${celda(r.regla)}\` | ${celda(r.comentario) || '—'} |`);
p('');

writeFileSync(destino, salida.join('\n'));
console.log(`Generado ${destino} (${models.length} tablas, ${relaciones.length} relaciones, ${restricciones.length} restricciones SQL).`);
