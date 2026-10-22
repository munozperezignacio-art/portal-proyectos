import {matchesWorkReport} from './workReportCalculations.js';
import {productionAdvice} from './productionAdvice.js';
import {costState,costStateLabel} from './costControl.js';
const DAY=86400000;
export const simulationDate=value=>String(value||'').slice(0,10);
export function validSimulationDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function addSimulationDays(date,days){if(!validSimulationDate(date))return '';return new Date(Date.parse(`${date}T12:00:00Z`)+days*DAY).toISOString().slice(0,10);}
export function simulationDates(start,end){
  if(!validSimulationDate(start)||!validSimulationDate(end)||end<start)throw new Error('Revisa las fechas: el horizonte debe terminar después del inicio.');
  const length=Math.round((Date.parse(end)-Date.parse(start))/DAY)+1;
  if(length>1096)throw new Error('El simulador admite un horizonte máximo de 3 años.');
  return Array.from({length},(_,i)=>addSimulationDays(start,i));
}
function nonnegative(value,label){if(value===''||value==null||!Number.isFinite(Number(value))||Number(value)<0)throw new Error(`Indica ${label} como número mayor o igual a cero.`);return Number(value);}
export function seedSimulationParts(parts,reports,cutoff,deadline,holidays=[]){
  const advice=productionAdvice({parts,reports,cutoff,baselineFinish:deadline,holidays});
  return parts.filter(p=>!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)).map(p=>{
    const quantity=Math.max(0,Number(p.quantity??p.cantidad??p.cantidad_presupuestada)||0);
    const completed=Math.min(quantity,Math.max(0,reports.filter(r=>simulationDate(r.fecha||r.fecha_avance||r.created_at)<=cutoff&&matchesWorkReport(r,p)).reduce((sum,r)=>sum+(Number(r.cantidad)||0),0)));
    const pace=advice.rows.find(r=>String(r.id??r.name)===String(p.id??p.partida))?.pace;
    return {id:String(p.id??p.partida),name:p.partida,unit:p.unidad||'UND',quantity,completed,remaining:Math.max(0,quantity-completed),pace:pace==null?0:Math.round(pace*10000)/10000,start:p.start&&p.start>cutoff?p.start:addSimulationDays(cutoff,1),overrides:{}};
  });
}
export function simulateProject({cutoff,start,end,deadline,weekdays=[1,2,3,4,5],holidays=[],calendar={},parts=[],resources=[],actualCost,costError='',baseCosts=[],historicalCosts=[],remainingOtherCost=0}){
  if(!validSimulationDate(cutoff)||start<=cutoff)throw new Error('La simulación debe comenzar después del corte real, para no duplicar costos ni producción.');
  if(deadline&&!validSimulationDate(deadline))throw new Error('Indica una fecha objetivo válida.');
  const dates=simulationDates(start,end),holidaySet=new Set(holidays);
  if(deadline&&deadline>end)throw new Error('Amplía el horizonte hasta la fecha objetivo, o ajusta la fecha objetivo.');
  const isWorkday=date=>typeof calendar[date]==='boolean'?calendar[date]:weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())&&!holidaySet.has(date);
  if(!parts.length)throw new Error('Se necesita al menos una partida ejecutable para simular el término.');
  if(parts.some(p=>p.quantity!=null&&!(Number(p.quantity)>0)))throw new Error('Hay partidas sin cantidad objetivo mayor que cero. Completa sus metas en el presupuesto antes de simular el término de este alcance.');
  const states=parts.map(p=>{
    if(!validSimulationDate(p.start))throw new Error(`Revisa el inicio de ${p.name}.`);
    const remaining=nonnegative(p.remaining,`cantidad pendiente de ${p.name}`),pace=nonnegative(p.pace,`rendimiento de ${p.name}`);
    return {...p,remaining,initialRemaining:remaining,pace,finish:remaining===0?cutoff:null,produced:0,actualStart:null};
  });
  if(new Set(states.map(p=>p.id)).size!==states.length)throw new Error('Hay partidas repetidas en el escenario.');
  const byId=new Map(states.map(p=>[p.id,p])),visited=new Set(),visiting=new Set();
  const visit=p=>{
    if(visiting.has(p.id))throw new Error('Las dependencias forman un ciclo. Una partida no puede depender de sí misma ni de una sucesora.');
    if(visited.has(p.id))return;
    visiting.add(p.id);
    for(const id of p.predecessors||[]){
      if(!byId.has(id))throw new Error(`La predecesora de ${p.name} no está en este alcance.`);
      visit(byId.get(id));
    }
    visiting.delete(p.id);visited.add(p.id);
  };
  states.forEach(visit);
  const modes=['fixed','workday','calendar','hour','month22','month30','units'];
  const resourceStates=resources.map(r=>{
    if(!modes.includes(r.mode))throw new Error(`Selecciona cómo cobrar ${r.name}.`);
    if(!validSimulationDate(r.start)||r.end&&(!validSimulationDate(r.end)||r.end<r.start))throw new Error(`Revisa las fechas de ${r.name}.`);
    if(r.partId&&!states.some(p=>p.id===r.partId))throw new Error(`La partida de ${r.name} ya no está en el escenario.`);
    if(r.mode==='units'&&!r.partId)throw new Error(`Vincula ${r.name} a una partida para no mezclar unidades.`);
    return {...r,rate:nonnegative(r.rate,`tarifa de ${r.name}`),quantity:nonnegative(r.quantity,`cantidad de ${r.name}`),total:0};
  });
  const days=[];let finish=states.every(p=>p.finish)?cutoff:null;
  for(const date of dates){
    const working=isWorkday(date),production={};
    for(const p of states){
      const override=p.overrides?.[date];
      const pace=override==null||override===''?p.pace:nonnegative(override,`rendimiento de ${p.name} el ${date}`);
      // Fin-inicio: la sucesora comienza en una jornada posterior, independientemente del orden del listado.
      const ready=(p.predecessors||[]).every(id=>byId.get(id).finish&&byId.get(id).finish<date);
      if(working&&date>=p.start&&ready&&!p.actualStart&&p.initialRemaining>0)p.actualStart=date;
      const produced=working&&date>=p.start&&ready?Math.min(p.remaining,pace):0;
      p.remaining=Math.max(0,p.remaining-produced);p.produced+=produced;production[p.id]=produced;
      if(!p.finish&&p.remaining<1e-9){p.remaining=0;p.finish=date;}
    }
    if(!finish&&states.every(p=>p.finish))finish=date;
    let cost=0;const charges=[];
    for(const r of resourceStates){
      const part=states.find(p=>p.id===r.partId);
      if(part&&!part.actualStart&&part.initialRemaining>0)continue;
      const partStart=part?.actualStart||part?.start;
      const chargeStart=partStart&&partStart>r.start?partStart:r.start;
      const chargeEnd=r.untilFinish===false?end:part?.finish||finish||end;
      if(date<chargeStart||date>chargeEnd||r.end&&date>r.end||part?.initialRemaining===0)continue;
      let units=0;
      if(r.mode==='fixed')units=date===chargeStart?1:0;
      if(r.mode==='calendar')units=1;
      if(['workday','hour'].includes(r.mode))units=working?1:0;
      if(r.mode==='month22')units=working?1/22:0;
      if(r.mode==='month30')units=1/30;
      if(r.mode==='units')units=production[r.partId]||0;
      // CLP entero por recurso y día: detalle, recursos y meses concilian exactamente.
      const amount=Math.round(units*r.rate*r.quantity);
      if(!Number.isFinite(amount)||!Number.isFinite(r.total+amount))throw new Error(`El costo de ${r.name} excede el rango numérico. Revisa tarifa y cantidad.`);
      r.total+=amount;cost+=amount;
      if(units>0)charges.push({resourceId:r.id,name:r.name,source:r.source||'Costo manual',partName:part?.name||'Toda la obra',mode:r.mode,rate:r.rate,quantity:r.quantity,units,amount});
    }
    days.push({date,working,production,cost,charges});
  }
  // The existing work ledger is the baseline, not an optional catalog selection.
  // Keep its dates and decisions (non-use, retirement, reconciliation) unchanged.
  const baselineTotals=new Map();
  const append=(day,row,source)=>{
    const raw=row.monto??row.monto_real;
    if(raw==null||raw===''||!Number.isFinite(Number(raw)))throw new Error(`Falta el importe de ${row.nombre||row.trabajador||row.equipo_patente||'un cargo de la obra'} el ${day.date}. No se considera cero.`);
    const amount=Math.round(Number(raw));
    const name=row.nombre||row.trabajador||[row.equipo_tipo,row.equipo_patente].filter(Boolean).join(' ')||row.categoria_proyeccion||'Costo de obra';
    const charge={resourceId:`base-${baselineTotals.size}-${day.date}`,name,source,partName:'Toda la obra',mode:'fixed',rate:amount,quantity:1,units:1,amount};
    day.charges.push(charge);day.cost+=amount;
    return charge;
  };
  const futureDays=new Map(days.map(d=>[d.date,d]));
  let registeredOther=0;
  for(const row of baseCosts){
    const date=simulationDate(row.fecha_costo||row.fecha||row.created_at),day=futureDays.get(date);
    if(!day||date> (finish||end))continue;
    const charge=append(day,row,`Proyectado · ${row.origen_costo||row.fuente||row.categoria_proyeccion||'Registro de obra'}`);
    const key=JSON.stringify([charge.name,charge.source]);
    const item=baselineTotals.get(key)||{id:`base-${baselineTotals.size}`,name:charge.name,total:0};charge.resourceId=item.id;item.total+=charge.amount;baselineTotals.set(key,item);
    if(row.categoria_proyeccion!=='Uso diario de maquinaria')registeredOther+=charge.amount;
  }
  const estimate=Math.max(0,Math.round(Number(remainingOtherCost)||0)-registeredOther);
  const estimateDays=days.filter(d=>d.working&&d.date<=(finish||end));
  if(estimate&&!estimateDays.length)throw new Error('Hay costos pendientes por proyectar, pero no hay jornadas laborables en el horizonte. Revisa el calendario; no se considera costo cero.');
  if(estimate&&estimateDays.length){
    const share=Math.floor(estimate/estimateDays.length),remainder=estimate-share*estimateDays.length;
    estimateDays.forEach((day,i)=>{const charge=append(day,{nombre:'Personal y otros costos pendientes (estimación)',monto:share+(i<remainder?1:0)},'Estimación por avance y costo histórico no asociado a maquinaria; no es nómina confirmada');charge.resourceId='base-estimate';});
    baselineTotals.set('estimate',{id:'base-estimate',name:'Personal y otros costos pendientes (estimación)',total:estimate});
  }
  const resourceTotals=[...resourceStates.map(r=>({...r,total:Math.round(r.total)})),...baselineTotals.values()];
  const futureCost=resourceTotals.reduce((s,r)=>s+r.total,0);
  const history=new Map();
  for(const row of historicalCosts){
    const date=simulationDate(row.fecha_costo||row.fecha||row.created_at);
    if(!validSimulationDate(date)||date>cutoff)continue;
    const day=history.get(date)||{date,working:isWorkday(date),production:{},cost:0,charges:[],historical:true};
    append(day,row,`${costStateLabel[costState(row,cutoff)]} · ${row.fuente||row.origen_costo||row.categoria_proyeccion||'Registro de obra'}`);history.set(date,day);
  }
  if(history.size){
    const first=[...history.keys()].sort()[0];
    // Historical detail is display-only: actualCost is still counted exactly once.
    const historyDays=simulationDates(first,cutoff).map(date=>history.get(date)||{date,working:isWorkday(date),production:{},cost:0,charges:[],historical:true});
    days.unshift(...historyDays);
  }
  const monthMap=new Map();for(const day of days)monthMap.set(day.date.slice(0,7),(monthMap.get(day.date.slice(0,7))||0)+day.cost);
  const months=[...monthMap].map(([month,cost])=>({month,cost:Math.round(cost)}));
  const futureMonths=months.map(m=>({...m,cost:days.filter(d=>!d.historical&&d.date.startsWith(m.month)).reduce((sum,d)=>sum+d.cost,0)}));
  const knownCost=!costError&&actualCost!=null&&Number.isFinite(Number(actualCost))&&Number(actualCost)>=0;
  const warnings=[];
  if(!resources.length&&!baselineTotals.size)warnings.push('No hay costos futuros cargados para este período: el costo simulado no representa el costo completo de terminar la obra.');
  if(estimate)warnings.push('Personal y otros costos pendientes incluyen una estimación por avance, descontando los importes futuros ya registrados. No es una liquidación ni un gasto confirmado.');
  if(states.some(p=>p.initialRemaining>0&&p.pace===0))warnings.push('Hay partidas pendientes sin rendimiento base. Solo avanzarán si defines producción manual en el calendario.');
  if(states.some(p=>p.initialRemaining>0&&!p.predecessors?.length)&&states.length>1)warnings.push('Las partidas sin predecesoras pueden avanzar en paralelo. Verifica que no compartan una misma cuadrilla o equipo limitado.');
  if(resourceStates.some(r=>r.rate===0||r.quantity===0))warnings.push('Hay recursos con tarifa o cantidad cero. Revisa que no falten costos.');
  if(start>addSimulationDays(cutoff,1))warnings.push('Existe un intervalo entre el corte y el inicio seleccionado: no se ha supuesto producción ni costo en esos días.');
  if(!finish)warnings.push('Queda producción pendiente al final del horizonte; el costo calculado cubre solo el período simulado, no el término.');
  if(resourceStates.some(r=>r.mode==='fixed'&&(r.start<start||r.start>end)))warnings.push('Hay costos únicos con fecha fuera del período seleccionado. Esos importes no se han sumado al escenario.');
  if(finish&&resourceStates.some(r=>r.untilFinish===false&&(!r.end||r.end>finish)))warnings.push('Hay cobros configurados para continuar después del término. El total del escenario incluye esos cargos posteriores, hasta su fecha final o el horizonte.');
  const years=[...new Set(dates.map(d=>d.slice(0,4)))].filter(y=>!holidays.some(h=>h.startsWith(y)));
  if(years.length)warnings.push(`Calendario manual: revisa los feriados de ${years.join(', ')}. Solo se excluyen los feriados cargados y las excepciones que indiques.`);
  return {finish,complete:Boolean(finish),futureCost,totalAtFinish:finish&&knownCost?Math.round(Number(actualCost))+futureCost:null,actualCost:knownCost?Math.round(Number(actualCost)):null,
    resources:resourceTotals.sort((a,b)=>b.total-a.total),days,months:futureMonths,calendarMonths:months,warnings,delayDays:finish&&deadline?Math.round((Date.parse(finish)-Date.parse(deadline))/DAY):null,
    parts:states.map(p=>{
      const predecessors=(p.predecessors||[]).map(id=>byId.get(id));
      const available=dates.filter(d=>isWorkday(d)&&d>=p.start&&predecessors.every(prev=>prev.finish&&prev.finish<d)&&(!deadline||d<=deadline)).length;
      return {...p,requiredPace:deadline&&available>0?p.initialRemaining/available:null,availableDays:available};
    })};
}

export function equipmentSimulationTemplate(item,index=0){
  const raw=item.costo_interno??item.tarifa_diaria??item.costo;
  const unit=String(item.unidad_costo_interno||item.unidad_tarifa||item.unidad_costo||'$/día').toLowerCase();
  return {sourceId:`equipment-${JSON.stringify([item.empresa||'',item.simulationSource||'equipo',item.id??item.patente??index])}`,name:`${item.tipo||item.equipo||item.nombre||'Equipo'}${item.patente?` · ${item.patente}`:''}`,rate:raw==null?'':raw,mode:unit.includes('mes')?'month30':unit.includes('hora')||unit.includes('/h')?'hour':'workday',quantity:unit.includes('hora')||unit.includes('/h')?'':1,source:`Equipo · tarifa original ${unit}`,untilFinish:true};
}
