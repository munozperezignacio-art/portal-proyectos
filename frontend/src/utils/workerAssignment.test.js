import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentIssue,toggleVisibleWorkers,workerMatchesSearch} from './workerAssignment.js';
test('accumulate searches and select/deselect only visible workers without losing hidden ones',()=>{
 let selected=['1'];selected=toggleVisibleWorkers(selected,[{id:2}]);assert.deepEqual(selected,['1','2']);
 selected=toggleVisibleWorkers(selected,[{id:2},{id:3}]);assert.deepEqual(selected,['1','2','3']);
 selected=toggleVisibleWorkers(selected,[{id:2},{id:3}]);assert.deepEqual(selected,['1']);
 assert.deepEqual(toggleVisibleWorkers(selected,[]),['1']);
});
test('name search ignores accents, RUT ignores formatting and bank is searchable',()=>{
 const worker={nombre:'José Álvarez',rut:'12.345.678-5',cargo:'Operador',banco:'BancoEstado'};
 assert.ok(workerMatchesSearch(worker,'jose'));assert.ok(workerMatchesSearch(worker,'alvarez'));
 assert.ok(workerMatchesSearch(worker,'12345678'));assert.ok(workerMatchesSearch(worker,'bancoestado'));
 assert.equal(workerMatchesSearch(worker,'Pedro'),false);
});
test('assignment checks contract dates and includes both boundaries',()=>{
 const worker={fecha_inicio_contrato:'2026-10-01',fecha_vencimiento_contrato:'2026-10-07'};
 assert.match(assignmentIssue(worker,'2026-10-08'),/terminado/);assert.match(assignmentIssue(worker,'2026-09-30'),/Ingreso/);
 assert.equal(assignmentIssue(worker,'2026-10-01'),'');assert.equal(assignmentIssue(worker,'2026-10-07'),'');
});
