import test from 'node:test';import assert from 'node:assert/strict';
import {notificationGroups} from './notificationGroups.js';
import {NOTIFICATION_EVENTS} from './roleNotificationCatalog.js';
import {RESPONSIBILITY_CATALOG} from './responsibilityCatalog.js';
import {notificationReference,enrichNotification,readNotificationRecord} from '../../../supabase/functions/_shared/notificationContext.mjs';
import {notificationText} from '../../../supabase/functions/_shared/notificationText.mjs';
test('events grouped once by platform owner and enabled company modules',()=>{
 for(const events of [NOTIFICATION_EVENTS,RESPONSIBILITY_CATALOG]){
 const all=notificationGroups(events,{empresa:'Obraxis'});assert.equal(all.flatMap(g=>g.items).length,events.length);
 assert.equal(new Set(all.flatMap(g=>g.items.map(e=>e.code))).size,events.length);
 }
 const work=notificationGroups(NOTIFICATION_EVENTS,{empresa:'TEST',modulos_activos:['obras']});
 assert.ok(work.filter(g=>!g.key.startsWith('admin:')).every(g=>g.label.startsWith('Obras · ')));assert.ok(work.flatMap(g=>g.items).some(e=>e.code==='obra_reporte_maquinaria'));
 assert.ok(!work.flatMap(g=>g.items).some(e=>e.code==='mantenimiento_registrado'));
 const global=notificationGroups(NOTIFICATION_EVENTS,{empresa:'TEST',modulos_activos:['maquinaria']});
 assert.ok(global.every(g=>g.label.startsWith('Módulos globales · ')));assert.ok(global.flatMap(g=>g.items).some(e=>e.code==='enex_pendiente'));
 assert.deepEqual(notificationGroups(NOTIFICATION_EVENTS,null),[]);
});
test('exact record ids and legacy keys; arbitrary paths are never used',()=>{
 assert.deepEqual(notificationReference({evento_codigo:'obra_reporte_avance',payload:{reporte_ids:[4,4,7,-1,'sql']}}).ids,['4','7']);
 assert.deepEqual(notificationReference({evento_codigo:'prevencion_registro_recibido',payload:{event_id:'form:12'}}).ids,['12']);
 assert.equal(notificationReference({evento_codigo:'unknown',payload:{reporte_id:1,table:'usuarios',route:'https://evil.invalid'}}),null);
});
function db(rows){return {from(table){const filters=[];let list=false;const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},in:(key,value)=>{filters.push([key,value]);list=true;return q;},maybeSingle:()=>q,then(resolve){const result=(rows[table]||[]).filter(r=>filters.every(([k,v])=>Array.isArray(v)?v.map(String).includes(String(r[k])):String(r[k])===String(v)));resolve({data:list?result:result[0]||null});}};return q;}};}
const delivery={evento_codigo:'obra_reporte_maquinaria',obra_nombre:'Lonco',payload:{reporte_id:41,detalle:'private free text'}};
const data={maquinaria_uso_diario:[{id:41,empresa:'TEST',obra_nombre:'Lonco',equipo_id:2,fecha:'2026-11-18',horometro_final:8822.4}],obras:[{id:5,empresa:'TEST',nombre:'Lonco'}],inventario_maquinaria:[{id:2,empresa:'TEST',tipo:'Excavadora',patente:'EXC-02'}]};
test('context uses company-scoped source names and excludes free text',async()=>{
 const result=await enrichNotification(db(data),delivery,'TEST');assert.equal(result.payload.notification_context.equipo,'Excavadora · EXC-02');assert.equal(result.payload.obra_id,5);
 const push=notificationText(result);assert.match(push.body,/Lonco/);assert.match(push.body,/EXC-02/);assert.doesNotMatch(push.body,/private free text/);
 const other=await enrichNotification(db(data),delivery,'OTHER');assert.deepEqual(other.payload.notification_context,{});
 assert.equal(delivery.payload.notification_context,undefined);
});
test('record read checks permissions, company and assigned works',async()=>{
 const profile={empresa:'TEST',obras:'Lonco',rol:'Supervisor'};
 const result=await readNotificationRecord(db(data),delivery,profile,()=>true);assert.equal(result.records[0].id,41);assert.ok(result.records[0].fields.some(f=>f.label==='Horómetro final'));
 await assert.rejects(()=>readNotificationRecord(db(data),delivery,profile,()=>false),/permiso/);
 await assert.rejects(()=>readNotificationRecord(db(data),delivery,{...profile,obras:'Other'},()=>true),/obra/);
 await assert.rejects(()=>readNotificationRecord(db(data),delivery,{...profile,empresa:'OTHER'},()=>true),/no existe/);
});
