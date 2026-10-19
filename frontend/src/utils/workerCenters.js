import {assignmentToday} from './workerAssignment.js';
export function activeWorkerCenter(link,date=assignmentToday()){
  return link.centro_activo!==false&&link.fecha_inicio<=date&&(!link.fecha_termino||link.fecha_termino>=date);
}
export function workerAdditionalCenters(worker,links,date=assignmentToday()){
  const ids=new Set();
  return links.filter(link=>{
    if(String(link.trabajador_id)!==String(worker.id)||link.empresa!==worker.empresa||!activeWorkerCenter(link,date)||String(link.centro_gestion_id)===String(worker.centro_gestion_id)||ids.has(String(link.centro_gestion_id)))return false;
    ids.add(String(link.centro_gestion_id));return true;
  });
}
export function workerAssignedToWork(worker,work,links,date=assignmentToday()){
  if(worker.empresa!==work.empresa)return false;
  if(worker.obra_nombre===work.nombre)return true;
  if(worker.fecha_inicio_contrato&&worker.fecha_inicio_contrato>date||worker.fecha_vencimiento_contrato&&worker.fecha_vencimiento_contrato<date)return false;
  return work.centro_gestion_id!=null&&workerAdditionalCenters(worker,links,date).some(link=>String(link.centro_gestion_id)===String(work.centro_gestion_id));
}
