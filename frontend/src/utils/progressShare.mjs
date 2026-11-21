export function productionDate(r){
 const explicit=r.fecha||r.fecha_avance;if(explicit)return String(explicit).slice(0,10);
 const t=new Date(r.created_at);return Number.isFinite(t.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(t):'';
}
export function progressShareMessage(workName,date,activities,entries,notes){
 const groups=entries.map(e=>({...e,day:e.history.filter(r=>productionDate(r)===date)})).filter(e=>e.day.length);
 const fmt=n=>n.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2}),label=date.split('-').reverse().join('-');
 const body=groups.map(({part,history,day})=>{
  const raw=part.cantidad??part.cantidad_presupuestada,total=raw==null||raw===''?NaN:Number(raw),unit=part.unidad||'unidades',sum=rows=>rows.reduce((n,r)=>n+Number(r.cantidad||0),0);
  const done=sum(history.filter(r=>productionDate(r)&&productionDate(r)<=date)),now=sum(day),pct=v=>total>0?fmt(100*v/total)+' %':'Sin base presupuestada';
  return '*'+part.partida+'*\n- Avance del día: '+pct(now)+'\n- Avance acumulado: '+pct(done)+'\n- Total unidades ejecutadas día: '+fmt(now)+' '+unit+'\n- Pendiente de instalación: '+(Number.isFinite(total)?fmt(Math.max(0,total-done))+' '+unit:'Sin presupuesto')+'\n- Total partida: '+(Number.isFinite(total)?fmt(total)+' '+unit:'Sin presupuesto');
 }).join('\n\n');
 const original=[...new Set(groups.flatMap(g=>g.day.map(r=>String(r.observaciones||r.observacion||r.comentario||'').trim())).filter(Boolean))].join('\n');
 return 'Buenos días, comparto reporte de avance del día *'+label+'* correspondiente a la obra *'+workName+'*\n\nActividades del día:\n'+activities.trim()+'\n\n*Registro de avance*\nPartidas ejecutadas:\n'+body+'\n\nObservaciones\n'+((notes??original).trim()||'Sin observaciones.')+'\n\nQue tengas un buen día,';
}
