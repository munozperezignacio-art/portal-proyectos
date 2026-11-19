import test from 'node:test';
import assert from 'node:assert/strict';
import {draftWeeklySchedule,validateWeeklySchedule,scheduleForDate,calculateScheduledAttendance} from './weeklyWorkSchedule.js';
const day={active:true,start:'08:00',end:'18:00',breakStart:'13:00',breakEnd:'14:00'};
test('vigencia uses attendance date, latest same-date revision and preserves earlier fallback',()=>{
 const base=draftWeeklySchedule({}),first={...base,1:{...day,end:'17:00'}},future={...base,1:{...day,end:'16:00'}};
 const work={jornada_semanal:base,jornadas_historial:[{id:1,desde:'2026-10-19',jornada:first},{id:2,desde:'2026-11-02',jornada:future},{id:3,desde:'2026-10-19',jornada:first}]};
 assert.equal(scheduleForDate(work,'2026-10-12').end,'18:00');
 assert.equal(scheduleForDate(work,'2026-10-19').end,'17:00');
 assert.equal(scheduleForDate(work,'2026-11-02').end,'16:00');
});
test('outside configured interval is extra even without exceeding nine worked hours',()=>{
 assert.deepEqual(calculateScheduledAttendance({asistencia:'PRESENTE',ingreso:'07:00',salida:'16:00',colacion:'SI'},day),{worked:8,ordinary:7,extra:1});
 assert.equal(calculateScheduledAttendance({asistencia:'PRESENTE',ingreso:'08:00',salida:'19:00',colacion:'SI'},day).extra,1);
 assert.equal(calculateScheduledAttendance({asistencia:'PRESENTE',ingreso:'08:00',salida:'18:00',colacion:'NO'},day).extra,1);
});
test('day without ordinary work counts all net work as extra',()=>{
 assert.deepEqual(calculateScheduledAttendance({asistencia:'PRESENTE',ingreso:'08:00',salida:'14:00',colacion:'NO'},{active:false}),{worked:6,ordinary:0,extra:6});
});
test('date chooses weekday in a timezone-safe way and validates all seven days',()=>{
 const schedule=draftWeeklySchedule({});validateWeeklySchedule(schedule);
 assert.equal(scheduleForDate({jornada_semanal:schedule},'2026-10-16').active,true);
 assert.equal(scheduleForDate({jornada_semanal:schedule},'2026-10-18').active,false);
 assert.equal(scheduleForDate({},'2026-10-16'),null);
 assert.throws(()=>validateWeeklySchedule({...schedule,1:{...day,end:'07:00'}}));
 assert.throws(()=>validateWeeklySchedule({...schedule,1:{...day,breakEnd:'20:00'}}));
});
