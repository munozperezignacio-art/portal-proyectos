import test from 'node:test';
import assert from 'node:assert/strict';
import {canConfigureWork,canConfigureResponsibility} from './workConfigurationAccess.js';
import {uniqueWorkEmailPatch} from './workEmailRouting.js';
const user={empresa:'EMINSG',rol:'Administrador de Contratos',rol_base:'Personalizado',obras:'Obra A'};
const permissions={'obras.ficha.configurar':true,'admin.permisos.configurar':false};
test('work configuration requires permission and assigned work',()=>{
 assert.equal(canConfigureWork(user,permissions,'Obra A'),true);
 assert.equal(canConfigureWork(user,permissions,'Obra B'),false);
 assert.equal(canConfigureWork({...user,obras:'todas'},permissions,'Obra B'),true);
 assert.equal(canConfigureWork(user,{...permissions,'obras.ficha.configurar':false},'Obra A'),false);
});
test('work manager cannot configure global or mixed-scope responsibilities',()=>{
 assert.equal(canConfigureResponsibility(user,permissions,{alcance_tipo:'todas'}),false);
 assert.equal(canConfigureResponsibility(user,permissions,{alcance_tipo:'seleccionadas',obras_seleccionadas:[]}),false);
 assert.equal(canConfigureResponsibility(user,permissions,{alcance_tipo:'seleccionadas',obras_seleccionadas:['Obra A']}),true);
 assert.equal(canConfigureResponsibility(user,permissions,{alcance_tipo:'seleccionadas',obras_seleccionadas:['Obra A','Obra B']}),false);
});
test('general configuration permission enables both scopes',()=>{
 const global={...permissions,'admin.permisos.configurar':true};
 assert.equal(canConfigureWork(user,global,'Obra B'),true);
 assert.equal(canConfigureResponsibility(user,global,{alcance_tipo:'todas'}),true);
});
test('scoped email normalization cannot mutate global or other work settings',()=>{
 const setting={emails:['GLOBAL@example.com'],emailsCC:[],autoNotify:true};
 const patch={correos_contextuales:{'obras:global':{events:{avance_registrado:setting}},'obra:1':{events:{avance_registrado:{emails:[' local@example.com '],emailsCC:[],autoNotify:true}}},'obra:2':{events:{avance_registrado:setting}}}};
 const result=uniqueWorkEmailPatch(patch,['obra:1']);
 assert.deepEqual(result.correos_contextuales['obras:global'],patch.correos_contextuales['obras:global']);
 assert.deepEqual(result.correos_contextuales['obra:2'],patch.correos_contextuales['obra:2']);
 assert.deepEqual(result.correos_contextuales['obra:1'].events.avance_registrado.emails,['local@example.com']);
});
