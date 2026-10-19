import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSpreadsheetEngine} from '../services/documentEngines.js';
import {monthDays,buildMonthlyWorkerReport,monthlyReportWorkbook,readAllPages,readMonthlyAttendance,loadMonthlyWorkerSources} from './monthlyWorkerReport.js';
const XLSX=await loadSpreadsheetEngine();
const worker={id:1,empresa:'TEST',nombre:'Ana',rut:'1-9',obra_nombre:'Actual',centro_gestion_id:4,fecha_asig:'2026-10-15'};
const mark={id:10,empresa:'TEST',trabajador:'Ana',rut:'1-9',fecha_marcacion:'2026-10-01',asistencia:'PRESENTE',obra_id:8,ingreso:'08:00',salida:'19:00',horas_extras_auto:1,horas_extras_manual:1,otras_horas:2.5};
const sources={attendance:[mark,{...mark}],allocations:[{id:1,empresa:'TEST',trabajador_id:1,fecha:'2026-10-01',estado:'Aprobada',origen:'Asistencia',centro_aprobado_id:2,horas_extra_aprobadas:0}],
  centers:[{id:2,empresa:'TEST',codigo:'C2',nombre:'Obra anterior'},{id:3,empresa:'TEST',codigo:'C3',nombre:'Secundario'}],works:[{id:8,empresa:'TEST',nombre:'Obra anterior',centro_gestion_id:2}],
  primary:[{id:1,empresa:'TEST',trabajador_id:1,fecha_inicio:'2026-09-01',fecha_termino:'2026-10-14',centro_gestion_id:2}],
  additional:[{id:1,empresa:'TEST',trabajador_id:1,fecha_inicio:'2026-10-01',fecha_termino:'2026-10-03',centro_gestion_id:3,centro_activo:false}]};
const input={company:'TEST',period:'2026-10',workers:[worker],selectedIds:[1],sources,today:'2026-10-19'};
test('mes completo, bisiesto y cambio de año',()=>{
  assert.equal(monthDays('2024-02').days.length,29);assert.equal(monthDays('2026-02').days.length,28);
  assert.equal(monthDays('2026-12').end,'2027-01-01');
  for(const value of ['2026-13','2026-2','xxx','0000-01'])assert.throws(()=>monthDays(value));
});
test('todos los días; no multiplica HE por centros ni suma otras horas a HE',()=>{
  const report=buildMonthlyWorkerReport(input);
  assert.equal(report.daily.length,31);assert.equal(report.marks.length,1);
  const day=report.daily[0];assert.equal(day.detected,1);assert.equal(day.approved,0);assert.equal(day.otherHours,2.5);
  assert.match(day.actualCenters,/Obra anterior/);assert.match(day.assignedCenters,/Secundario/);
  assert.doesNotMatch(report.daily[13].assignedCenters,/Actual/);assert.equal(report.daily[14].assignedCenters,'Actual');
  assert.equal(report.daily[3].otherHours,null);assert.equal(report.daily[3].approved,null);
  assert.equal(report.daily[9].state,'Sin registro');assert.equal(report.daily[30].state,'Fecha futura');
});
test('reglas son cargos, no asistencia; ausencia explícita y límite contractual',()=>{
  const report=buildMonthlyWorkerReport({...input,workers:[{...worker,fecha_inicio_contrato:'2026-10-02',fecha_vencimiento_contrato:'2026-10-15'}],sources:{...sources,
    attendance:[{...mark,fecha_marcacion:'2026-10-03',asistencia:'AUSENTE',otras_horas:0,horas_extras_auto:0}],
    allocations:[{...sources.allocations[0],fecha:'2026-10-02',origen:'Sin asistencia',horas_extra_aprobadas:2}]}});
  assert.equal(report.daily[0].state,'Fuera de contrato');assert.equal(report.daily[1].actualCenters,'');assert.equal(report.daily[1].approved,2);assert.equal(report.daily[1].detected,null);
  assert.equal(report.daily[2].state,'AUSENTE');assert.equal(report.daily[15].state,'Fuera de contrato');
});
test('empresa e identidad: no mezcla RUT, nombres ambiguos ni datos ajenos',()=>{
  const report=buildMonthlyWorkerReport({...input,workers:[worker,{...worker,id:2,nombre:'Otra persona'}],sources:{...sources,attendance:[mark,{...mark,id:20,empresa:'OTHER',otras_horas:100}]}});
  assert.equal(report.marks.length,0);assert.equal(report.warnings.length,1);
  assert.throws(()=>buildMonthlyWorkerReport({...input,selectedIds:[999]}),/Selecciona/);
  const renamed=buildMonthlyWorkerReport({...input,workers:[{...worker,nombre:'Ana Nueva'}]});assert.equal(renamed.marks.length,1);
});
test('Excel real: fechas y horas numéricas, filtros correctos, texto no ejecutable',()=>{
  const report=buildMonthlyWorkerReport({...input,workers:[{...worker,nombre:'=1+1'}]});
  const book=monthlyReportWorkbook(XLSX,report);
  const reopened=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
  const sheet=reopened.Sheets['Día a día'];
  assert.equal(sheet['!autofilter'].ref,'A6:N37');assert.equal(sheet.A7.t,'n');
  assert.equal(XLSX.SSF.format('yyyy-mm-dd',sheet.A7.v),'2026-10-01');
  assert.equal(sheet.C7.v,'=1+1');assert.equal(sheet.C7.f,undefined);assert.equal(sheet.K7.v,1);assert.equal(sheet.L7.v,0);assert.equal(sheet.M7.v,2.5);
  assert.equal(reopened.SheetNames.length,2);
});
test('paginación y errores: no entrega reportes parciales',async()=>{
  let calls=0;const rows=await readAllPages(()=>({range:async(from,to)=>{calls++;assert.equal(to-from,999);return {data:calls===1?Array.from({length:1000},(_,id)=>({id})):[{id:1001}]};}}));
  assert.equal(rows.length,1001);assert.equal(calls,2);
  await assert.rejects(readAllPages(()=>({range:async()=>({error:new Error('Sin permiso')})})),/Sin permiso/);
});
test('carga solo lectura, empresa en cada consulta y fecha manual independiente del ingreso',async()=>{
  const queries=[];
  const client={from(table){const q={table,filters:[]};queries.push(q);const chain={};
    for(const method of ['select','eq','gte','lt','is','or','order'])chain[method]=(...args)=>{q.filters.push([method,...args]);return chain;};
    chain.range=async()=>({data:table==='asistencia_personal'&&q.filters.some(f=>f[0]==='gte'&&f[1]==='fecha_marcacion')?[{...mark,created_at:'2026-11-03T12:00:00Z'}]:[]});return chain;}};
  const result=await loadMonthlyWorkerSources(client,'TEST','2026-10');assert.equal(result.attendance.length,1);
  assert.ok(queries.every(q=>q.filters.some(f=>f[0]==='eq'&&f[1]==='empresa'&&f[2]==='TEST')));
  assert.ok(queries.every(q=>q.filters[0][0]==='select'));
  assert.equal((await readMonthlyAttendance(client,'TEST','2026-10')).length,1);
});
