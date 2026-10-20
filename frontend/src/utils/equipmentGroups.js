export const equipmentGroupSearch=(item,query)=>`${item.nombre||''} ${item.descripcion||''} ${item.patente||''} ${item.tipo||''} ${item.marca||''} ${item.modelo||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(String(query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
export function equipmentGroupMembers(group,links,equipment,company){
  const ids=new Set(links.filter(l=>l.empresa===company&&String(l.grupo_id)===String(group.id)).map(l=>String(l.equipo_id)));
  return equipment.filter(e=>e.empresa===company&&ids.has(String(e.id)));
}
export function toggleGroupEquipment(selected,visible){
  const ids=visible.map(e=>String(e.id));
  return ids.length&&ids.every(id=>selected.includes(id))?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])].slice(0,500);
}
export async function readEquipmentGroups(client,company){
  if(!company)throw new Error('Falta la empresa.');
  async function pages(table,sort){
    const all=[];for(let offset=0;;offset+=1000){
      let query=client.from(table).select('*').eq('empresa',company);for(const column of sort)query=query.order(column);
      const {data,error}=await query.range(offset,offset+999);if(error)throw error;all.push(...(data||[]));if((data||[]).length<1000)return all;
    }
  }
  const [groups,links]=await Promise.all([pages('maquinaria_grupos',['id']),pages('maquinaria_grupos_equipos',['grupo_id','equipo_id'])]);
  return {groups,links};
}
