import {companyPermissionCatalog,moduleHasViewAccess} from './companyPermissions.js';
import {isSuperUser,mergePermissions} from './permissionsCatalog.js';
export const INHERIT_ROLE_ACCESS='accesos.heredar_rol';
export const accessList=value=>(Array.isArray(value)?value:String(value || '').split(',')).map(item=>String(item).trim().toLowerCase()).filter(Boolean);
export const inheritsRoleAccess=user=>user?._hereda_accesos_rol ?? user?.permisos?.[INHERIT_ROLE_ACCESS]===true;
export function navigationSubmenuEnabled(user,company,id) {
 if(isSuperUser(user))return true;
 const strict=typeof user?.permisos?.[INHERIT_ROLE_ACCESS]==='boolean' || user?._hereda_accesos_rol===true;
 const contracted=accessList(company?.submenus_activos),allowed=accessList(user?.submenus);
 if((strict || contracted.length) && !contracted.includes(id))return false;
 return !(strict || allowed.length) || allowed.includes(id);
}
const navigationId=id=>id==='formularios'?'formularios_capacitaciones':id;
const submenuRules=[
 ['prevencion_formularios','prevencion','prevencion.registros.ver'],['prevencion_cumplimiento','prevencion','prevencion.procedimientos.ver'],['prevencion_capacitaciones','prevencion','prevencion.registros.ver'],['prevencion_estadisticas','prevencion','prevencion.estadisticas.ver'],
 ['presupuestos_items','presupuestos','presupuestos.presupuestos.ver'],['presupuestos_cronograma','presupuestos','presupuestos.presupuestos.ver'],['presupuestos_recursos','presupuestos','presupuestos.presupuestos.ver'],['presupuestos_indirectos','presupuestos','presupuestos.presupuestos.ver'],
 ['facturacion_emitidos','facturacion','facturacion.documentos.ver'],['facturacion_clientes','facturacion','facturacion.maestros.ver'],['facturacion_configuracion','facturacion','facturacion.tributario.configurar'],['facturacion_operacion_dte','facturacion','facturacion.documentos.ver'],
 ['obras_produccion','obras','obras.avances.ver'],['obras_asistencia','obras','obras.personal.ver'],['obras_maquinaria','obras','obras.maquinaria.ver'],['obras_materiales','obras','obras.gestion.ver']
];
export function deriveRoleNavigation(role,company,userPermissions={}) {
 if(!role || !company || role.empresa!==company.empresa || role.archivado===true)return {modulos:[],submenus:[]};
 const permissions=mergePermissions(role.permisos,userPermissions);
 const unrestricted=isSuperUser({empresa:role.empresa,rol:role.nombre,rol_base:role.rol_base});
 const legacyModules=accessList(role.modulos),legacySubmenus=accessList(role.submenus);
 const configured=Object.keys(role.permisos || {}).length>0;
 const effectiveUser={empresa:role.empresa,rol:role.nombre,rol_base:role.rol_base};
 const modulos=companyPermissionCatalog(company).filter(module=>{
  return unrestricted || (configured?moduleHasViewAccess(effectiveUser,permissions,navigationId(module.id)):legacyModules.includes(navigationId(module.id)));
 }).map(module=>navigationId(module.id));
 const companySubmenus=company.empresa==='Obraxis'?null:accessList(company.submenus_activos);
 const submenus=submenuRules.filter(([id,parent,key])=>modulos.includes(parent) && (!companySubmenus || companySubmenus.includes(id)) &&
  (unrestricted || (Object.hasOwn(permissions,key)?permissions[key]===true:legacySubmenus.includes(id) || (configured && permissions[key]!==false && moduleHasViewAccess(effectiveUser,permissions,parent))))).map(([id])=>id);
 return {modulos,submenus};
}
export function userNavigationPayload(form,role,company,previousPermissions={}) {
 if(!company || company.empresa!==form.empresa)throw new Error('Espera a que se cargue la configuración de la empresa.');
 const inherited=form.heredar_accesos_rol===true;
 if(inherited && (!role || role.empresa!==form.empresa || role.archivado))throw new Error('Selecciona un rol vigente de esta empresa para heredar sus accesos.');
 const permissions={...previousPermissions,[INHERIT_ROLE_ACCESS]:inherited};
 const allowedModules=companyPermissionCatalog(company).map(module=>navigationId(module.id));
 const access=inherited?deriveRoleNavigation(role,company,permissions):{
  modulos:accessList(form.modulos).filter(id=>allowedModules.includes(id)),
  submenus:accessList(form.submenus).filter(id=>submenuRules.some(([key,parent])=>key===id && accessList(form.modulos).includes(parent) && allowedModules.includes(parent)) && (company.empresa==='Obraxis' || accessList(company.submenus_activos).includes(id)))
 };
 return {modulos:access.modulos.join(','),submenus:access.submenus.join(','),permisos:permissions};
}
