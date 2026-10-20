import { calendarTimeline } from './sCurveTimeline.js';
import { matchesWorkReport } from './workReportCalculations.js';
const day = r => String(r.fecha || r.fecha_avance || r.created_at || '').slice(0,10);
const add = (date,n) => new Date(Date.parse(`${date}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);

// Quantities of different units are never added. Project finish is the latest
// resolved activity finish, and is withheld when any pending activity is unknown.
export function recentProductionForecast({parts=[],reports=[],cutoff,holidays=[]}) {
  const holidaySet=new Set(holidays);
  const working=date=>![0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())&&!holidaySet.has(date);
  const shift=(date,count)=>{let result=date;for(let i=0;i<Math.abs(count);){result=add(result,Math.sign(count));if(working(result))i++;}return result;};
  const rows=parts.filter(p=>!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)).map(p=>{
    const own=reports.filter(r=>day(r)&&day(r)<=cutoff&&matchesWorkReport(r,p));
    const quantity=Math.max(0,Number(p.quantity??p.cantidad??p.cantidad_presupuestada)||0);
    const completed=Math.min(quantity,Math.max(0,own.reduce((s,r)=>s+(Number(r.cantidad)||0),0)));
    const firstReport=own.map(day).sort()[0];
    const start=[p.start,firstReport].filter(Boolean).sort()[0];
    const recentDates=[];
    // Five scheduled working days, not five successful reports. A weekend
    // reported by another activity must not change this activity's denominator.
    for(let date=cutoff,checked=0;recentDates.length<5&&checked<370;date=add(date,-1),checked++) {
      if(start&&date<start)break;
      if(working(date)||own.some(r=>day(r)===date))recentDates.unshift(date);
    }
    const recentQuantity=own.filter(r=>recentDates.includes(day(r))).reduce((s,r)=>s+(Number(r.cantidad)||0),0);
    const pace=recentDates.length?Math.max(0,recentQuantity)/recentDates.length:null;
    const plannedRate=Number(p.rendimiento_meta??p.rendimiento)||0;
    const plannedDaily=!p.unidad_tiempo||['día','dia'].includes(String(p.unidad_tiempo).toLowerCase());
    const future=Boolean(start&&start>cutoff&&!own.length);
    const rate=future&&plannedDaily&&plannedRate>0?plannedRate:pace;
    return {id:p.id,name:p.partida,unit:p.unidad,quantity,completed,remaining:quantity-completed,start,
      recentDates,recentQuantity,pace,rate,basis:future?'plan':'recent',predecessor:p.predecesora,
      relation:p.tipo_relacion||'FS',lag:Number(p.desfase_dias)||0,finish:null,forecastStart:null,actualStart:firstReport,
      lastReport:own.map(day).sort().at(-1),issue:quantity>0?null:'Falta cantidad presupuestada válida'};
  });
  const visiting=new Set(),done=new Set();
  function resolve(row) {
    if(done.has(row))return;
    if(visiting.has(row)){row.issue='Dependencia circular';return;}
    visiting.add(row);
    if(!row.remaining&&!row.issue){row.finish=row.lastReport||cutoff;row.forecastStart=row.start||row.finish;}
    else {
      let earliest=[add(cutoff,1),row.start].filter(Boolean).sort().at(-1);
      if(row.predecessor){
        const pred=rows.find(p=>p.name===row.predecessor||String(p.id)===String(row.predecessor));
        if(!pred)row.issue='Predecesora fuera del alcance o inexistente';
        else {
          resolve(pred);
          if(pred.issue||!pred.finish)row.issue='Predecesora sin término estimable';
          else if(!['FS','SS'].includes(row.relation))row.issue='Relación de planificación no soportada';
          else if(!Number.isInteger(row.lag)||Math.abs(row.lag)>5200)row.issue='Desfase inválido';
          else {
            const boundary=shift(row.relation==='SS'?(pred.actualStart||pred.forecastStart):pred.finish,row.lag+(row.relation==='FS'?1:0));
            if(boundary>earliest)earliest=boundary;
          }
        }
      }
      const duration=row.rate>0?Math.ceil(row.remaining/row.rate):null;
      if(!row.issue&&(!duration||duration>5200))row.issue=duration?'Horizonte superior a 5200 jornadas':'Sin producción reciente para estimar';
      if(!row.issue){while(!working(earliest))earliest=add(earliest,1);row.forecastStart=earliest;row.finish=shift(earliest,duration-1);}
    }
    visiting.delete(row);done.add(row);
  }
  rows.forEach(resolve);
  const unresolved=rows.filter(r=>r.issue||(r.remaining>0&&!r.finish));
  const finish=rows.length&&!unresolved.length?rows.map(r=>r.finish).sort().at(-1):null;
  return {rows,finish,unresolved,planned:rows.filter(r=>r.remaining>0&&r.basis==='plan'),
    duration:finish?calendarTimeline(cutoff,finish).slice(1).filter(d=>working(d.dateStr)).length:null};
}
