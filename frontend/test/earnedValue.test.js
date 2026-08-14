import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEarnedValue } from '../src/utils/earnedValue.js';

test('calcula CPI, SPI, EAC y variaciones de una obra', () => {
  const result = calculateEarnedValue({ earnedValue: 80, plannedValue: 100, actualCost: 90, budgetAtCompletion: 1000 });
  assert.equal(result.cpi, 80 / 90);
  assert.equal(result.spi, 0.8);
  assert.equal(result.eac, 1125);
  assert.equal(result.costVariance, -10);
  assert.equal(result.scheduleVariance, -20);
});

test('no inventa índices cuando faltan costo real o valor planificado', () => {
  const result = calculateEarnedValue({ earnedValue: 25, plannedValue: 0, actualCost: 0, budgetAtCompletion: 500 });
  assert.equal(result.cpi, null);
  assert.equal(result.spi, null);
  assert.equal(result.eac, 500);
});

test('normaliza entradas inválidas o negativas', () => {
  const result = calculateEarnedValue({ earnedValue: 'x', plannedValue: -10, actualCost: null, budgetAtCompletion: '200' });
  assert.deepEqual(result, { ev: 0, pv: 0, ac: 0, bac: 200, cpi: null, spi: null, eac: 200, costVariance: 0, scheduleVariance: 0 });
});
