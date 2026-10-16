import test from 'node:test';
import assert from 'node:assert/strict';
import {companyPermissionCatalog,modulePermissionKeys,setModulePermissions,moduleHasViewAccess} from './companyPermissions.js';
import {mergePermissions,can} from './permissionsCatalog.js';
test('only contracted company modules appear, including aliases and base administration',()=>{
 const catalog=companyPermissionCatalog({empresa:'EMINSG',modulos_activos:'obras,rrhh,formularios_capacitaciones,calidad'});
 assert.deepEqual(catalog.map(m=>m.id),['obras','rrhh','formularios','admin','calidad']);
 assert.equal(catalog.some(m=>m.id==='facturacion'),false);
 assert.deepEqual(companyPermissionCatalog(null),[]);
 assert.deepEqual(companyPermissionCatalog({empresa:'Vacía',modulos_activos:''}).map(m=>m.id),['admin']);
});
test('deactivation writes explicit denials for every module action and preserves unrelated permissions',()=>{
 const module=companyPermissionCatalog({empresa:'EMINSG',modulos_activos:'obras'}).find(m=>m.id==='obras');
 const before={'rrhh.personal.ver':true,'oculto.personalizado.ver':false};
 const off=setModulePermissions(before,module,false);
 assert.ok(modulePermissionKeys(module).every(key=>off[key]===false));
 assert.equal(moduleHasViewAccess({empresa:'EMINSG',rol:'Administrador'},off,'obras'),false);
 assert.equal(off['rrhh.personal.ver'],true);assert.deepEqual(before,{'rrhh.personal.ver':true,'oculto.personalizado.ver':false});
 const on=setModulePermissions(off,module,true);
 assert.equal(moduleHasViewAccess({empresa:'EMINSG',rol:'Administrador'},on,'obras'),true);
});
test('runtime aliases use existing enforced action keys, with per-user exceptions taking precedence',()=>{
 const user={empresa:'EMINSG',rol:'Administrador'};
 assert.equal(moduleHasViewAccess(user,{'formularios.formularios.ver':false},'formularios_capacitaciones'),false);
 assert.equal(moduleHasViewAccess(user,{'obras.calidad.ver':false},'calidad'),false);
 const merged=mergePermissions({'rrhh.personal.ver':false},{'rrhh.personal.ver':true});
 assert.equal(can(user,merged,'rrhh.personal.ver'),true);
 const quality=companyPermissionCatalog({empresa:'EMINSG',modulos_activos:'calidad'}).find(m=>m.id==='calidad');
 assert.ok(modulePermissionKeys(quality).every(key=>key.startsWith('obras.calidad.')));
});
