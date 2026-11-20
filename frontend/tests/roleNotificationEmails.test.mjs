import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchRoleEmails} from '../../supabase/functions/_shared/roleNotificationEmails.ts';
test('role email worker claims once, accepts provider without claiming delivery, no real mail',async()=>{
const oldFetch=globalThis.fetch;globalThis.Deno={env:{get:()=> 'local-test-only'}};
const state={status:'Pendiente',sends:0};
const pref={email:true,web:false,mobile:false,works:'all',forms:'all',equipment:'all'};
const row={id:1,empresa:'TEST',destinatario:'test@example.invalid',evento_codigo:'obra_reporte_avance',asunto:'Prueba local',payload:{role_notification:true,role_name:'Supervisor',role_id:1,channels:pref,works_scope:'all'}};
const db={from(table){let update=null;let filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},not:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,update:v=>{update=v;return q;},then:resolve=>{
let data;if(table==='config_empresa')data={email_sender:'test@example.invalid'};else if(table==='usuarios')data={id:1,empresa:'TEST',correo:'test@example.invalid',rol:'Supervisor',obras:''};else if(table==='role_notifications')data={settings:{obra_reporte_avance:pref}};else if(update){if(filters.estado&&state.status!==filters.estado)data=[];else{state.status=update.estado;state.detail=update.error_detalle;data=[{id:1}];}}else data=state.status==='Pendiente'?[row]:[];return Promise.resolve(resolve({data}));}};return q;}};
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.match(options.headers['Idempotency-Key'],/role-notification-1/);state.sends++;return {ok:true,json:async()=>({id:'local-provider-id'})};};
try{assert.equal((await dispatchRoleEmails(db)).roleEmailsAccepted,1);assert.equal(state.status,'Enviada');assert.match(state.detail,/entrega no confirmada/);await dispatchRoleEmails(db);assert.equal(state.sends,1);}finally{globalThis.fetch=oldFetch;delete globalThis.Deno;}
});

