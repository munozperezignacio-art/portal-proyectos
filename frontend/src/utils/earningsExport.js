import {earningDates,earningOverlaps,earningForExport} from './earningPeriod.js';
import {rutKey} from './loncoWorkbook.js';
export async function exportPages(query){const rows=[];for(let n=0;;n+=300){const {data,error}=await query().range(n,n+299);if(error)throw error;rows.push(...data);if(data.length<300)return rows;}}
export async function loadEarningsExport(db,{empresa,obra,workIds=null,workerIds=null,workers,from,to,novelties={},includePayroll=false}){
 if(!from||!to||from>to)throw Error('Revisa las fechas del informe.');
 if(workIds?.length===0||workerIds?.length===0)throw Error('Selecciona al menos una obra y un trabajador, o elige todos.');
 const scoped=q=>obra?q.eq('obra_id',obra.id):workIds?q.in('obra_id',workIds):q;
 const haberes=await exportPages(()=>scoped(db.from('rrhh_haberes_obra').select('obra_id,trabajador_id,concepto,monto,referencia,tipo,clave,proporcional,maestro_personal(nombre,rut,cargo),obras(nombre)').eq('empresa',empresa).gte('periodo',from.slice(0,7))).order('obra_id').order('trabajador_id').order('referencia').order('tipo').order('clave'));
 const people=new Map(workers.filter(w=>workerIds===null||workerIds.includes(String(w.id))).map(w=>[String(w.id),w]));
 const earnings=[];
 for(const h of haberes){if(!earningOverlaps(h.referencia,from,to)||workerIds!==null&&!workerIds.includes(String(h.trabajador_id)))continue;const w=people.get(String(h.trabajador_id))||{id:h.trabajador_id,...h.maestro_personal};people.set(String(w.id),w);earnings.push({worker:w,date:h.referencia,name:h.concepto,amount:h.monto,proportional:h.proporcional,workId:h.obra_id,work:obra?.nombre||h.obras?.nombre||'Obra '+h.obra_id});}
 if(!obra&&includePayroll){
  const saved=await exportPages(()=>db.from('rrhh_nomina_items').select('id,trabajador_id,novedades,rrhh_nominas_mensuales!inner(empresa,periodo)').eq('rrhh_nominas_mensuales.empresa',empresa).gte('rrhh_nominas_mensuales.periodo',from.slice(0,7)).order('id'));
  const payroll=new Map();
  const add=(id,items)=>{const worker=people.get(String(id));if(!worker)return;for(const [k,h] of Object.entries(items||{})){if(!h.date||k.startsWith('[')&&JSON.parse(k).length===4)continue;payroll.set(JSON.stringify([id,k]),{worker,...h,work:'Nómina RRHH'});}};
  for(const row of saved)add(row.trabajador_id,row.novedades?.haberes_detallados);
  for(const [id,n] of Object.entries(novelties))add(id,n.haberes_detallados);
  earnings.push(...[...payroll.values()].filter(h=>earningOverlaps(h.date,from,to)));
 }
 // Fetch only allocations for the already-authorized roster; never salary fields.
 const ids=[...people.keys()];
 if(ids.length){
  const allocations=await exportPages(()=>db.from('maestro_personal').select('id,otras_asignaciones').eq('empresa',empresa).in('id',ids).order('id'));
  for(const person of allocations){const worker=people.get(String(person.id));if(!worker)continue;
   for(const row of person.otras_asignaciones||[]){
    // Older allocations retain their paid-days calculation in payroll until explicitly configured.
    if(!['marcajes','completo'].includes(row.calculo))continue;
    let month=from.slice(0,7);
    while(month<=to.slice(0,7)){
     if(row.desde<=month&&(!row.hasta||row.hasta>=month))earnings.push({worker,date:month,name:row.nombre,amount:row.monto,proportional:row.calculo==='marcajes',calculation:'monthly_marks',work:'Asignación mensual personal'});
     const [year,m]=month.split('-').map(Number);month=m===12?`${year+1}-01`:`${year}-${String(m+1).padStart(2,'0')}`;
    }
   }
  }
 }
 let markFrom=from,markTo=to;
 for(const h of earnings.filter(h=>h.proportional)){const [a,b]=earningDates(h.date);if(a<markFrom)markFrom=a;if(b>markTo)markTo=b;}
 const allMarks=await exportPages(()=>scoped(db.from('asistencia_personal').select('id,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,otras_horas,horas_extras_auto,horas_extras_manual').eq('empresa',empresa).gte('fecha_marcacion',markFrom).lte('fecha_marcacion',markTo)).order('id'));
 const ruts=new Set([...people.values()].map(w=>rutKey(w.rut)).filter(Boolean));
 return {workers:[...people.values()],marks:allMarks.filter(m=>(workerIds===null||ruts.has(rutKey(m.rut)))&&m.fecha_marcacion>=from&&m.fecha_marcacion<=to),earnings:earnings.map(h=>earningForExport(h,allMarks,from,to)).filter(Boolean)};
}
