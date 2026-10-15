import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceWorkerKey,buildManualAttendanceBatch} from './attendanceBatch.js';
const base={empresa:'TEST',obra_id:1,fecha_marcacion:'2026-10-15',asistencia:'PRESENTE',ingreso:'08:00',salida:'19:00',colacion:'SI',horas_extras_auto:1,firma_base64:'personal-signature',verificado_qr:true};
const workers=[{id:1,nombre:'Ana',rut:'12.345.678-5',empresa:'TEST'},{id:2,nombre:'Luis',rut:'11.111.111-1',empresa:'TEST'}];
test('bulk uses each identity, shares reviewed time and never copies personal signature or QR validation',()=>{
 const batch=buildManualAttendanceBatch(base,workers);assert.equal(batch.length,2);assert.deepEqual(batch.map(r=>r.trabajador),['Ana','Luis']);assert.equal(batch[0].rut_normalizado,'123456785');assert.ok(batch.every(r=>r.firma_base64===null && r.verificado_qr===false && r.horas_extras_auto===1 && r.fecha_marcacion===base.fecha_marcacion));assert.equal(base.firma_base64,'personal-signature');assert.equal(attendanceWorkerKey(workers[0]),'1');
});
test('existing attendance blocks whole batch rather than overwriting or partially skipping people',()=>{
 assert.throws(()=>buildManualAttendanceBatch(base,workers,[{rut:'12345678-5'}]),/Ana ya tiene marcaje/);
 assert.throws(()=>buildManualAttendanceBatch(base,workers,[{trabajador:'Ana'}]),/Ana ya tiene marcaje/);
});
test('empty, duplicate, missing-RUT or foreign-company selections rejected',()=>{
 assert.throws(()=>buildManualAttendanceBatch(base,[]));assert.throws(()=>buildManualAttendanceBatch(base,[workers[0],workers[0]]));assert.throws(()=>buildManualAttendanceBatch(base,[{nombre:'Sin RUT'}]));assert.throws(()=>buildManualAttendanceBatch(base,[{...workers[0],empresa:'OTHER'}]));
});
