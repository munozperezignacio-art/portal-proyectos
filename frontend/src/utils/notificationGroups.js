import {companyPermissionCatalog} from './companyPermissions.js';

// Ownership is explicit: an event mentioning a work is not necessarily an Obras feature.
const workMenus = {
 asistencia_registrada:'personal', rrhh_ausencia_critica:'personal',
 obra_reporte_maquinaria:'maquinaria', maquinaria_registrada:'maquinaria',
 maquinaria_reporte_pendiente:'maquinaria', maquinaria_termino_obra:'maquinaria',
 avance_registrado:'avances', obra_reporte_avance:'avances', avance_reporte_pendiente:'avances',
 especialidad_jornada_abierta:'avances', reportes_diarios_pendientes:'avances',
};
const modules = {'Maquinaria':'maquinaria','Combustibles':'maquinaria','Recursos Humanos':'rrhh','Gastos':'gastos','Prevención':'prevencion','Formularios':'formularios','Bodega':'bodega','Facturación':'facturacion','Acreditaciones':'acreditaciones','Solicitudes':'admin'};
export function notificationGroups(events,company){
 const enabled=companyPermissionCatalog(company), groups=new Map();
 for(const event of events){
  let module=modules[event.module],menu=workMenus[event.code];
  if(event.code.startsWith('prevencion_registro_')||event.code.startsWith('prevencion_cumplimiento_'))module='formularios';
  if(event.module==='Obras'){module='obras';menu=menu||'gestion';}
  if(event.module==='Calidad'){module='obras';menu='calidad';}
  if(event.module==='Estados de pago'){module='obras';menu='estados_pago';}
  if(event.module==='Libro de obra'){module='obras';menu='libro_obra';}
  if(event.module==='Subcontratos'){module='obras';menu='subcontratos';}
  if(menu)module='obras';
  const owner=enabled.find(m=>m.id===module)||(menu==='calidad'?enabled.find(m=>m.id==='calidad'):null);if(!owner)continue;
  const label=module==='obras'?`Obras · ${owner.menus.find(m=>m.id===menu)?.label||'Gestión de obra'}`:`Módulos globales · ${module==='admin'?'Solicitudes':owner.label}`;
  const key=module+':'+(menu||'');
  if(!groups.has(key))groups.set(key,{key,label,items:[],order:enabled.indexOf(owner)});
  groups.get(key).items.push(event);
 }
 return [...groups.values()].sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'es'));
}
