const rut=value=>String(value||'').replace(/[^0-9k]/gi,'').toUpperCase();
export function earningsRoster({workers,links,attendance,work,from,to}){
 const present=new Set(attendance.filter(a=>a.fecha_marcacion>=from&&a.fecha_marcacion<=to&&a.empresa===work.empresa&&String(a.obra_id)===String(work.id)).map(a=>rut(a.rut)).filter(Boolean));
 return workers.filter(w=>w.empresa===work.empresa&&(present.has(rut(w.rut))||links.some(l=>l.empresa===work.empresa&&String(l.trabajador_id)===String(w.id)&&work.centro_gestion_id!=null&&String(l.centro_gestion_id)===String(work.centro_gestion_id)&&l.fecha_inicio<=to&&(!l.fecha_termino||l.fecha_termino>=from))||((w.obra_nombre===work.nombre||(work.centro_gestion_id!=null&&w.centro_gestion_id!=null&&String(w.centro_gestion_id)===String(work.centro_gestion_id)))&&(!w.fecha_asig||w.fecha_asig.slice(0,10)<=to)&&(!w.fecha_inicio_contrato||w.fecha_inicio_contrato<=to)&&(!w.fecha_vencimiento_contrato||w.fecha_vencimiento_contrato>=from)))).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
}
export async function loadEarningsRoster(db,work,from,to){
 const all=async make=>{const rows=[];for(let i=0;;i+=500){const {data,error}=await make().order('id').range(i,i+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}};
 const [workers,links,attendance]=await Promise.all([
  all(()=>db.from('maestro_personal').select('id,empresa,nombre,rut,obra_nombre,centro_gestion_id,fecha_asig,fecha_inicio_contrato,fecha_vencimiento_contrato').eq('empresa',work.empresa)),
  all(()=>db.from('rrhh_personal_centros_detalle').select('id,empresa,trabajador_id,centro_gestion_id,fecha_inicio,fecha_termino').eq('empresa',work.empresa)),
  all(()=>db.from('asistencia_personal').select('id,empresa,obra_id,rut,fecha_marcacion').eq('empresa',work.empresa).eq('obra_id',work.id).gte('fecha_marcacion',from).lte('fecha_marcacion',to)),
 ]);return earningsRoster({workers,links,attendance,work,from,to});
}
export async function insertWorkEarnings(db,rows){
 // Always INSERT: the database constraint also protects against concurrent submissions.
 const {error}=await db.from('rrhh_haberes_obra').insert(rows);
 if(error?.code==='23505'||error?.message?.includes('rrhh_haberes_obra_pkey'))throw Error(rows.length===1?'Este haber ya está registrado para este trabajador, fecha o período, concepto y tipo. No se duplicó ni se modificó el monto existente.':'Al menos uno de los haberes seleccionados ya está registrado para la misma fecha o período, concepto y tipo. No se guardó ningún haber de este envío ni se modificaron los existentes. Revisa la selección.');
 if(error)throw error;
}
