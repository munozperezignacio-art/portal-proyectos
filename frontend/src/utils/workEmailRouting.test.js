import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workEmailRecipients,workEmailSetting,workEmailPatch,workEmailBatches,WORK_EMAIL_EVENTS} from './workEmailRouting.js';
import {emailRecipientLists} from '../../../supabase/functions/enviar-correo-sistema/recipients.js';
import {PERMISSIONS_CATALOG} from './permissionsCatalog.js';
const base={company:'Prueba',work:'Lonco',workId:3,event:'avance_registrado'};
const rule={empresa:'Prueba',activa:true,canal_email:true,evento_codigo:'avance_registrado',frecuencia:'Inmediata',correos_adicionales:['rule@example.invalid']};
const config={email_notificaciones:'general@example.invalid',notificaciones_automaticas:true,correos_contextuales:{'avances_obra:Lonco':{emails:['obra@example.invalid'],emailsCC:['copy@example.invalid'],autoNotify:true}}};

test('all works recipients include existing and future works without copying settings',()=>{
  const global=workEmailPatch({},'Lonco',3,{material_registrado:{emails:['GLOBAL@example.invalid'],emailsCC:['copy@example.invalid'],autoNotify:true}},'all');
  assert.deepEqual(Object.keys(global.correos_contextuales),['obras:global']);
  for(const [work,workId] of [['Lonco',3],['Nueva obra futura',999]])assert.deepEqual(workEmailRecipients({...base,config:global,work,workId,event:'material_registrado'}),{to:['global@example.invalid'],cc:['copy@example.invalid']});
  assert.deepEqual(workEmailRecipients({...base,config:global,event:'asistencia_registrada'}),{to:[],cc:[]});
  assert.deepEqual(workEmailRecipients({...base,config:{},event:'material_registrado'}),{to:[],cc:[]});
});
test('global and local recipients combine without duplicates across TO and CC and disable independently',()=>{
  const global=workEmailPatch(config,'Lonco',3,{avance_registrado:{emails:['shared@example.invalid'],emailsCC:['globalcopy@example.invalid'],autoNotify:true}},'all');
  const both=workEmailPatch(global,'Lonco',3,{avance_registrado:{emails:['local@example.invalid','GLOBALCOPY@example.invalid'],emailsCC:['SHARED@example.invalid'],autoNotify:true}});
  assert.deepEqual(workEmailRecipients({...base,config:both}),{to:['local@example.invalid','globalcopy@example.invalid','shared@example.invalid'],cc:[]});
  const localOff=workEmailPatch(both,'Lonco',3,{avance_registrado:{emails:['local@example.invalid'],autoNotify:false}});
  assert.deepEqual(workEmailRecipients({...base,config:localOff}),{to:['shared@example.invalid'],cc:['globalcopy@example.invalid']});
  const globalOff=workEmailPatch(both,'Lonco',3,{avance_registrado:{autoNotify:false}},'all');
  assert.deepEqual(workEmailRecipients({...base,config:globalOff}),{to:['local@example.invalid','globalcopy@example.invalid'],cc:['shared@example.invalid']});
  assert.deepEqual(both.correos_contextuales['obras:global'],global.correos_contextuales['obras:global']);
});
test('editing global settings preserves unrelated works, events and legacy fields',()=>{
  const before=structuredClone(config);
  const patch=workEmailPatch(config,'Lonco',3,{material_registrado:{autoNotify:true,emails:['g@example.invalid']}},'all');
  assert.deepEqual(config,before);
  assert.deepEqual(patch.correos_contextuales['avances_obra:Lonco'],config.correos_contextuales['avances_obra:Lonco']);
  assert.equal(patch.correos_contextuales['obras:global'].emails,undefined);
});

