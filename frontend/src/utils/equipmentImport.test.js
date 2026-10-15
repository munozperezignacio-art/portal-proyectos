import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEquipmentCost, parseEquipmentSheet, equipmentImportPayload } from './equipmentImport.js';
const headers = ['Código', 'Nombre de equipo', 'Marca', 'Modelo', 'Costo Día (22 días)'];
test('CLP accepts both thousands conventions and real numeric cells without dividing by 22', () => {
  for (const value of ['510,747', '$510.747', 510747, 'CLP 510747']) assert.equal(parseEquipmentCost(value), 510747);
  assert.equal(parseEquipmentCost('1,086,820'), 1086820);
  assert.equal(parseEquipmentCost(0), 0);
  for (const value of ['', -1, 'abc', '510,74', '1.000,50', 1.5]) assert.ok(Number.isNaN(parseEquipmentCost(value)));
});
test('legacy headings, offset columns and title rows preserve mappings', () => {
  const result = parseEquipmentSheet([['Título'], ['', 'Modelo', 'Código', 'Maquinaria', 'Costo Día (22 días)', 'Marca'], ['', '460X2', ' exc-02 ', 'EXCAVADORA', '510,747', 'LINKBELT']]);
  assert.equal(result[0].row, 3); assert.equal(result[0].code, 'EXC-02'); assert.equal(result[0].amount, 510747);
  const payload = equipmentImportPayload(result[0], 'EMPRESA');
  assert.equal(payload.marca, 'LINKBELT 460X2'); assert.equal(payload.obra_nombre, null); assert.equal(payload.empresa, 'EMPRESA');
});
test('duplicates and invalid rows are not silently imported', () => {
  const rows = parseEquipmentSheet([headers, ['A', 'Equipo', '', '', 0], ['a', 'Otro', '', '', 100], ['', '', '', '', ''], ['B', '', '', '', 'x']], [{ patente: 'a' }]);
  assert.equal(rows.length, 3); assert.equal(rows[0].exists, true); assert.ok(rows[1].errors.length); assert.equal(rows[2].errors.length, 2);
  assert.throws(() => equipmentImportPayload(rows[0], 'EMPRESA'));
  assert.throws(() => parseEquipmentSheet([['Código', 'Nombre de equipo']]));
});
