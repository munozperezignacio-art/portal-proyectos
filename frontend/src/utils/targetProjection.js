import {calendarTimeline} from './sCurveTimeline.js';
import {recentProductionForecast} from './recentProductionForecast.js';
import {validSimulationDate} from './projectSimulator.js';
export function targetProjection({parts=[],reports=[],cutoff,date,baselineFinish,targets={},budgets={},holidays=[],actualCost,costError='',futureCosts=[],extraCost=0,coverage=false,costBudget=0}){
 if(!validSimulationDate(date)||date<=cutoff)throw Error('La fecha objetivo debe ser posterior al corte real.');
 if((Date.parse(date)-Date.parse(cutoff))/86400000>1096)throw Error('El escenario admite un máximo de tres años desde el corte.');
 if(!Number.isFinite(Number(extraCost))||Number(extraCost)<0)throw Error('El costo adicional debe ser mayor o igual a cero.');
 const working=d=>![0,6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())&&!holidays.includes(d);
 const production=recentProductionForecast({parts,reports,cutoff,holidays});
 const rows=production.rows.map(r=>{
  const p=parts.find(p=>p.id===r.id&&p.partida===r.name),key=String(r.id??r.name);
  const pct=targets[key]??100;
  if(pct===''||!Number.isFinite(Number(pct))||Number(pct)<0||Number(pct)>100||Number(pct)*r.quantity/100+1e-8<r.completed)throw Error(`Revisa el porcentaje de ${r.name}: no puede ser menor que lo ejecutado ni mayor que 100%.`);
  const target=r.quantity*Number(pct)/100,pending=Math.max(0,target-r.completed);
  const days=calendarTimeline(cutoff,date).slice(1).filter(d=>working(d.dateStr)&&(!p.start||d.dateStr>=p.start)).length;
  const required=pending===0?0:days?pending/days:null;
  const plan=calendarTimeline(p.start,p.finish||baselineFinish).filter(d=>working(d.dateStr));
  const planned=plan.length?plan.filter(d=>d.dateStr<=date).length/plan.length:null;
  const raw=budgets[key],budget=raw!==''&&raw!=null&&Number.isFinite(Number(raw))&&Number(raw)>=0?Number(raw):null;
  return {...r,key,pct:Number(pct),target,pending,days,required,planned,budget,increase:r.pace>0&&required!=null?(required/r.pace-1)*100:null};
 });
 const validBudgets=rows.length>0&&rows.every(r=>r.budget!=null&&r.quantity>0);
 const bac=validBudgets?rows.reduce((s,r)=>s+r.budget,0):null;
 const budgetMatch=!(costBudget>0)||bac!=null&&Math.abs(bac-Number(costBudget))<=1;
 const valid=validBudgets&&budgetMatch&&bac>0;
 const ev=valid?rows.reduce((s,r)=>s+r.budget*r.pct/100,0):null;
 const pv=valid&&rows.every(r=>r.planned!=null)?rows.reduce((s,r)=>s+r.budget*r.planned,0):null;
 const future=futureCosts.filter(c=>c.fecha>cutoff&&c.fecha<=date);
 const ac=!costError&&actualCost!=null&&future.every(c=>c.monto!=null)?Number(actualCost)+future.reduce((s,c)=>s+Number(c.monto),0)+Number(extraCost):null;
 const spi=pv>0?ev/pv:null,cpi=coverage&&ac>0&&ev!=null?ev/ac:null;
 return {rows,bac,ev,pv,ac,spi,cpi,sv:ev!=null&&pv!=null?ev-pv:null,cv:cpi!=null?ev-ac:null,eac:cpi>0?ac+(bac-ev)/cpi:null,
  globalPercent:valid?ev/bac*100:null,budgetMatch,complete:rows.length>0&&rows.every(r=>r.pct===100),registeredFuture:future.reduce((s,c)=>s+(Number(c.monto)||0),0)};
}
