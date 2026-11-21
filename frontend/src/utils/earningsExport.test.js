import test from 'node:test';import assert from 'node:assert/strict';
import X from 'xlsx-js-style';
import {earningForExport,earningOverlaps} from './earningPeriod.js';
import {loadEarningsExport} from './earningsExport.js';
import {loncoWorkbook} from './loncoWorkbook.js';
const worker={id:1,nombre:'Prueba',rut:'1-9'},from='2026-10-21',to='2026-11-20';
test('21-20 includes both full monthly allocations and overlapping ranges exactly once',()=>{
 const allocations=['2026-10','2026-11','2026-10-01/2026-12-31','2026-09'].map(date=>({date,worker,name:'Bono',amount:30000,work:'Lonco'}));
 const earnings=allocations.map(h=>earningForExport(h,[],from,to)).filter(Boolean);assert.equal(earnings.length,3);assert.equal(earnings.reduce((s,h)=>s+h.amount,0),90000);
 const book=loncoWorkbook(X,'2026-11',[worker],[],earnings,from,to);assert.equal(book.Sheets.RESUMEN.H6.v,90000);assert.match(book.Sheets.RESUMEN.I6.v,/2026-10-01/);
 const reopened=X.read(X.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});assert.equal(reopened.Sheets.RESUMEN.H6.v,90000);
 assert.equal(earningOverlaps('2026-11-21',from,to),false);
});
test('proportional counts unique PRESENT days on the assignment work, not duplicates or absences',()=>{
 const marks=[['2026-10-10','PRESENTE',32],['2026-10-22','PRESENTE',32],['2026-10-22','PRESENTE',32],['2026-10-23','AUSENTE',32],['2026-10-24','PRESENTE',84]].map(([fecha_marcacion,asistencia,obra_id])=>({fecha_marcacion,asistencia,obra_id,rut:'19'}));
 const h={date:'2026-10',worker,name:'Bono',amount:30000,proportional:true,workId:32};
 assert.equal(earningForExport(h,marks,from,to).amount,15000);assert.match(earningForExport(h,marks,from,to).note,/1\/2/);
 assert.throws(()=>earningForExport(h,[],from,to),/no hay días trabajados/);
 assert.equal(earningForExport({...h,proportional:false},[],from,to).amount,30000);
});
test('loader keeps long overlapping assignments and scopes works/workers before export',async()=>{
 const rows=[{obra_id:32,trabajador_id:1,periodo:'2026-12',referencia:'2026-10-01/2026-12-31',monto:100,concepto:'Largo',maestro_personal:worker,obras:{nombre:'Lonco'}},{obra_id:84,trabajador_id:2,periodo:'2026-11',referencia:'2026-11',monto:900,concepto:'Otro'}];
 const db={from(table){let filters=[];const q={select:()=>q,eq:(k,v)=>{if(k!=='empresa')filters.push(r=>String(r[k])===String(v));return q;},gte:(k,v)=>{filters.push(r=>r[k]>=v);return q;},lte:(k,v)=>{filters.push(r=>r[k]<=v);return q;},in:(k,v)=>{filters.push(r=>v.map(String).includes(String(r[k])));return q;},order:()=>q,range:async(a,b)=>({data:(table==='rrhh_haberes_obra'?rows:[]).filter(r=>filters.every(f=>f(r))).slice(a,b+1)})};return q;}};
 const result=await loadEarningsExport(db,{empresa:'TEST',workers:[worker],workIds:['32'],workerIds:['1'],from,to});assert.equal(result.earnings.length,1);assert.equal(result.earnings[0].amount,100);
});
test('configured personal monthly allocations export full or actual marked days, one per month',async()=>{
 const allocations=[{nombre:'Fijo',monto:200000,desde:'2026-10',calculo:'completo'},{nombre:'Variable',monto:300000,desde:'2026-10',calculo:'marcajes'}];
 const marks=['2026-10-10','2026-10-22','2026-10-22','2026-11-02','2026-11-21','2026-11-22'].map(fecha_marcacion=>({id:1,rut:'19',asistencia:'PRESENTE',fecha_marcacion}));
 const bounds={};
 const db={from(table){const q={select:()=>q,eq:()=>q,in:()=>q,gte:(key,value)=>{if(table==='asistencia_personal')bounds.from=value;return q;},lte:(key,value)=>{if(table==='asistencia_personal')bounds.to=value;return q;},order:()=>q,range:async()=>({data:table==='maestro_personal'?[{id:1,otras_asignaciones:allocations}]:table==='asistencia_personal'?marks:[]})};return q;}};
 const result=await loadEarningsExport(db,{empresa:'TEST',workers:[worker],workIds:['32'],workerIds:['1'],from,to});
 assert.deepEqual(bounds,{from:'2026-10-01',to:'2026-11-30'});
 assert.equal(result.earnings.length,4);assert.equal(result.earnings.reduce((s,h)=>s+h.amount,0),650000);
 assert.deepEqual(result.earnings.filter(h=>h.proportional).map(h=>h.amount),[150000,100000]);
 assert.match(result.earnings.find(h=>h.proportional).note,/1\/2 días trabajados/);
 const book=loncoWorkbook(X,'2026-11',[worker],result.marks,result.earnings,from,to);
 const reopened=X.read(X.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.equal(reopened.Sheets.RESUMEN.H6.v,650000);
 assert.throws(()=>earningForExport({worker,date:'2026-11',name:'Vacío',amount:300000,proportional:true,calculation:'monthly_marks'},[],from,to),/no hay días trabajados/);
});
test('monthly marks use the complete period denominator without a 30-day cap',()=>{
 const h={worker,date:'2026-10',name:'Mensual',amount:310000,proportional:true,calculation:'monthly_marks'};
 const marks=Array.from({length:31},(_,i)=>({rut:'19',asistencia:'PRESENTE',fecha_marcacion:`2026-10-${String(i+1).padStart(2,'0')}`}));
 assert.equal(earningForExport(h,marks,'2026-10-01','2026-10-31').amount,310000);
 assert.equal(earningForExport(h,marks,'2026-10-21','2026-10-31').amount,110000);
 assert.match(earningForExport(h,marks,'2026-10-21','2026-10-31').note,/11\/31/);
 assert.equal(earningForExport(h,marks.slice(0,2),'2026-10-21','2026-10-31').amount,0);
});
