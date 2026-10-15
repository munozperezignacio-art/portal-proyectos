import { calendarTimeline } from './sCurveTimeline.js';
import { matchesWorkReport } from './workReportCalculations.js';
const dayOf = row => String(row.fecha || row.fecha_avance || row.created_at || '').slice(0,10);
export function productionAdvice({ parts=[], reports=[], costs=[], cutoff, baselineFinish, holidays=[], costError='' }) {
  const holidaySet=new Set(holidays);
  const workday=date=>![0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) && !holidaySet.has(date);
  const scoped=reports.filter(r=>dayOf(r) && dayOf(r)<=cutoff);
  // Include exceptional production on a non-working day in both quantities and denominator.
  const reportedDates=new Set(scoped.map(dayOf));
  const first=[...parts.map(p=>p.start),...scoped.map(dayOf),cutoff].filter(Boolean).sort()[0];
  const recentDates=calendarTimeline(first,cutoff).filter(d=>workday(d.dateStr)||reportedDates.has(d.dateStr)).slice(-5).map(d=>d.dateStr);
  const recentSet=new Set(recentDates);
  const availableDays=calendarTimeline(cutoff,baselineFinish).slice(1).filter(d=>workday(d.dateStr)).length;
  const rows=parts.filter(p=>!p.es_titulo && !['TITULO','GRUPO'].includes(p.unidad)).map(p=>{
    const quantity=Number(p.quantity)||0;
    const own=scoped.filter(r=>matchesWorkReport(r,p));
    const completed=Math.max(0,Math.min(quantity,own.reduce((sum,r)=>sum+(Number(r.cantidad)||0),0)));
    const remaining=Math.max(0,quantity-completed);
    const recentQuantity=own.filter(r=>recentSet.has(dayOf(r))).reduce((sum,r)=>sum+(Number(r.cantidad)||0),0);
    const activeRecent=recentDates.filter(d=>!p.start || d>=p.start);
    const pace=activeRecent.length ? Math.max(0,recentQuantity)/activeRecent.length : null;
    const deadline=p.finish && p.finish<baselineFinish ? p.finish : baselineFinish;
    const days=calendarTimeline(cutoff,deadline).slice(1).filter(d=>workday(d.dateStr) && (!p.start || d.dateStr>=p.start)).length;
    const required=remaining>0 && days>0 ? remaining/days : null;
    const increase=required!=null && pace>0 ? Math.max(0,(required/pace-1)*100) : null;
    const daysAtPace=remaining>0 && pace>0 ? Math.ceil(remaining/pace) : remaining===0 ? 0 : null;
    let finishAtPace=null;
    if(daysAtPace!=null && daysAtPace<=5200) {
      const date=new Date(`${cutoff}T12:00:00Z`); let pending=daysAtPace;
      while(pending>0) { date.setUTCDate(date.getUTCDate()+1); if(workday(date.toISOString().slice(0,10)))pending--; }
      finishAtPace=date.toISOString().slice(0,10);
    }
    const cost=costError ? null : Number(p.actualCost)||0;
    return {id:p.id,name:p.partida,unit:p.unidad,remaining,completed,pace,required,increase,deadline,days,finishAtPace,cost,unitCost:cost>0 && completed>0 ? cost/completed : null,
      status:remaining===0?'complete':!days?'deadline':p.start>cutoff?'not-started':!(pace>0)?'no-production':required>pace?'accelerate':'on-track'};
  }).filter(p=>p.remaining>0 || p.cost>0);
  const categories=new Map();
  if(!costError) for(const row of costs) {
    if(dayOf(row)>cutoff)continue;
    const amount=Number(row.monto ?? row.monto_real)||0;
    const category=row.categoria_proyeccion || row.tipo_costo || 'Otros costos';
    categories.set(category,(categories.get(category)||0)+amount);
  }
  const totalCost=[...categories.values()].reduce((s,n)=>s+n,0);
  const costDrivers=[...categories].filter(([,amount])=>amount>0).map(([name,amount])=>({name,amount,share:totalCost>0?amount/totalCost*100:null})).sort((a,b)=>b.amount-a.amount);
  return {rows:rows.sort((a,b)=>(a.status==='deadline'?-1:b.status==='deadline'?1:0)||((b.increase||0)-(a.increase||0))),recentDates,availableDays,costDrivers};
}
