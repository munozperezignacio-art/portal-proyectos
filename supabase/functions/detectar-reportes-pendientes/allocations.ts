import {responsibleRecipients} from './recipients.js';
import {machineryCostControl,outsideChargePeriod} from './costControl.js';
const holidays=[
      '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-07', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25',
      '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21', '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18', '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-12-08', '2025-12-25',
      '2024-01-01', '2024-03-29', '2024-03-30', '2024-05-01', '2024-05-21', '2024-06-20', '2024-06-29', '2024-07-16', '2024-08-15', '2024-09-18', '2024-09-19', '2024-09-20', '2024-10-12', '2024-10-31', '2024-11-01', '2024-12-08', '2024-12-25'
    ];
export const types:Record<string,string>={gastos_imputacion_pendiente:'gastos',rrhh_imputacion_pendiente:'RRHH',maquinaria_imputacion_pendiente:'maquinaria'};
async function pages(factory:()=>any){
 const out:any[]=[];for(let offset=0;;offset+=1000){const {data,error}=await factory().range(offset,offset+999);if(error)throw error;out.push(...data);if(data.length<1000)return out;}
}
export async function allocationNotices(db:any,rule:any,date:string){
 if(!rule.canal_plataforma)return {sent:0};
 const table=(name:string,fields:string)=>db.from(name).select(fields).eq('empresa',rule.empresa);
 const [works,users]=await Promise.all([pages(()=>table('obras','id,nombre').order('id')),pages(()=>table('usuarios','id,rol,obras').order('id'))]);
 let equipment:any=null,sent=0;
 for(const work of works){
  const targets=responsibleRecipients(rule,users,work.nombre).users.filter((u:any)=>(Array.isArray(u.obras)?u.obras:String(u.obras||'').split(',')).some((x:string)=>['todas',work.nombre.trim().toLowerCase()].includes(String(x).trim().toLowerCase())));
  if(!targets.length)continue;
  const code=rule.evento_codigo;
  const key=(u:any)=>JSON.stringify([rule.empresa,work.id,code,date,String(u.id)]);
  const {data:prior,error:pr}=await table('notificaciones_entregas','destinatario').eq('evento_codigo',code).eq('obra_nombre',work.nombre).contains('payload',{fecha_control:date,obra_id:work.id});if(pr)throw pr;
  const missing=targets.filter((u:any)=>!prior.some((p:any)=>p.destinatario===String(u.id)));if(!missing.length)continue;
  let count=0;
  if(code==='gastos_imputacion_pendiente'){
   const costs=await pages(()=>table('costos_reales_obra','id,fecha_costo,created_at,imputaciones,monto').eq('obra_nombre',work.nombre).gt('monto',0).order('id'));
   count=costs.filter(c=>String(c.fecha_costo||c.created_at).slice(0,10)<=date&&(c.imputaciones||[]).reduce((s:number,p:any)=>s+Number(p.porcentaje||0),0)<99.995).length;
  }else{
   const {data:period,error}=await table('obra_periodo_cargos','desde,hasta').eq('obra_id',work.id).maybeSingle();if(error)throw error;
   if(code==='rrhh_imputacion_pendiente'){
    const rows=await pages(()=>table('rrhh_costos_personal_vigentes','id,fecha,version_imputacion,obra_liquidaciones_partidas').eq('obra_id',work.id).lte('fecha',date).order('fecha').order('id'));
    count=rows.filter(r=>!outsideChargePeriod(r.fecha,period)&&!Number(r.version_imputacion)&&!r.obra_liquidaciones_partidas?.length).length;
   }else{
    equipment??=await Promise.all([pages(()=>table('maquinaria_periodos_costo','*').lte('desde',date).order('id')),pages(()=>table('maquinaria_uso_diario','id,equipo_id,fecha,obra_nombre,obra_cargo_diario,cargo_obra_id,tarifa_diaria_aplicada,cargo_decidido_at,created_at').lte('fecha',date).order('id')),pages(()=>table('maquinaria_decisiones_costo','*').lte('fecha',date).order('fecha').order('equipo_id'))]);
    const decisions=await pages(()=>table('maquinaria_partidas_decisiones','equipo_id,fecha,version').eq('obra_id',work.id).lte('fecha',date).order('fecha').order('equipo_id'));
    const handled=new Set(decisions.filter(d=>d.version>0).map(d=>d.equipo_id+':'+d.fecha));
    count=(machineryCostControl as any)({periods:equipment[0],reports:equipment[1],decisions:equipment[2],holidays,end:date,cutoff:date,obraId:work.id,obraName:work.nombre,chargePeriod:period||{}}).filter((r:any)=>!r.pendiente_obra&&!outsideChargePeriod(r.fecha,period)&&!handled.has(r.equipo_id+':'+r.fecha)).length;
   }
  }
  if(!count)continue;
  const detalle=count+' cargos pendientes de imputar en '+work.nombre+' ('+types[code]+').';
  const rows=missing.map((u:any)=>({allocation_notice_key:key(u),empresa:rule.empresa,obra_nombre:work.nombre,evento_codigo:code,canal:'Plataforma',destinatario:String(u.id),asunto:detalle,estado:'Enviada',enviada_at:new Date().toISOString(),payload:{detalle,obra_id:work.id,fecha_control:date,operational_event:true,prioridad:'media',cantidad:count}}));
  const {error}=await db.from('notificaciones_entregas').upsert(rows,{onConflict:'allocation_notice_key',ignoreDuplicates:true});if(error)throw error;sent+=rows.length;
 }
 return {rule:rule.id,sent};
}
