import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAttendanceRegister} from './attendanceRegisterFilters.js';
const rows=[{id:1,fecha_marcacion:'2026-10-12',created_at:'2026-10-16T18:00:00Z',trabajador:'FRANCO MUÑOZ',rut:'18.009.385-0'},{id:2,fecha_marcacion:'2026-10-13',trabajador:'Franco Muñoz',rut:'18.009.385-0'},{id:3,fecha_marcacion:'2026-10-13',trabajador:'María Pérez',rut:'20.709.581-8'}];
test('filters date and worker independently or together while retaining newest-first order',()=>{
 assert.deepEqual(filterAttendanceRegister(rows,{person:'FRANCO munoz'}).map(r=>r.id),[2,1]);
 assert.deepEqual(filterAttendanceRegister(rows,{date:'2026-10-13'}).map(r=>r.id),[3,2]);
 assert.deepEqual(filterAttendanceRegister(rows,{date:'2026-10-13',person:'franco'}).map(r=>r.id),[2]);
 assert.equal(filterAttendanceRegister(rows,{date:'2026-10-16'}).length,0);
 assert.deepEqual(rows.map(r=>r.id),[1,2,3]);
});
test('supports RUT with or without punctuation, accents and cleared searches',()=>{
 assert.deepEqual(filterAttendanceRegister(rows,{person:'180093850'}).map(r=>r.id),[2,1]);
 assert.deepEqual(filterAttendanceRegister(rows,{person:'18.009.385-0'}).map(r=>r.id),[2,1]);
 assert.deepEqual(filterAttendanceRegister(rows,{person:' maria '}).map(r=>r.id),[3]);
 assert.equal(filterAttendanceRegister(rows,{person:'nadie'}).length,0);
 assert.equal(filterAttendanceRegister(rows,{date:'',person:''}).length,3);
});
