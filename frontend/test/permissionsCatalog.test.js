import test from 'node:test';
import assert from 'node:assert/strict';
import { can, defaultPermission, isSuperUser, mergePermissions, permissionKey } from '../src/utils/permissionsCatalog.js';

test('construye claves estables y combina rol con excepción de usuario', () => {
  const key = permissionKey('obras', 'estados_pago', 'aprobar');
  assert.equal(key, 'obras.estados_pago.aprobar');
  assert.deepEqual(mergePermissions({ [key]: true }, { [key]: false }), { [key]: false });
});

test('una denegación explícita prevalece sobre el permiso por defecto', () => {
  const user = { rol_base: 'Administrador Empresa', empresa: 'Constructora Uno' };
  const key = 'obras.estados_pago.aprobar';
  assert.equal(defaultPermission(user, key), true);
  assert.equal(can(user, { [key]: false }, key), false);
});

test('el acceso global requiere rol administrativo de Obraxis explícito', () => {
  assert.equal(isSuperUser({ empresa: 'Obraxis', rol_base: 'Administrador' }), true);
  assert.equal(isSuperUser({ empresa: 'Constructora Uno', rol_base: 'Administrador' }), false);
});
