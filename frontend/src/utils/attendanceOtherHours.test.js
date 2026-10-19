import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOtherHours} from './attendanceOtherHours.js';
import {buildManualAttendanceBatch} from './attendanceBatch.js';
test('otras horas: admite cero y decimales, rechaza negativos y valores inválidos',()=>{
  for(const value of ['',null,undefined,0,'0'])assert.equal(parseOtherHours(value),0);
  assert.equal(parseOtherHours('1.75'),1.75);
  for(const value of [-1,'abc',NaN,Infinity,0.001])assert.throws(()=>parseOtherHours(value),/Otras horas/);
});
test('el lote conserva otras horas sin sumarlas a HE',()=>{
  const batch=buildManualAttendanceBatch({empresa:'TEST',otras_horas:2.5,horas_extras_auto:1},[{id:1,empresa:'TEST',nombre:'Ana',rut:'1-9'},{id:2,empresa:'TEST',nombre:'Luis',rut:'2-7'}]);
  assert.ok(batch.every(row=>row.otras_horas===2.5&&row.horas_extras_auto===1));
});
