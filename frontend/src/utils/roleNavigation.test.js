import test from 'node:test';
import assert from 'node:assert/strict';
import {companyPermissionCatalog,modulePermissionKeys} from './companyPermissions.js';
import {deriveRoleNavigation,userNavigationPayload,inheritsRoleAccess,INHERIT_ROLE_ACCESS,navigationSubmenuEnabled} from './roleNavigation.js';
const company={empresa:'Prueba',modulos_activos:'obras,rrhh,formularios_capacitaciones',submenus_activos:'obras_produccion,obras_asistencia'};
const denied=Object.fromEntries(companyPermissionCatalog(company).flatMap(modulePermissionKeys).map(key=>[key,false]));
const role={empresa:'Prueba',nombre:'Supervisor',rol_base:'Personalizado',permisos:{...denied,'obras.avances.ver':true,'obras.avances.crear':true},modulos:'',submenus:'',archivado:false};
test('new user inherits role navigation without checking modules or submenus again',()=>{
 const payload=userNavigationPayload({empresa:'Prueba',heredar_accesos_rol:true,modulos:[],submenus:[]},role,company);
 assert.equal(payload.modulos,'obras');assert.equal(payload.submenus,'obras_produccion');
 assert.equal(inheritsRoleAccess(payload),true);
 assert.deepEqual(payload.permisos,{[INHERIT_ROLE_ACCESS]:true});
});
test('changing the role changes inherited navigation but cannot exceed contracted modules',()=>{
 const changed={...role,permisos:{...role.permisos,'rrhh.personal.ver':true,'facturacion.documentos.ver':true}};
 assert.deepEqual(deriveRoleNavigation(changed,company).modulos,['obras','rrhh']);
 const reducedCompany={...company,modulos_activos:'obras',submenus_activos:''};
 assert.deepEqual(deriveRoleNavigation(changed,reducedCompany),{modulos:['obras'],submenus:[]});
});
test('archived, unconfigured or foreign-company roles cannot be inherited',()=>{
 assert.deepEqual(deriveRoleNavigation({...role,empresa:'Otra'},company),{modulos:[],submenus:[]});
 assert.deepEqual(deriveRoleNavigation({...role,archivado:true},company),{modulos:[],submenus:[]});
 assert.deepEqual(deriveRoleNavigation({...role,permisos:{}},company),{modulos:[],submenus:[]});
 assert.throws(()=>userNavigationPayload({empresa:'Prueba',heredar_accesos_rol:true},null,company),/rol vigente/);
 assert.throws(()=>userNavigationPayload({empresa:'Otra',heredar_accesos_rol:true},role,company),/configuración/);
});
test('manual exceptions remain opt-in, scoped to the company and preserve existing action exceptions',()=>{
 const previous={'obras.avances.aprobar':false};
 const payload=userNavigationPayload({empresa:'Prueba',heredar_accesos_rol:false,modulos:['obras','facturacion'],submenus:['obras_asistencia','facturacion_emitidos']},role,company,previous);
 assert.equal(payload.modulos,'obras');assert.equal(payload.submenus,'obras_asistencia');
 assert.deepEqual(payload.permisos,{...previous,[INHERIT_ROLE_ACCESS]:false});assert.equal(inheritsRoleAccess(payload),false);
 assert.deepEqual(previous,{'obras.avances.aprobar':false});assert.equal(inheritsRoleAccess({permisos:{}}),false);
});
test('legacy role access remains compatible, including empty submenu denials for inherited users',()=>{
 assert.deepEqual(deriveRoleNavigation({...role,permisos:{},modulos:'obras',submenus:'obras_produccion'},company),{modulos:['obras'],submenus:['obras_produccion']});
 const user={empresa:'Prueba',rol:'Inspector',permisos:{[INHERIT_ROLE_ACCESS]:true},submenus:''};
 assert.equal(navigationSubmenuEnabled(user,company,'obras_produccion'),false);
 assert.equal(navigationSubmenuEnabled({...user,submenus:'obras_produccion'},company,'obras_produccion'),true);
 assert.equal(navigationSubmenuEnabled({...user,submenus:'obras_materiales'},company,'obras_materiales'),false);
});
