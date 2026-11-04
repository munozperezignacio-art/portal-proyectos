export const costDate=c=>String(c.fecha_costo||c.fecha||c.created_at||'').slice(0,10);
export const costState=(c,cutoff)=>costDate(c)>cutoff?'proyectado':['pendiente','proyectado'].includes(c.estado_costo)?'pendiente':'confirmado';
export const costStateLabel={confirmado:'Confirmado',pendiente:'Incurrido · pendiente de confirmar',proyectado:'Futuro proyectado'};
export function applyMachineryAllocations(rows, decisions) {
 const index=new Map(decisions.map(d=>[`${d.equipo_id}:${d.fecha}`,d]));
 return rows.map(row=>{
  const d=index.get(`${row.equipo_id}:${row.fecha}`);
  let accumulated=0,assigned=0;
  const links=(d?.distribucion||[]).map((p,i,list)=>{
   accumulated+=Number(p.porcentaje)/100;
   const end=i===list.length-1?Number(row.monto):Math.round(Number(row.monto)*accumulated*100)/100;
   const amount=end-assigned;assigned=end;
   return {...p,factor:Number(p.porcentaje)/100,monto_imputado:amount,criterio:'Imputación de maquinaria aprobada'};
  });
  return {...row,imputaciones:d?.distribucion||[],obra_liquidaciones_partidas:links,version_imputacion:d?.version||0,historial_imputacion:d?.historial||[]};
 });
}
// Cost confirmation and assignment to budget items are independent states.
export function pendingMachineryAllocations(rows, cutoff) {
 return rows.filter(r=>r.fecha<=cutoff).map(r=>{
  const amount=r.monto==null?null:Number(r.monto);
  const percent=(r.imputaciones||[]).reduce((sum,p)=>sum+(Number(p.porcentaje)||0),0);
  return {...r,monto_sin_imputar:amount==null?null:Math.max(0,amount*(1-Math.min(100,percent)/100))};
 }).filter(r=>r.monto_sin_imputar==null||r.monto_sin_imputar>0.01);
}
export const outsideChargePeriod=(date,period={})=>Boolean((period?.desde&&date<period.desde)||(period?.hasta&&date>period.hasta));
export function machineryCostControl({periods=[],reports=[],decisions=[],holidays=[],end,cutoff,obraId,obraName,chargePeriod={}}) {
 const result=new Map(),holidaySet=new Set(holidays);
 const key=(id,date)=>`${id}:${date}`;
 const working=date=>![0,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())&&!holidaySet.has(date);
 const retirements=decisions.filter(d=>d.tipo==='retiro');
 for(const p of [...periods].sort((a,b)=>a.desde.localeCompare(b.desde)||a.id-b.id)) {
   const retiro=retirements.filter(d=>{const origin=periods.find(old=>String(old.id)===String(d.periodo_id));return String(origin?.asignacion_id||origin?.id)===String(p.asignacion_id||p.id);}).map(d=>d.fecha).sort()[0];
   const stop=[p.hasta,retiro].filter(Boolean).sort()[0];
   for(let time=Date.parse(`${p.desde}T12:00:00Z`),last=Date.parse(`${end}T12:00:00Z`);time<=last;time+=86400000) {
     const date=new Date(time).toISOString().slice(0,10);
     if(stop&&date>=stop)break;
     if(outsideChargePeriod(date,chargePeriod)&&!decisions.some(d=>String(d.equipo_id)===String(p.equipo_id)&&d.fecha===date&&d.tipo==='confirmar'))continue;
     if(!working(date))continue;
     result.set(key(p.equipo_id,date),{...p,periodo_id:p.id,equipo_id:String(p.equipo_id),fecha:date,monto:p.tarifa,estado_costo:'pendiente',origen_costo:'Asignación vigente',reporte_id:key(p.equipo_id,date)});
   }
 }
 // Resolve company-wide reports before filtering a work: a report in another
 // work replaces that day's default assignment charge, never adds to it.
 for(const r of [...reports].sort((a,b)=>String(a.cargo_decidido_at||a.created_at||'').localeCompare(String(b.cargo_decidido_at||b.created_at||''))||Number(a.id||0)-Number(b.id||0)))if(r.fecha<=end){
   const p=periods.find(p=>String(p.equipo_id)===String(r.equipo_id)&&p.desde<=r.fecha&&(!p.hasta||r.fecha<p.hasta));
   result.set(key(r.equipo_id,r.fecha),{...r,obra_id:r.cargo_obra_id||null,obra_nombre:r.obra_cargo_diario||r.obra_nombre,monto:r.tarifa_diaria_aplicada??r.monto??p?.tarifa??null,estado_costo:'pendiente',origen_costo:'Reporte de uso'});
 }
 for(const d of decisions){
   const k=key(d.equipo_id,d.fecha),row=result.get(k);
   if(d.tipo==='no_uso'&&row&&(String(row.obra_id)===String(d.obra_id)||(!row.obra_id&&row.obra_nombre===obraName&&String(d.obra_id)===String(obraId))))result.delete(k);
   if(d.tipo==='confirmar'&&row&&(String(row.obra_id)===String(d.obra_id)||(!row.obra_id&&row.obra_nombre===obraName&&String(d.obra_id)===String(obraId))))result.set(k,{...row,monto:d.monto,estado_costo:'confirmado',confirmado_at:d.actualizado_at});
 }
 return [...result.values()].filter(r=>r.obra_id?String(r.obra_id)===String(obraId):r.obra_nombre===obraName).map(r=>({...r,estado_costo:costState(r,cutoff)})).sort((a,b)=>b.fecha.localeCompare(a.fecha)||String(a.equipo_id).localeCompare(String(b.equipo_id)));
}
export function costTotals(rows,cutoff){const totals={confirmado:0,pendiente:0,proyectado:0};for(const r of rows)totals[costState(r,cutoff)]+=Number(r.monto??r.monto_real)||0;return {...totals,incurrido:totals.confirmado+totals.pendiente};}
