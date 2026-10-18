/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/workStatistics.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('exports', 'module', compiled)(loaded.exports, loaded);
const { normalizeParts, productionMetrics, countChileanBusinessDays } = loaded.exports;
const parts = normalizeParts([
 { partida: 'Excavacion', cantidad_presupuestada: 100, costo_por_dia: 100, fecha_inicio: '2026-10-01' },
 { partida: 'Limpieza', cantidad_presupuestada: 100, costo_por_dia: 1, fecha_inicio: '2026-10-01' },
 { partida: 'Resumen', unidad: 'GRUPO' },
], [{ codigo: 'EX', partida: 'Excavación' }], [
 { codigo: 'EX', tarea: 'Excavación', fecha_inicio: '2026-10-01', duracion: 10 },
 { tarea: 'Limpieza', fecha_inicio: '2026-10-01', duracion: 10 },
], '2026-10-01');
const reports = [
 { partida: 'Excavacion', cantidad: 20, fecha: '2026-10-07' },
 { partida: 'Limpieza', cantidad: 100, fecha: '2026-10-07' },
 { partida: 'Excavacion', cantidad: 80, fecha: '2026-10-30' },
];
const result = productionMetrics(parts, reports, '2026-10-07');
assert.equal(result.detail.length, 2);
assert.equal(result.detail[0].duration, 10);
assert.equal(result.planned, 50);
assert.equal(result.progress, 20.8);
assert.ok(result.detail.reduce((sum, p) => sum + p.pct, 0) / 2 > result.planned, 'Old average incorrectly suggests days gained');
assert.ok(Math.round((result.progress - result.planned) / 100 * 20) < 0, 'Weighted result must show days lost');
assert.equal(result.detail[0].done, 20, 'Future reports must not count');
assert.equal(countChileanBusinessDays('2026-10-10', '2026-10-13'), 1, 'Weekend and holiday excluded');
const early = productionMetrics(parts, [{ partida: 'Excavacion', cantidad: 100, fecha: '2026-10-07' }, { partida: 'Limpieza', cantidad: 100, fecha: '2026-10-07' }], '2026-10-07');
assert.ok(early.progress > early.planned, 'Real lead remains positive');
assert.equal(productionMetrics([], [], '2026-10-07').progress, 0);
console.log('Passed: weighted delay, lead, linked schedule, cutoff, groups, holidays, empty data.');
