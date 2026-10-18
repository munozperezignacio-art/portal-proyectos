/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
 const source = fs.readFileSync(path.join(__dirname, '../src/lib', `${name}.ts`), 'utf8');
 const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const module = {exports:{}};
 new Function('exports','module','require',code)(module.exports,module,n => load(n.replace('./','')));
 return module.exports;
}
const {buildManualAttendanceBatch} = load('attendanceBatch');
const {calculateScheduledAttendance,scheduledDayHours,scheduleForDate} = load('weeklyWorkSchedule');
const day = {active:true,start:'08:00',end:'18:00',breakStart:'13:00',breakEnd:'14:00'};
const data = {asistencia:'PRESENTE',ingreso:'08:00',salida:'19:00',colacion:'SI'};
assert.deepEqual(calculateScheduledAttendance(data,day),{worked:10,ordinary:9,extra:1});
assert.deepEqual(calculateScheduledAttendance({...data,ingreso:'14:00',salida:'19:00'},day),{worked:5,ordinary:4,extra:1});
assert.deepEqual(calculateScheduledAttendance({...data,colacion:'NO'},day),{worked:11,ordinary:9,extra:2});
assert.deepEqual(calculateScheduledAttendance(data,{...day,active:false}),{worked:10,ordinary:0,extra:10});
assert.deepEqual(calculateScheduledAttendance({...data,asistencia:'LICENCIA'},day),{worked:0,ordinary:0,extra:0});
assert.deepEqual(calculateScheduledAttendance(data,null,8),{worked:10,ordinary:8,extra:2});
assert.equal(scheduledDayHours(day),9);
assert.equal(scheduleForDate({jornada_semanal:{1:day}},'2026-10-19'),day);
assert.throws(()=>calculateScheduledAttendance({...data,ingreso:'25:00'},day));
const workers = [{id:1,nombre:'Ana',rut:'12.345.678-5',empresa:'ACME'}, {id:2,nombre:'Luis',rut:'9.876.543-K',empresa:'ACME'}];
const base = {empresa:'ACME',fecha_marcacion:'2026-10-19',...data,horas_ordinarias:9,horas_extras_auto:1};
const batch = buildManualAttendanceBatch(base,workers);
assert.equal(batch.length,2);
assert.equal(batch[0].rut_normalizado,'123456785');
assert.ok(batch.every(r=>r.horas_extras_auto===1 && r.verificado_qr===false && r.firma_base64===null));
assert.throws(()=>buildManualAttendanceBatch(base,workers,[{rut:'12345678-5'}]),/ya tiene marcaje/);
assert.throws(()=>buildManualAttendanceBatch(base,[workers[0],workers[0]]),/repetido/);
assert.throws(()=>buildManualAttendanceBatch(base,[{...workers[0],empresa:'OTHER'}]),/otra empresa/);
assert.throws(()=>buildManualAttendanceBatch(base,[]));
assert.throws(()=>buildManualAttendanceBatch(base,[{nombre:'Sin RUT'}]));
console.log('Passed attendance: hours, overtime, meal, non-working days, leave, legacy schedule, invalid time, batch, duplicates, company isolation.');
