const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'module', code)(module.exports, module);
  return module.exports;
}
const { operationalDate } = load('operationalDate.ts');
const { shiftChileanBusinessDays, addChileanBusinessDays } = load('workStatistics.ts');
test('Chile operational dates retain the previous evening across UTC midnight', () => {
  assert.equal(operationalDate(new Date('2026-10-20T00:30:00Z')), '2026-10-19');
  assert.equal(operationalDate(new Date('2026-07-20T03:30:00Z')), '2026-07-19');
  assert.equal(operationalDate(new Date('2026-10-20T04:30:00Z')), '2026-10-20');
});
test('shifts exclude the origin day in both directions, duration stays inclusive', () => {
  assert.equal(shiftChileanBusinessDays('2026-10-19', 1), '2026-10-20');
  assert.equal(shiftChileanBusinessDays('2026-10-19', 2), '2026-10-21');
  assert.equal(shiftChileanBusinessDays('2026-10-19', -1), '2026-10-16');
  assert.equal(shiftChileanBusinessDays('2026-10-09', 1), '2026-10-13');
  assert.equal(shiftChileanBusinessDays('2026-10-13', -1), '2026-10-09');
  assert.equal(shiftChileanBusinessDays('2026-10-19', 0), '2026-10-19');
  assert.equal(addChileanBusinessDays('2026-10-19', 1), '2026-10-19');
});
