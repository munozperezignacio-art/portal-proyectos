const id=value=>/^\d+$/.test(String(value||''))&&Number.isSafeInteger(Number(value))&&Number(value)>0?String(value):null;
const specs={
 obra_reporte_maquinaria:{table:'maquinaria_uso_diario',permission:'maquinaria.uso.ver',fields:'id,empresa,obra_nombre,equipo_id,equipo_patente,equipo_tipo,fecha,horometro_inicial,horometro_final,horas_trabajadas,combustible_cargado,operador,observaciones'},
 mantenimiento_registrado:{table:'maquinaria_mantenciones',permission:'maquinaria.mantenimiento.ver',fields:'id,empresa,obra_nombre,equipo_id,equipo_patente,equipo_tipo,fecha,tipo,horometro,descripcion,proveedor,responsable'},
 maquinaria_falla_reportada:{table:'maquinaria_fallas',permission:'maquinaria.fallas.ver',fields:'id,empresa,obra_nombre,equipo_id,equipo_patente,equipo_tipo,fecha,severidad,detuvo_equipo,horas_fuera_servicio,descripcion,causa,solucion'},
 obra_reporte_avance:{table:'avances_produccion_partidas',permission:'obras.avances.ver',fields:'id,empresa,obra_id,obra_nombre,created_at,supervisor,frente,partida,unidad,cantidad,observaciones'},
 material_registrado:{table:'inventario_materiales',permission:'bodega.inventario.ver',fields:'id,empresa,obra_nombre,created_at,guia,tipo_movimiento,material,cantidad,unidad'},
 prevencion_registro_recibido:{table:'prevencion_respuestas',permission:'formularios.formularios.ver',fields:'id,obra_id,proyecto_nombre,created_at,inspector,respuestas,prevencion_formularios!inner(id,empresa,titulo,campos)'},
};
export function notificationReference(delivery){
 const p=delivery.payload||{},code=({avance_registrado:'obra_reporte_avance',maquinaria_registrada:'obra_reporte_maquinaria'})[delivery.evento_codigo]||delivery.evento_codigo,spec=specs[code];
 if(!spec)return null;
 const prefix=code==='prevencion_registro_recibido'?'form':spec.table;
 const legacy=String(p.event_id||'').match(new RegExp('^'+prefix+':(\\d+)$'))?.[1];
 const candidates=code==='obra_reporte_avance'?p.reporte_ids:[p.respuesta_id||p.registro_id||p.reporte_id||legacy];
 const ids=[...new Set((Array.isArray(candidates)?candidates:[]).map(id).filter(Boolean))].slice(0,100);
 return ids.length?{...spec,ids}:null;
}
// Only authoritative company-scoped names are used in push copy; never free-text report content.
export async function enrichNotification(db,delivery,company,cache=new Map()){
 const p={...delivery.payload},context={},reference=notificationReference(delivery);
 const one=async(table,fields,key,value)=>{if(!value)return null;const cacheKey=JSON.stringify([company,table,fields,key,value]);if(!cache.has(cacheKey))cache.set(cacheKey,(async()=>{const q=await db.from(table).select(fields).eq('empresa',company).eq(key,value).maybeSingle();if(q.error)throw q.error;return q.data;})());return cache.get(cacheKey);};
 if(reference&&reference.table!=='prevencion_respuestas'){
  const row=await one(reference.table,'id,obra_nombre'+(reference.table.startsWith('maquinaria_')?',equipo_id':''),'id',reference.ids[0]);
  if(row){if(row.obra_nombre)delivery={...delivery,obra_nombre:row.obra_nombre};if(row.equipo_id)p.equipo_id=row.equipo_id;}
 }
 if(reference?.table==='prevencion_respuestas'){
  const {data,error}=await db.from('prevencion_respuestas').select('id,obra_id,prevencion_formularios!inner(id,empresa,titulo)').eq('id',reference.ids[0]).eq('prevencion_formularios.empresa',company).maybeSingle();if(error)throw error;
  if(data){p.formulario_id=data.prevencion_formularios.id;p.obra_id=data.obra_id;context.formulario=data.prevencion_formularios.titulo;}
 }
 const work=await one('obras','id,nombre',id(p.obra_id)?'id':'nombre',id(p.obra_id)||delivery.obra_nombre);
 if(work){p.obra_id=work.id;context.obra=work.nombre;}
 const equipment=await one('inventario_maquinaria','id,tipo,patente','id',id(p.equipo_id));
 if(equipment)context.equipo=[equipment.tipo,equipment.patente].filter(Boolean).join(' · ');
 if(!context.formulario){const form=await one('prevencion_formularios','id,titulo','id',id(p.formulario_id));if(form)context.formulario=form.titulo;}
 return {...delivery,payload:{...p,notification_context:context,has_record:!!reference}};
}
export async function readNotificationRecord(db,delivery,profile,mayRead){
 const ref=notificationReference(delivery);if(!ref)return null;
 if(!mayRead(ref.permission))throw Error('No tienes permiso para consultar este registro.');
 let query=db.from(ref.table).select(ref.fields).in('id',ref.ids);
 query=query.eq(ref.table==='prevencion_respuestas'?'prevencion_formularios.empresa':'empresa',profile.empresa);
 const {data,error}=await query;if(error)throw error;
 if(!data?.length)throw Error('El registro ya no existe o no tienes acceso.');
 const works=String(profile.obras||'').split(',').map(s=>s.trim().toLocaleLowerCase('es-CL'));
 for(const row of data){
  let work=row.obra_nombre||delivery.obra_nombre;
  if(ref.table==='prevencion_respuestas'&&row.obra_id){const result=await db.from('obras').select('id,nombre').eq('id',row.obra_id).eq('empresa',profile.empresa).maybeSingle();if(result.error||!result.data)throw Error('No tienes acceso asignado a esta obra.');work=result.data.nombre;}
  if(work&&!works.includes('todas')&&!works.includes(work.trim().toLocaleLowerCase('es-CL'))&&!/superusuario|superadmin/i.test(profile.rol_base||profile.rol||''))throw Error('No tienes acceso asignado a esta obra.');
 }
 const labels={obra_nombre:'Obra',proyecto_nombre:'Obra',equipo_patente:'Código / patente',equipo_tipo:'Equipo',fecha:'Fecha',created_at:'Registrado el',horometro_inicial:'Horómetro inicial',horometro_final:'Horómetro final',horas_trabajadas:'Horas trabajadas',combustible_cargado:'Combustible (L)',operador:'Operador',observaciones:'Observaciones',tipo:'Tipo',horometro:'Horómetro',descripcion:'Descripción',proveedor:'Proveedor',responsable:'Responsable',severidad:'Severidad',detuvo_equipo:'Detuvo el equipo',horas_fuera_servicio:'Horas fuera de servicio',causa:'Causa',solucion:'Solución',supervisor:'Supervisor',frente:'Frente',partida:'Partida',unidad:'Unidad',cantidad:'Cantidad',guia:'Guía',tipo_movimiento:'Movimiento',material:'Material',inspector:'Informante'};
 const records=data.map(row=>{
  const fields=Object.entries(row).filter(([key,value])=>labels[key]&&value!==null).map(([key,value])=>({label:labels[key],value}));
  if(row.prevencion_formularios){const form=row.prevencion_formularios;fields.unshift({label:'Formulario',value:form.titulo});const definitions=Array.isArray(form.campos)?form.campos:form.campos?.items||[];for(const field of definitions){if(row.respuestas?.[field.id]!==undefined)fields.push({label:field.label,value:row.respuestas[field.id]});}}
  return {id:row.id,fields};
 });
 return {type:ref.table,records};
}
