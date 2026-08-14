import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRut, formatNumberWithDots, formatRut, parseNumberFromDots, validateRut } from '../src/utils/rutUtils.js';

test('normaliza el RUT chileno sin perder el dígito verificador K', () => {
  assert.equal(formatRut('12.345.678k'), '12.345.678-K');
  assert.equal(cleanRut('12.345.678-k'), '12345678K');
});

test('valida RUT mediante módulo 11', () => {
  assert.equal(validateRut('12.345.678-5'), true);
  assert.equal(validateRut('1.000.005-K'), true);
  assert.equal(validateRut('12.345.678-9'), false);
  assert.equal(validateRut('texto'), false);
});

test('formatea y recupera montos chilenos', () => {
  assert.equal(formatNumberWithDots(1234567), '1.234.567');
  assert.equal(parseNumberFromDots('$ 1.234.567'), 1234567);
  assert.equal(parseNumberFromDots(''), 0);
});
