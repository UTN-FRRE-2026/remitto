import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { crearUsuarioSchema, actualizarUsuarioSchema } from '../src/modules/usuarios/usuarios.schema.js';
import { traducirErrorUsuario } from '../src/modules/usuarios/usuarios.service.js';

test('usuario: el correo se guarda en minúsculas y sin espacios', () => {
  const d = crearUsuarioSchema.parse({ nombre: 'Juan', email: '  Juan.Perez@Ejemplo.COM ', password: 'secreta' });
  assert.equal(d.email, 'juan.perez@ejemplo.com');
  assert.equal(d.rol, 'EMPLEADO');
  assert.equal(actualizarUsuarioSchema.parse({ email: 'A@B.COM' }).email, 'a@b.com');
});

test('usuario: el alta exige nombre, correo válido y contraseña de 6 a 72 caracteres', () => {
  const base = { nombre: 'Juan', email: 'juan@ejemplo.com', password: 'secreta' };
  assert.equal(crearUsuarioSchema.safeParse(base).success, true);
  assert.equal(crearUsuarioSchema.safeParse({ ...base, nombre: ' ' }).success, false);
  assert.equal(crearUsuarioSchema.safeParse({ ...base, email: 'juan' }).success, false);
  assert.equal(crearUsuarioSchema.safeParse({ ...base, password: '12345' }).success, false);
  assert.equal(crearUsuarioSchema.safeParse({ ...base, password: 'x'.repeat(73) }).success, false);
  assert.equal(crearUsuarioSchema.safeParse({ ...base, rol: 'ADMIN' }).success, false);
});

test('usuario: la modificación es parcial y no acepta un pedido vacío', () => {
  assert.deepEqual(actualizarUsuarioSchema.parse({ activo: false }), { activo: false });
  assert.equal(actualizarUsuarioSchema.safeParse({}).success, false);
  // La contraseña solo cambia si se envía.
  assert.equal('password' in actualizarUsuarioSchema.parse({ nombre: 'Ana' }), false);
});

test('usuario: un correo repetido da un 409 con mensaje claro', () => {
  const e = traducirErrorUsuario(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: 'test' }));
  assert.equal(e.status, 409);
  assert.match(e.message, /correo/);
});
