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

const {reportBelongsToPart,partReportHistory}=loaded.exports;
const similar=[{id:1,partida:'Pilas de Grava IMPACT',cantidad:463,pu:1,fecha_inicio:'2026-10-01'},{id:2,partida:'Pilas de Grava IMPACT adicionales',cantidad:20,pu:1,fecha_inicio:'2026-10-01'}];
const history=[{id:10,partida:'Pilas de Grava IMPACT',cantidad:100,fecha:'2026-10-02'},{id:11,partida:'Pilas de Grava IMPACT adicionales',cantidad:3,fecha:'2026-10-03'},{id:12,partida_id:1,partida:'Nombre anterior',cantidad:45,created_at:'2026-10-04T12:00:00Z'}];
assert.equal(reportBelongsToPart(history[1],similar[0],similar),false,'Similar names must not mix');
assert.equal(reportBelongsToPart({partida:'pilas de grava'},similar[0],similar),false,'Ambiguous legacy match must not mix');
assert.equal(reportBelongsToPart({partida:'EXCAVACION'}, {id:7,partida:'Excavación'},[{id:7,partida:'Excavación'}]),true);
assert.deepEqual(partReportHistory(similar[0],similar,history).map(r=>r.id),[12,10]);
assert.deepEqual(partReportHistory(similar[1],similar,history).map(r=>r.id),[11]);
assert.equal(productionMetrics(similar,history,'2026-10-07').detail[0].done,145);
assert.equal(productionMetrics(similar,history,'2026-10-07').detail[1].done,3);
assert.equal(partReportHistory({id:99,partida:'Otra'},similar,history).length,0);
console.log('Passed part reports: exact names, accents, ID precedence, ambiguous legacy names, totals and latest-first order.');
