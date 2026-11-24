import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {renderEnexPendingEmail} from '../../supabase/functions/_shared/enexPendingEmail.mjs';
import {dispatchRoleEmails} from '../../supabase/functions/_shared/roleNotificationEmails.ts';

const sample={company:'EMINSG',name:'Responsable de prueba',day:'2026-11-24',count:3,oldest:'2026-11-20',vehicles:[{vehicle:'TEST-01',portal:'transporte',count:2},{vehicle:'TEST-02',portal:'empresa',count:1}]};
test('email renders current owner summary, escapes names and has text alternative',()=>{
 const result=renderEnexPendingEmail({...sample,name:'<script>alert(1)</script>'});
 assert.match(result.subject,/3 cargas pendientes/);assert.match(result.text,/TEST-01/);
 assert.match(result.html,/&lt;script&gt;/);assert.doesNotMatch(result.html,/<script>/);
 assert.match(result.text,/máximo un correo/);assert.match(result.html,/centro de gestión/);
 assert.match(result.text,/20-11-2026/);
});

test('daily claim: recipient isolation, no pending/no mail, concurrent duplicate, morning/timezone and least privilege',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create function public.test_now() returns timestamptz language sql as $$select current_setting('test.now')::timestamptz$$;
 set test.now='2026-11-24 12:00:00+00';
 create table public.roles(id int primary key,empresa text,nombre text,archivado boolean);
 create table public.usuarios(id int,empresa text,auth_user_id uuid,nombre text,usuario text,correo text,rol text,obras text);
 create table public.role_notifications(empresa text,role_id int,settings jsonb,updated_at timestamptz,primary key(empresa,role_id));
 create table public.notificaciones_entregas(id bigint generated always as identity primary key,empresa text,evento_codigo text,canal text,destinatario text,asunto text,estado text,payload jsonb,role_route_key text,created_at timestamptz default public.test_now(),enviada_at timestamptz,obra_nombre text,regla_id uuid);
 create unique index route_key on public.notificaciones_entregas(role_route_key) where role_route_key is not null;
 create table public.notificaciones_reglas(id uuid,condiciones jsonb);
 create table private.movements(id int primary key,empresa text,owner_id uuid,vehicle text,portal text,occurred_local timestamp,assigned boolean default false);
 create view private.enex_pending_owned as select * from private.movements where not assigned;
 insert into public.roles values(1,'EMINSG','Supervisor',false),(2,'OTHER','Supervisor',false);
 insert into public.usuarios values
 (1,'EMINSG','00000000-0000-0000-0000-000000000001','Uno','one','one@example.invalid','Supervisor',''),
 (2,'EMINSG','00000000-0000-0000-0000-000000000002','Dos','two','two@example.invalid','Supervisor',''),
 (3,'EMINSG','00000000-0000-0000-0000-000000000003','Sin pendientes','three','three@example.invalid','Supervisor','');
 insert into private.movements values
 (1,'EMINSG','00000000-0000-0000-0000-000000000001','TEST-01','transporte','2026-11-20',false),
 (2,'EMINSG','00000000-0000-0000-0000-000000000002','TEST-02','empresa','2026-11-21',false),
 (3,'OTHER','00000000-0000-0000-0000-000000000001','SECRET','empresa','2026-11-01',false),
 (4,'EMINSG','00000000-0000-0000-0000-000000000001','ASSIGNED','empresa','2026-11-01',true);`);
 const schema=await readFile(new URL('../../supabase/schema/enex-pending-email.sql',import.meta.url),'utf8');
 // The production signature has no caller-controlled clock. Only this in-memory test replaces now().
 await db.exec(schema.replaceAll('now()','public.test_now()'));
 const router=await readFile(new URL('../../supabase/schema/role-notifications.sql',import.meta.url),'utf8');
 await db.exec(router.slice(router.indexOf('create or replace function private.route_role_notification'),router.indexOf('create trigger a_role_notification_router')).replaceAll('now()','public.test_now()'));
 await db.exec('create trigger a_role_notification_router before insert on public.notificaciones_entregas for each row execute function private.route_existing_notification()');
 const source=async(owner,key)=>{
 await db.query(`insert into public.notificaciones_entregas(empresa,evento_codigo,canal,destinatario,asunto,estado,payload) values('EMINSG','enex_pendiente','Plataforma',$1,'Pendientes','Enviada',jsonb_build_object('event_id',$2::text,'destination','combustibles'))`,[String(owner),key]);
 const rows=(await db.query("select * from public.notificaciones_entregas where canal='Correo' and payload->>'event_id'=$1",[key])).rows;
 assert.equal(rows.length,1);await db.query("update public.notificaciones_entregas set estado='Procesando' where id=$1",[rows[0].id]);return rows[0].id;
 };
 const claim=async id=>(await db.query('select public.enex_claim_pending_email($1) result',[id])).rows[0].result;
 const first=await source(1,'first');let summary=await claim(first);
 assert.equal(summary.count,1);assert.equal(summary.name,'Uno');assert.equal(summary.vehicles[0].vehicle,'TEST-01');
 const second=await source(2,'second');summary=await claim(second);assert.equal(summary.vehicles[0].vehicle,'TEST-02');
 assert.equal(await claim(first),null);
 const duplicate1=await source(1,'duplicate1'),duplicate2=await source(1,'duplicate2');
 assert.deepEqual(await Promise.all([claim(duplicate1),claim(duplicate2)]),[null,null]);
 assert.equal(await claim(await source(3,'empty')),null);
 await db.exec("set test.now='2026-11-25 12:00:00+00';update private.movements set assigned=true where id=2;");
 assert.equal(await claim(await source(2,'resolved')),null);
 assert.equal(await claim(first),null,'yesterday queue is not sent');
 assert.equal((await claim(await source(1,'next-day'))).count,1,'next local morning is allowed');
 await db.exec("set test.now='2026-11-26 13:00:00+00'");assert.equal(await claim(await source(1,'late')),null);
 await db.exec("set test.now='2026-07-01 12:00:00+00'");assert.equal(await claim(await source(1,'winter-8am')),null);
 await db.exec("set test.now='2026-07-01 13:00:00+00'");assert.equal((await claim(await source(1,'winter-9am'))).count,1);
 await db.exec("set test.now='2026-11-27 12:00:00+00'");const disabled=await source(1,'disabled');
 await db.exec(`update public.role_notifications set settings=jsonb_set(settings,'{enex_pendiente,email}','false') where empresa='EMINSG'`);assert.equal(await claim(disabled),null);
 const grants=(await db.query(`select has_function_privilege('anon','public.enex_claim_pending_email(bigint)','execute') anon,has_function_privilege('authenticated','public.enex_claim_pending_email(bigint)','execute') auth,has_function_privilege('service_role','public.enex_claim_pending_email(bigint)','execute') server`)).rows[0];
 assert.deepEqual(grants,{anon:false,auth:false,server:true});
 // Exercise the actual existing producer plus role router twice in the morning.
 const producerFile=await readFile(new URL('../../supabase/migrations/20261116090000_enex_responsables.sql',import.meta.url),'utf8');
 const producer=producerFile.slice(producerFile.indexOf('create table private.enex_daily_notice'),producerFile.indexOf("select cron.schedule('enex-pendientes-manana'"));
 await db.exec(producer.replaceAll('now()','public.test_now()'));
 await db.exec(`set test.now='2026-11-28 12:00:00+00';update public.role_notifications set settings=jsonb_set(settings,'{enex_pendiente,email}','true') where empresa='EMINSG';
 select private.enex_notify_pending();select private.enex_notify_pending();`);
 const produced=(await db.query("select canal,destinatario from public.notificaciones_entregas where created_at=public.test_now() order by canal")).rows;
 assert.deepEqual(produced,[{canal:'Correo',destinatario:'one@example.invalid'},{canal:'Plataforma',destinatario:'1'}]);
 assert.equal((await db.query('select count(*)::int n from private.movements')).rows[0].n,4);
 }finally{await db.close();}
});

for(const scenario of ['accept','empty','uncertain','reject'])test(`worker ${scenario}: one attempt, never automatic resend`,async()=>{
 const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno;globalThis.Deno={env:{get:()=> 'fake-test-key'}};
 const state={status:'Pendiente',sends:0};
 const pref={email:true,web:true,mobile:true,works:'all',forms:'all',equipment:'all'};
 const row={id:91,empresa:'EMINSG',destinatario:'one@example.invalid',evento_codigo:'enex_pendiente',asunto:'Old count',payload:{role_notification:true,role_name:'Supervisor',role_id:1,channels:pref,works_scope:'all'}};
 const db={rpc:async(name,args)=>{assert.equal(name,'enex_claim_pending_email');assert.equal(args.p_delivery,91);return {data:scenario==='empty'?null:sample};},from(table){let update=null;const filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},not:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,update:v=>{update=v;return q;},then:resolve=>{
 let data;if(table==='config_empresa')data={};else if(table==='usuarios')data={id:1,empresa:'EMINSG',correo:'one@example.invalid',rol:'Supervisor',obras:''};else if(table==='role_notifications')data={settings:{enex_pendiente:pref}};else if(update){if(filters.estado&&state.status!==filters.estado)data=[];else{state.status=update.estado;state.detail=update.error_detalle;state.payload=update.payload;data=[{id:91}];}}else data=state.status==='Pendiente'?[row]:[];return Promise.resolve(resolve({data}));}};return q;}};
 globalThis.fetch=async(url,options)=>{state.sends++;const mail=JSON.parse(options.body);assert.deepEqual(mail.to,['one@example.invalid']);assert.match(mail.subject,/3 cargas/);assert.match(mail.text,/TEST-01/);assert.match(mail.html,/Responsable de prueba/);if(scenario==='uncertain')throw Error('timeout');return {ok:scenario!=='reject',json:async()=>scenario==='reject'?{error:'rejected'}:{id:'fake-provider-id'}};};
 try{await dispatchRoleEmails(db);await dispatchRoleEmails(db);assert.equal(state.sends,scenario==='empty'?0:1);assert.equal(state.status,scenario==='accept'?'Enviada':scenario==='empty'?'Omitida':'Error');if(scenario==='accept'){assert.equal(state.payload.delivery_confirmed,false);assert.equal(state.payload.provider_id,'fake-provider-id');}}finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;}
});
