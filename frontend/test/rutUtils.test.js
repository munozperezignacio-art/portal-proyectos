import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRut, formatNumberWithDots, formatRut, parseNumberFromDots } from '../src/utils/rutUtils.js';

test('normaliza el RUT chileno sin perder el dígito verificador K', () => {
  assert.equal(formatRut('12.345.678k'), '12.345.678-K');
  assert.equal(cleanRut('12.345.678-k'), '12345678K');
});

test('formatea y recupera montos chilenos', () => {
  assert.equal(formatNumberWithDots(1234567), '1.234.567');
  assert.equal(parseNumberFromDots('$ 1.234.567'), 1234567);
  assert.equal(parseNumberFromDots(''), 0);
});
