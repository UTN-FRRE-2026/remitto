import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { crearProductoSchema, actualizarProductoSchema } from '../src/modules/productos/productos.schema.js';
import { crearProveedorSchema, actualizarProveedorSchema } from '../src/modules/proveedores/proveedores.schema.js';
import { traducirErrorProducto } from '../src/modules/productos/productos.service.js';
import { traducirErrorProveedor } from '../src/modules/proveedores/proveedores.service.js';

const errorPrisma = (code) =>
  new Prisma.PrismaClientKnownRequestError('error de prueba', { code, clientVersion: 'test' });

// --- HU4 productos ---

test('producto: un código de barras vacío se guarda como null (no como "")', () => {
  const d = crearProductoSchema.parse({ nombre: 'Yerba', codigoBarras: '   ', descripcion: '' });
  assert.equal(d.codigoBarras, null);
  assert.equal(d.descripcion, null);
  assert.equal(d.unidadMedida, 'UNIDAD');
  assert.equal(d.stockMinimo, 0);
});

test('producto: el alta exige nombre y no acepta mínimos negativos', () => {
  assert.equal(crearProductoSchema.safeParse({ nombre: '  ' }).success, false);
  assert.equal(crearProductoSchema.safeParse({ nombre: 'Yerba', stockMinimo: -1 }).success, false);
  assert.equal(crearProductoSchema.safeParse({ nombre: 'Yerba', stockDeseado: -1 }).success, false);
});

test('producto: en una modificación, vacío borra y omitido no cambia', () => {
  assert.deepEqual(actualizarProductoSchema.parse({ codigoBarras: '' }), { codigoBarras: null });
  assert.deepEqual(actualizarProductoSchema.parse({ categoriaId: null }), { categoriaId: null });
  // Sin defaults: cambiar el nombre no pisa la unidad ni el mínimo.
  assert.deepEqual(actualizarProductoSchema.parse({ nombre: 'Yerba 1 kg' }), { nombre: 'Yerba 1 kg' });
  assert.equal(actualizarProductoSchema.safeParse({}).success, false);
});

test('producto: el stock actual no se modifica desde el catálogo', () => {
  // Solo cambia con movimientos (HU11 a HU14): el esquema descarta el campo.
  const d = actualizarProductoSchema.parse({ nombre: 'Yerba', stockActual: 50 });
  assert.equal('stockActual' in d, false);
});

test('producto: código repetido y categoría inexistente dan mensajes claros', () => {
  const repetido = traducirErrorProducto(errorPrisma('P2002'));
  assert.equal(repetido.status, 409);
  assert.match(repetido.message, /código de barras/);
  const categoria = traducirErrorProducto(errorPrisma('P2003'));
  assert.equal(categoria.status, 400);
  assert.match(categoria.message, /categoría/);
  const otro = new Error('otro');
  assert.equal(traducirErrorProducto(otro), otro);
});

// --- HU6 proveedores ---

test('proveedor: el CUIT se acepta con o sin guiones y se guarda sin ellos', () => {
  assert.equal(crearProveedorSchema.parse({ razonSocial: 'A', cuit: '30-71234567-1' }).cuit, '30712345671');
  assert.equal(crearProveedorSchema.parse({ razonSocial: 'A', cuit: '30712345671' }).cuit, '30712345671');
  assert.equal(crearProveedorSchema.safeParse({ razonSocial: 'A', cuit: '3071234567' }).success, false);
});

test('proveedor: CUIT y correo son opcionales; vacíos se guardan como null', () => {
  const d = crearProveedorSchema.parse({ razonSocial: 'Distribuidora', cuit: '', email: ' ', telefono: '' });
  assert.equal(d.cuit, null);
  assert.equal(d.email, null);
  assert.equal(d.telefono, null);
  assert.equal(crearProveedorSchema.safeParse({ razonSocial: 'A', email: 'no-es-correo' }).success, false);
  assert.equal(crearProveedorSchema.safeParse({ razonSocial: '' }).success, false);
});

test('proveedor: en una modificación, vacío borra el CUIT y omitido no cambia', () => {
  assert.deepEqual(actualizarProveedorSchema.parse({ cuit: '' }), { cuit: null });
  assert.deepEqual(actualizarProveedorSchema.parse({ activo: true }), { activo: true });
  assert.equal(actualizarProveedorSchema.safeParse({}).success, false);
});

test('proveedor: un CUIT repetido da un 409 con mensaje claro', () => {
  const e = traducirErrorProveedor(errorPrisma('P2002'));
  assert.equal(e.status, 409);
  assert.match(e.message, /CUIT/);
});
