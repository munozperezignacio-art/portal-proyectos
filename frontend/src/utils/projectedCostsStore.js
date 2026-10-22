export async function loadProjectedCosts(db,empresa,obraId){
 const rows=[];
 for(let from=0;;from+=1000){const r=await db.from('obra_costos_proyectados').select('*').eq('empresa',empresa).eq('obra_id',obraId).order('id').range(from,from+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)return rows;}
}
export async function saveProjectedCosts(db,empresa,obraId,form,parts){
 const selected=form.partida==='__todas__'?parts.filter(p=>!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)):parts.filter(p=>p.partida===form.partida);
 if(!selected.length)throw Error('Selecciona una partida válida.');
 const rows=selected.map(p=>({id:form.id||crypto.randomUUID(),empresa,obra_id:obraId,partida_id:p.id??null,partida:p.partida,nombre_item:form.nombre_item||`Costo de ${p.partida}`,tipo_proyeccion:form.tipo_proyeccion,periodicidad:form.periodicidad||'Día',tarifa_tiempo_dia:Number(form.tarifa_tiempo_dia??0),unidad_insumo:form.unidad_insumo||'Unidad',tasa_rendimiento_insumo:Number(form.tasa_rendimiento_insumo??1),precio_unitario_insumo:Number(form.precio_unitario_insumo??0)}));
 if(rows.some(r=>['tarifa_tiempo_dia','tasa_rendimiento_insumo','precio_unitario_insumo'].some(k=>!Number.isFinite(r[k])||r[k]<0)))throw Error('Revisa los importes: deben ser números mayores o iguales a cero.');
 if(form.id&&selected.length!==1)throw Error('Edita un costo a la vez.');
 const query=form.id?db.from('obra_costos_proyectados').update(rows[0]).eq('id',form.id).eq('empresa',empresa).eq('obra_id',obraId):db.from('obra_costos_proyectados').insert(rows);
 const r=await query.select('*');if(r.error)throw r.error;if(r.data?.length!==rows.length)throw Error('No se guardó el costo. Revisa tus permisos.');return r.data;
}
export async function deleteProjectedCost(db,empresa,obraId,id){
 const r=await db.from('obra_costos_proyectados').delete().eq('id',id).eq('empresa',empresa).eq('obra_id',obraId).select('id');if(r.error)throw r.error;if(r.data?.length!==1)throw Error('No se eliminó el costo. Revisa tus permisos.');
}
