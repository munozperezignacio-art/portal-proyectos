import test from 'node:test';
import assert from 'node:assert/strict';
import {chileanAttendanceToday, resolveAttendanceDate, attendanceDay, attendanceDateLabel} from './attendanceDates.js';
const now=new Date('2026-10-15T15:00:00Z');
test('manual date is the worked day, not the entry timestamp',()=>{
 assert.equal(resolveAttendanceDate('manual','2026-10-13',now),'2026-10-13');
 assert.equal(attendanceDay({fecha_marcacion:'2026-10-13',created_at:now.toISOString()}),'2026-10-13');
 assert.equal(attendanceDateLabel({fecha_marcacion:'2026-10-13'}),'13/10/2026');
});
test('QR ignores selected historical date and uses Chile today',()=>{
 assert.equal(resolveAttendanceDate('qr','2026-10-01',now),'2026-10-15');
 assert.equal(chileanAttendanceToday(new Date('2026-10-15T01:00:00Z')),'2026-10-14');
});
test('invalid and future manual dates rejected; legacy date fallback uses Chile timezone',()=>{
 for(const date of ['', '2026-02-30','2026-10-16'])assert.throws(()=>resolveAttendanceDate('manual',date,now));
 assert.equal(attendanceDay({created_at:'2026-10-15T01:00:00Z'}),'2026-10-14');
 assert.equal(attendanceDateLabel({}),'Sin fecha');
});