test('legacy work addresses are preserved for advances but never enable a new event',()=>{
  assert.deepEqual(workEmailRecipients({...base,config,rules:[rule]}),{to:['rule@example.invalid','obra@example.invalid'],cc:['copy@example.invalid']});
  for(const event of WORK_EMAIL_EVENTS.filter(item=>item.id!=='avance_registrado').map(item=>item.id))assert.deepEqual(workEmailRecipients({...base,event,config,rules:[rule]}),{to:[],cc:[]});
});
test('specific event recipients replace general and role rules, normalize and deduplicate TO and CC',()=>{
  const changed=workEmailPatch(config,'Lonco',3,{avance_registrado:{emails:[' A@example.invalid ','a@example.invalid'],emailsCC:['A@example.invalid','b@example.invalid'],autoNotify:true}});
  assert.deepEqual(workEmailRecipients({...base,config:{...config,...changed},rules:[rule]}),{to:['a@example.invalid'],cc:['b@example.invalid']});
});
test('disable at work or event scope vetoes rules; no recipient ever defaults to actor',()=>{
  for(const c of [{notificaciones_automaticas:false},{correos_contextuales:{'avances_obra:Lonco':{autoNotify:false}}},{correos_contextuales:{'obra:3':{events:{avance_registrado:{autoNotify:false,emails:['a@example.invalid']}}}}}])assert.deepEqual(workEmailRecipients({...base,config:c,rules:[rule]}),{to:[],cc:[]});
  assert.deepEqual(workEmailRecipients({...base,config:{}}),{to:[],cc:[]});
});
test('saving one event preserves unrelated events, contexts and global config without mutating sources',()=>{
  const current={...config,correos_contextuales:{...config.correos_contextuales,'obra:8':{events:{material_registrado:{autoNotify:true}}}}};
  const before=structuredClone(current);
  const patch=workEmailPatch(current,'Lonco',3,{material_registrado:{autoNotify:true,emails:['b@example.invalid']}});
  assert.deepEqual(Object.keys(patch),['correos_contextuales']);
  assert.deepEqual(current,before);
  assert.deepEqual(patch.correos_contextuales['obra:8'],before.correos_contextuales['obra:8']);
  assert.equal(workEmailSetting({...current,...patch},'Lonco',3,'avance_registrado').emails[0],'obra@example.invalid');
  assert.equal(workEmailSetting({...current,...patch},'Obra renombrada',3,'material_registrado').autoNotify,true);
  assert.equal(workEmailSetting({...current,...patch},'Otra obra',99,'material_registrado').autoNotify,false);
});
test('batching respects total recipient limit and retains every address exactly once even CC only',()=>{
  const addresses=Array.from({length:23},(_,i)=>`user${i}@example.invalid`);
  const batches=workEmailBatches({to:[addresses[0]],cc:[...addresses,addresses[0].toUpperCase()]});
  const actual=batches.flatMap(batch=>[...batch.to,...batch.cc]);
  assert.equal(actual.length,23);assert.equal(new Set(actual).size,23);
  for(const batch of batches){assert.ok(batch.to.length);assert.ok(batch.to.length+batch.cc.length<=10);assert.doesNotThrow(()=>emailRecipientLists(batch));}
  assert.deepEqual(workEmailBatches({to:[],cc:[]}),[]);
});
test('server validates and deduplicates direct and copy recipients together',()=>{
  assert.deepEqual(emailRecipientLists({to:['A@example.invalid','a@example.invalid'],cc:['a@example.invalid','B@example.invalid']}),{to:['a@example.invalid'],cc:['b@example.invalid']});
  assert.throws(()=>emailRecipientLists({to:['ok@example.invalid'],cc:['invalid']}));
  assert.throws(()=>emailRecipientLists({to:['ok@example.invalid'],cc:Array.from({length:10},(_,i)=>`x${i}@example.invalid`)}));
  assert.throws(()=>emailRecipientLists({to:[],cc:['ok@example.invalid']}));
});
test('every notification exposes a real, configurable send permission',()=>{
  const keys=PERMISSIONS_CATALOG.flatMap(module=>module.menus.flatMap(menu=>menu.actions.map(action=>`${module.id}.${menu.id}.${action}`)));
  for(const item of WORK_EMAIL_EVENTS)assert.ok(keys.includes(item.permission),item.id);
});
