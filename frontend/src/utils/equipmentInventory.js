import {hasAssignedWork} from './equipmentAssignments.js';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const active=item=>!['cancelada','cancelado','anulada','anulado','finalizada','finalizado','cerrado','cerrada'].includes(normalize(item.estado));
export const INVENTORY_STATES=[['','Total'],['libre','Disponibles'],['en_uso','Asignados'],['mantencion','En mantención'],['fuera_servicio','Fuera de servicio'],['reservado','Reservados'],['arrendado','Arrendados']];
export function inventoryState(equipment,bookings=[],rentals=[],today){
  const status=normalize(equipment.estado_equipo);
  if(/fuera de servicio|paraliz|inoperativ|baja/.test(status))return {code:'fuera_servicio',label:'Fuera de servicio',color:'bg-red-50 text-red-800 border-red-200'};
  if(/mantencion|mantenimiento/.test(status))return {code:'mantencion',label:'En mantención',color:'bg-orange-50 text-orange-900 border-orange-200'};
  if(rentals.some(item=>String(item.equipo_id)===String(equipment.id)&&normalize(item.estado)==='activo'&&(!item.fecha_inicio||item.fecha_inicio<=today)&&(!item.fecha_fin||item.fecha_fin>=today)))return {code:'arrendado',label:'Arrendado',color:'bg-purple-50 text-purple-900 border-purple-200'};
  if(hasAssignedWork(equipment.obra_nombre))return {code:'en_uso',label:'Asignado',color:'bg-blue-50 text-blue-900 border-blue-200'};
  if(bookings.some(item=>String(item.equipo_id)===String(equipment.id)&&active(item)&&item.fecha_inicio&&(!item.fecha_fin||item.fecha_fin>=today)))return {code:'reservado',label:'Reservado',color:'bg-amber-50 text-amber-900 border-amber-200'};
  return {code:'libre',label:'Disponible',color:'bg-emerald-50 text-emerald-800 border-emerald-200'};
}
export function inventoryRows(equipment,{search='',category='',work='',state='',sort='patente',direction=1},categories,bookings,rentals,today){
  const names=new Map(categories.map(item=>[String(item.id),item.nombre]));
  return equipment.map(item=>({...item,categoryName:names.get(String(item.categoria_id))||'Sin categoría',inventoryStatus:inventoryState(item,bookings,rentals,today)}))
    .filter(item=>(!search||normalize(`${item.tipo} ${item.patente} ${item.marca} ${item.modelo||''} ${item.categoryName}`).includes(normalize(search)))
      &&(!category||(category==='__none'?!item.categoria_id:String(item.categoria_id)===category))
      &&(!work||(work==='__bodega'?!hasAssignedWork(item.obra_nombre):item.obra_nombre===work))
      &&(!state||item.inventoryStatus.code===state))
    .sort((a,b)=>direction*String(a[sort]||'').localeCompare(String(b[sort]||''),'es',{numeric:true,sensitivity:'base'})||Number(a.id)-Number(b.id));
}
export function inventoryTariff(item){
  if(item.costo_interno==null||item.costo_interno===''||!Number.isFinite(Number(item.costo_interno))||Number(item.costo_interno)<0)return 'Sin tarifa';
  const unit=String(item.unidad_costo_interno||'$/día').replace(/^\$\s*\/?/,'');
  return `$${Number(item.costo_interno).toLocaleString('es-CL')} / ${unit}`;
}
