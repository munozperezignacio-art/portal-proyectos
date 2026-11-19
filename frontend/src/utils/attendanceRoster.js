const rutKey=value=>String(value||'').replace(/[^0-9k]/gi,'').toUpperCase();
export function attendanceRoster(workers,links,work,date,editing=null){
 if(!work?.empresa||!date)return [];
 // An existing attendance record keeps its original identity, independently of today's roster.
 if(editing)return [{id:`attendance-${editing.id}`,empresa:work.empresa,nombre:editing.trabajador,rut:editing.rut||'',cargo:'Marcaje existente'}];
 const seen=new Set();
 return workers.filter(worker=>{
  if(worker.empresa!==work.empresa)return false;
  const linked=links.some(link=>String(link.trabajador_id)===String(worker.id)&&link.empresa===work.empresa&&work.centro_gestion_id!=null&&String(link.centro_gestion_id)===String(work.centro_gestion_id)&&link.fecha_inicio<=date&&(!link.fecha_termino||date<=link.fecha_termino));
  const primary=(worker.obra_nombre===work.nombre||(work.centro_gestion_id!=null&&worker.centro_gestion_id!=null&&String(worker.centro_gestion_id)===String(work.centro_gestion_id)))&&(!worker.fecha_asig||worker.fecha_asig.slice(0,10)<=date)&&(!worker.fecha_inicio_contrato||worker.fecha_inicio_contrato<=date)&&(!worker.fecha_vencimiento_contrato||date<=worker.fecha_vencimiento_contrato);
  if(!linked&&!primary)return false;
  const key=rutKey(worker.rut)||String(worker.id);if(seen.has(key))return false;seen.add(key);return true;
 }).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
}
export function validateAttendancePerson(roster,data,editing){
 const person=roster.find(p=>p.nombre===data.trabajador&&rutKey(p.rut)===rutKey(data.rut));
 if(!person)throw Error('El trabajador no está asignado a esta obra en la fecha elegida. Revisa la fecha y la selección.');
 if(editing&&(data.trabajador!==editing.trabajador||rutKey(data.rut)!==rutKey(editing.rut)))throw Error('No se puede cambiar la identidad de un marcaje existente.');
}
