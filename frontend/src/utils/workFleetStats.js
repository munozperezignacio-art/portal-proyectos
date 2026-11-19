const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const sum = (rows, key) => rows.reduce((total, row) => total + Math.max(0, number(row[key]) ?? 0), 0);
export const reportHours = row => number(row.horas_trabajadas) !== null ? Math.max(0, number(row.horas_trabajadas)) : number(row.horometro_final) !== null && number(row.horometro_inicial) !== null ? Math.max(0, number(row.horometro_final)-number(row.horometro_inicial)) : null;
export const checkDate = row => row.identity?.fecha || row.respuestas?._qr_identidad?.fecha || String(row.created_at||'').slice(0,10);
export const checkEquipment = row => String(row.identity?.equipo_id || row.respuestas?._qr_identidad?.equipo_id||'');
const same = (a,b) => String(a)===String(b);
export function fleetStats({equipment=[],usage=[],failures=[],maintenance=[],checks=[],periods=[],charges=[],from,to,equipmentId='',holidays=[]}) {
 const within = date => date && date>=from && date<=to;
 const rows=equipment.filter(e=>!equipmentId||same(e.id,equipmentId)).map(e=>{
  const reports=usage.filter(r=>same(r.equipo_id,e.id)&&within(r.fecha)).sort((a,b)=>a.fecha.localeCompare(b.fecha)||Number(a.id)-Number(b.id));
  const stops=failures.filter(r=>same(r.equipo_id,e.id)&&within(r.fecha));
  const services=maintenance.filter(r=>same(r.equipo_id,e.id)&&within(r.fecha));
  const checklist=checks.filter(r=>checkEquipment(r)===String(e.id)&&within(checkDate(r)));
  const costs=charges.filter(r=>same(r.equipo_id,e.id)&&within(r.fecha));
  const days=new Set(reports.map(r=>r.fecha));
  const checkDays=new Set(checklist.map(checkDate));
  const expected=new Set();
  for(const p of periods.filter(p=>same(p.equipo_id,e.id))) {
   const start=p.desde>from?p.desde:from;
   for(let d=new Date(start+'T12:00:00Z');Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)<=to;d.setUTCDate(d.getUTCDate()+1)) {
    const date=d.toISOString().slice(0,10);if(p.hasta&&date>=p.hasta)break;
    if(![0,6].includes(d.getUTCDay())&&!holidays.includes(date))expected.add(date);
   }
  }
  const hours=reports.reduce((s,r)=>s+(reportHours(r)??0),0);
  const fuelRows=reports.filter(r=>number(r.combustible_cargado)!==null);
  const fuel=sum(fuelRows,'combustible_cargado');
  const paired=fuelRows.filter(r=>reportHours(r)>0);
  const pairedHours=paired.reduce((s,r)=>s+reportHours(r),0);
  return {equipment:e,reports,stops,services,checklist,costs,hours,days:days.size,fuel,fuelCount:fuelRows.length,fuelRate:pairedHours?sum(paired,'combustible_cargado')/pairedHours:null,
   missing:expected.size?[...expected].filter(d=>!days.has(d)):null,expected:expected.size,
   unchecked:[...days].filter(d=>!checkDays.has(d)),downtime:sum(stops,'horas_fuera_servicio'),
   initial:number(reports[0]?.horometro_inicial),final:number(reports.at(-1)?.horometro_final),
   cost:costs.reduce((s,r)=>s+(number(r.monto)??0),0),maintenanceCost:services.reduce((s,r)=>s+(number(r.costo)??0),0),incompleteCost:costs.some(r=>number(r.monto)===null||r.pendiente_obra)||services.some(r=>number(r.costo)===null),
   unknownHours:reports.filter(r=>reportHours(r)===null).length};
 });
 const daily=new Map();for(const row of rows)for(const report of row.reports){const d=daily.get(report.fecha)||{date:report.fecha,hours:0,reports:0};d.hours+=reportHours(report)??0;d.reports++;daily.set(report.fecha,d);}
 const plans=rows.flatMap(({equipment:e})=>(Array.isArray(e.planes_mantencion)?e.planes_mantencion:[]).map(plan=>{
  const interval=number(plan.intervalo);let due=null,remaining=null;
  // Current inventory plans do not have historical versions: label these as current, not historical.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
  if(interval>0&&plan.unidad==='dias'&&plan.ultima_fecha){const d=new Date(plan.ultima_fecha+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+interval);if(Number.isFinite(d.getTime())){due=d.toISOString().slice(0,10);remaining=Math.ceil((d-new Date(today+'T12:00:00Z'))/86400000);}}
  else if(interval>0&&plan.unidad==='horas'&&number(plan.ultima_lectura)!==null&&number(e.horometro_inicial)!==null){due=number(plan.ultima_lectura)+interval;remaining=due-number(e.horometro_inicial);}
  return {equipment:e,plan,due,remaining,status:remaining===null?'Sin base suficiente':remaining<=0?'Vencida':remaining<=(plan.unidad==='dias'?15:interval*.15)?'Próxima':'Programada'};
 }));
 return {rows,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),plans};
}

export async function readFleetStats(db,{company,work,canCosts,canChecks}) {
 const all=async query=>{const rows=[];for(let offset=0;;offset+=500){const {data,error}=await query().order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}};
 const scoped=(table,columns)=>()=>db.from(table).select(columns).eq('empresa',company).eq('obra_nombre',work.nombre);
 const [inventory,usage,failures,maintenance,periods,checks]=await Promise.all([
  all(()=>db.from('inventario_maquinaria').select('id,tipo,patente,obra_nombre,tipo_activo,horometro_inicial,planes_mantencion').eq('empresa',company)),
  all(scoped('maquinaria_uso_diario','id,equipo_id,fecha,horometro_inicial,horometro_final,horas_trabajadas,combustible_cargado,observaciones')),
  all(scoped('maquinaria_fallas','id,equipo_id,fecha,descripcion,horas_fuera_servicio,severidad')),
  all(scoped('maquinaria_mantenciones',`id,equipo_id,fecha,tipo,descripcion,horometro${canCosts?',costo':''}`)),
  all(()=>db.from('maquinaria_periodos_costo').select('id,equipo_id,desde,hasta').eq('empresa',company).eq('obra_id',work.id)),
  canChecks?all(()=>db.from('prevencion_respuestas').select('id,created_at,identity:respuestas->_qr_identidad,prevencion_formularios!inner(empresa)').eq('prevencion_formularios.empresa',company).eq('proyecto_nombre',work.nombre)):[],
 ]);
 const ids=new Set([...usage,...failures,...maintenance,...periods].map(r=>String(r.equipo_id)));checks.forEach(r=>{if(checkEquipment(r))ids.add(checkEquipment(r));});
 return {equipment:inventory.filter(e=>e.obra_nombre===work.nombre||ids.has(String(e.id))),usage,failures,maintenance,periods,checks};
}
