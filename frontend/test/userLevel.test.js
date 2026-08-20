import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateObras, canEditItem, getUserLevel } from '../src/utils/userLevel.js';

test('aplica mínimo privilegio a sesiones ausentes y roles desconocidos', () => {
  assert.equal(getUserLevel(null), 4);
  assert.equal(getUserLevel({ rol: 'rol personalizado sin equivalencia', empresa: 'Constructora Uno' }), 4);
  assert.equal(canCreateObras(null), false);
});

test('reconoce administradores explícitos y restringe edición operativa', () => {
  assert.equal(getUserLevel({ rol_base: 'Administrador Empresa', empresa: 'Constructora Uno' }), 1);
  assert.equal(getUserLevel({ rol_base: 'Personalizado', rol: 'Administrador de Empresa', empresa: 'Constructora Uno' }), 1);
  assert.equal(canCreateObras({ rol_base: 'Administrador Empresa', empresa: 'Constructora Uno' }), true);
  assert.equal(canCreateObras({ rol_base: 'Personalizado', rol: 'Administrador de Empresa', empresa: 'Constructora Uno' }), true);
  assert.equal(canEditItem({ id: 'operador-1', nivel: 4 }, 'operador-1'), false);
});
