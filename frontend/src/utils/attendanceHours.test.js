import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAttendanceHours} from './attendanceHours.js';
import {sortAttendanceRecords} from './attendanceDates.js';
test('08 to 19 less one hour meal gives nine ordinary and one extra',()=>{
 assert.deepEqual(calculateAttendanceHours({ingreso:'08:00',salida:'19:00',colacion:'SI',ordinaryHours:9}),{worked:10,ordinary:9,extra:1});
 assert.deepEqual(calculateAttendanceHours({ingreso:'08:00',salida:'18:00',colacion:'SI',ordinaryHours:9}),{worked:9,ordinary:9,extra:0});
 assert.deepEqual(calculateAttendanceHours({ingreso:'08:00',salida:'14:00',colacion:'NO',ordinaryHours:9}),{worked:6,ordinary:6,extra:0});
});
test('fractional shifts and overnight work honor actual configured daily threshold',()=>{
 assert.equal(calculateAttendanceHours({ingreso:'08:00',salida:'19:00',colacion:'SI',ordinaryHours:8}).extra,2);
 assert.equal(calculateAttendanceHours({ingreso:'22:00',salida:'07:30',colacion:'SI',ordinaryHours:8}).extra,.5);
 assert.equal(calculateAttendanceHours({ingreso:'08:00',salida:'19:00',ordinaryHours:9,status:'AUSENTE'}).extra,0);
 assert.throws(()=>calculateAttendanceHours({ordinaryHours:''}));
});
test('attendance sorted by worked date descending regardless of creation order',()=>{
 const rows=[{id:1,fecha_marcacion:'2026-09-25',created_at:'2026-10-15'}, {id:2,fecha_marcacion:'2026-09-29',created_at:'2026-10-13'}, {id:3,fecha_marcacion:'2026-09-28',created_at:'2026-10-14'}];
 assert.deepEqual(sortAttendanceRecords(rows).map(r=>r.id),[2,3,1]);assert.equal(rows[0].id,1);
});
