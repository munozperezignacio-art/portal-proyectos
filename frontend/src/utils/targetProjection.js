import {calendarTimeline} from './sCurveTimeline.js';
import {recentProductionForecast} from './recentProductionForecast.js';
import {validSimulationDate} from './projectSimulator.js';
export function targetProjection({parts=[],reports=[],cutoff,date,baselineFinish,targets={},budgets={},holidays=[],actualCost,costError='',futureCosts=[],extraCost=0,coverage=false,costBudget=0,machineryActual=0,estimateRemaining=false}){
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
  const price=p.unitPrice??p.pu??p.costo_por_dia;
  const sale=price!==''&&price!=null&&Number.isFinite(Number(price))&&Number(price)>=0?r.quantity*Number(price):null;
  return {...r,key,pct:Number(pct),target,pending,days,required,planned,budget,sale,increase:r.pace>0&&required!=null?(required/r.pace-1)*100:null};
 });
 const validBudgets=rows.length>0&&rows.every(r=>r.budget!=null&&r.quantity>0);
 const bac=validBudgets?rows.reduce((s,r)=>s+r.budget,0):null;
 const budgetMatch=!(costBudget>0)||bac!=null&&Math.abs(bac-Number(costBudget))<=1;
 const valid=validBudgets&&budgetMatch&&bac>0;
 const ev=valid?rows.reduce((s,r)=>s+r.budget*r.pct/100,0):null;
 const pv=valid&&rows.every(r=>r.planned!=null)?rows.reduce((s,r)=>s+r.budget*r.planned,0):null;
 const future=futureCosts.filter(c=>c.fecha>cutoff&&c.fecha<=date);
 const validAmount=n=>n!==''&&n!=null&&Number.isFinite(Number(n));
 const registeredCost=!costError&&validAmount(actualCost)&&future.every(c=>validAmount(c.monto))?Number(actualCost)+future.reduce((s,c)=>s+Number(c.monto),0)+Number(extraCost):null;
 const saleTotal=rows.length&&rows.every(r=>r.sale!=null)?rows.reduce((s,r)=>s+r.sale,0):null;
 const targetSale=saleTotal!=null?rows.reduce((s,r)=>s+r.sale*r.pct/100,0):null;
 const plannedSale=saleTotal!=null&&rows.every(r=>r.planned!=null)?rows.reduce((s,r)=>s+r.sale*r.planned,0):null;
 const earnedSale=saleTotal!=null?rows.reduce((s,r)=>s+(r.quantity>0?r.sale*r.completed/r.quantity:0),0):null;
 const registeredOther=future.filter(c=>c.categoria_proyeccion!=='Uso diario de maquinaria').reduce((s,c)=>s+(Number(c.monto)||0),0);
 const otherActual=validAmount(actualCost)?Math.max(0,Number(actualCost)-Number(machineryActual||0)):0;
 // Extrapolate non-machinery costs by production, never as confirmed payroll.
 // Registered non-machinery forecasts cover the estimate first, not twice.
 const residualEstimate=estimateRemaining&&earnedSale>0?Math.max(0,otherActual*Math.max(0,targetSale-earnedSale)/earnedSale-registeredOther):0;
 const ac=registeredCost!=null?registeredCost+residualEstimate:null;
 const profit=targetSale!=null&&ac!=null?targetSale-ac:null;
 const spi=pv>0?ev/pv:null,cpi=coverage&&ac>0&&ev!=null?ev/ac:null;
 return {rows,bac,ev,pv,ac,spi,cpi,residualEstimate,estimateAvailable:earnedSale>0&&otherActual>0,saleTotal,targetSale,plannedSale,profit,margin:targetSale>0&&profit!=null?profit/targetSale*100:null,salePercent:saleTotal>0?targetSale/saleTotal*100:null,saleSpi:plannedSale>0?targetSale/plannedSale:null,sv:ev!=null&&pv!=null?ev-pv:null,cv:cpi!=null?ev-ac:null,eac:cpi>0?ac+(bac-ev)/cpi:null,
  globalPercent:valid?ev/bac*100:null,budgetMatch,complete:rows.length>0&&rows.every(r=>r.pct===100),registeredFuture:future.reduce((s,c)=>s+(Number(c.monto)||0),0)};
}
