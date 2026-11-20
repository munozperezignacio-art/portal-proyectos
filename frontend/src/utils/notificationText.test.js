import test from 'node:test';import assert from 'node:assert/strict';
import {notificationText,presentNotification} from '../../../supabase/functions/_shared/notificationText.mjs';
import {NOTIFICATION_EVENTS} from './roleNotificationCatalog.js';
import {RESPONSIBILITY_CATALOG} from './responsibilityCatalog.js';
test('every configured event and legacy catalogue event has specific text',()=>{
 const texts=NOTIFICATION_EVENTS.map(e=>notificationText({evento_codigo:e.code}));
 assert.equal(new Set(texts.map(t=>t.body)).size,NOTIFICATION_EVENTS.length);
 for(const event of [...NOTIFICATION_EVENTS,...RESPONSIBILITY_CATALOG]){
 const text=notificationText({evento_codigo:event.code});assert.notEqual(text.title,'Obraxis · Notificación',event.code);
 assert.ok(text.title.length<=90,event.code);assert.ok(text.body.length<=180,event.code);
 }
});
test('push text never interpolates private or untrusted content',()=>{
 const text=notificationText({evento_codigo:'enex_pendiente',asunto:'RUT secreto',obra_nombre:'Obra privada',payload:{detalle:'Sueldo $1000000'}});
 assert.match(text.body,/cargas de combustible/);assert.doesNotMatch(JSON.stringify(text),/secreto|privada|1000000/);
 assert.equal(notificationText({evento_codigo:'unknown',asunto:'confidencial'}).title,'Obraxis · Notificación');
});
test('inbox replaces generic copy without mutating history or detailed records',()=>{
 const row={id:1,evento_codigo:'maquinaria_reporte_pendiente',asunto:'Reporte pendiente',payload:{detalle:'Tienes un nuevo aviso. Consulta el registro con tus permisos habituales.',destination:'maquinaria'},leida_at:null};
 const before=structuredClone(row),display=presentNotification(row);assert.match(display.payload.detalle,/equipos sin reporte diario/);assert.deepEqual(row,before);assert.equal(display.asunto,row.asunto);assert.equal(display.payload.destination,'maquinaria');
 const detailed={...row,payload:{detalle:'Detalle original autorizado'}};assert.equal(presentNotification(detailed).payload.detalle,'Detalle original autorizado');
});

