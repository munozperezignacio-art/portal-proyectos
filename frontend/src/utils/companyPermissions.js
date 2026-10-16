import {PERMISSIONS_CATALOG,can,permissionKey} from './permissionsCatalog.js';
const aliases={formularios_capacitaciones:'formularios'};
export const permissionModuleId=id=>aliases[id] || id;
export function companyPermissionCatalog(company) {
  if(!company)return [];
  const enabled=company.empresa==='Obraxis'?null:new Set((Array.isArray(company.modulos_activos)?company.modulos_activos:String(company.modulos_activos || '').split(',')).map(id=>permissionModuleId(id.trim().toLowerCase())).filter(Boolean));
  const modules=PERMISSIONS_CATALOG.filter(module=>!enabled || module.id==='admin' || enabled.has(module.id));
  // Calidad uses existing Calidad de Obra keys, not new unenforced permissions.
  if(!enabled || enabled.has('calidad'))modules.push({id:'calidad',permissionModule:'obras',label:'Calidad',menus:[PERMISSIONS_CATALOG.find(m=>m.id==='obras').menus.find(m=>m.id==='calidad')]});
  return modules;
}
export const modulePermissionKeys=module=>module.menus.flatMap(menu=>menu.actions.map(action=>permissionKey(module.permissionModule || module.id,menu.id,action)));
export function setModulePermissions(permissions,module,value) {
  return {...permissions,...Object.fromEntries(modulePermissionKeys(module).map(key=>[key,Boolean(value)]))};
}
export function moduleHasViewAccess(user,permissions,id) {
  const module=id==='calidad'?{permissionModule:'obras',menus:[{id:'calidad'}]}:PERMISSIONS_CATALOG.find(m=>m.id===permissionModuleId(id));
  return !module || module.menus.some(menu=>can(user,permissions,permissionKey(module.permissionModule || module.id,menu.id,'ver')));
}
