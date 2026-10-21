import { normalizedAttendanceRut } from './attendanceBatch';
type Row=Record<string,any>;
export type PersonnelSources={workers:Row[];links:Row[];assignments:Row[]};
const same=(a:unknown,b:unknown)=>a!=null&&b!=null&&String(a)===String(b);
const name=(v:unknown)=>String(v||'').trim().toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
const active=(row:Row,date:string)=>row.fecha_inicio<=date&&(!row.fecha_termino||row.fecha_termino>=date);
export function assignedWorkPersonnel(sources:PersonnelSources,work:Row,date:string) {
  const seen=new Set<string>();
  return sources.workers.filter(worker=>{
    if(worker.empresa!==work.empresa)return false;
    if(worker.fecha_inicio_contrato&&worker.fecha_inicio_contrato>date||worker.fecha_vencimiento_contrato&&worker.fecha_vencimiento_contrato<date)return false;
    const periods=sources.assignments.filter(a=>a.empresa===work.empresa&&same(a.trabajador_id,worker.id)&&active(a,date));
    const historical=periods.some(a=>name(a.obra_nombre)===name(work.nombre));
    const primary=!periods.length&&name(worker.obra_nombre)===name(work.nombre)&&(!worker.fecha_asig||worker.fecha_asig<=date);
    const additional=work.centro_gestion_id!=null&&sources.links.some(link=>link.empresa===work.empresa&&same(link.trabajador_id,worker.id)&&same(link.centro_gestion_id,work.centro_gestion_id)&&link.centro_activo!==false&&active(link,date));
    if(!historical&&!primary&&!additional)return false;
    const key=normalizedAttendanceRut(worker.rut)||String(worker.id);
    if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
}
export async function loadPersonnelSources(client:{from:(table:string)=>any},company:string):Promise<PersonnelSources> {
  const read=async(table:string,columns:string)=>{
    const rows:Row[]=[];
    for(let offset=0;;offset+=1000){
      const result=await client.from(table).select(columns).eq('empresa',company).order('id').range(offset,offset+999);
      if(result.error)throw new Error(`No se pudo cargar el personal asignado: ${result.error.message}`);
      rows.push(...(result.data||[]));if((result.data||[]).length<1000)return rows;
    }
  };
  const [workers,links,assignments]=await Promise.all([
    read('maestro_personal','id,nombre,rut,cargo,empresa,obra_nombre,centro_gestion_id,fecha_asig,fecha_inicio_contrato,fecha_vencimiento_contrato'),
    read('rrhh_personal_centros_detalle','id,empresa,trabajador_id,centro_gestion_id,fecha_inicio,fecha_termino,centro_activo'),
    read('rrhh_asignaciones_personal','id,empresa,trabajador_id,obra_nombre,fecha_inicio,fecha_termino'),
  ]);
  return {workers,links,assignments};
}
