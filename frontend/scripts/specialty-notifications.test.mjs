import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('configured weekday reminder, recipient isolation, duplicate suppression and close without self-notification',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create table obras(id int,nombre text,empresa text);create table partidas_obra(id int,partida text);
 create table config_empresa(empresa text,correos_contextuales jsonb,notificaciones_automaticas boolean);
 create table usuarios(id int,empresa text,obras text,correo text,auth_user_id uuid,rol text);
 create table private.specialty_sessions(id uuid,obra_id int,partida_id int,fecha date,responsable uuid,estado text,datos jsonb);
 create table private.specialty_elements(id uuid,obra_id int,partida_id int);
 create table notificaciones_reglas(id uuid,empresa text,activa boolean,evento_codigo text,condiciones jsonb,obra_nombre text,hora_envio time,destinatarios_usuarios jsonb,destinatarios_roles jsonb,canal_plataforma boolean,canal_push boolean,canal_email boolean,correos_adicionales jsonb);
 create table notificaciones_entregas(id serial,regla_id uuid,empresa text,evento_codigo text,obra_nombre text,canal text,destinatario text,asunto text,estado text,payload jsonb,enviada_at timestamptz);
 insert into obras values(1,'A','TEST');insert into partidas_obra values(1,'Pilas');
 insert into usuarios values(1,'TEST','A','actor@example.invalid','00000000-0000-4000-8000-000000000001','Supervisor'),(2,'TEST','A','review@example.invalid','00000000-0000-4000-8000-000000000002','Revisor'),(3,'OTHER','A','other@example.invalid','00000000-0000-4000-8000-000000000003','Revisor');
 insert into private.specialty_sessions values('10000000-0000-4000-8000-000000000001',1,1,'2026-11-06','00000000-0000-4000-8000-000000000001','abierta','{"pilas":[]}');
 alter table private.specialty_sessions add column report_ids int[] default '{1}';
 insert into config_empresa values('TEST','{"obras:global":{"events":{"avance_registrado":{"autoNotify":true,"emails":["review@example.invalid","actor@example.invalid"],"emailsCC":["review@example.invalid"]}}}}',true);
 insert into notificaciones_reglas values('20000000-0000-4000-8000-000000000001','TEST',true,'especialidad_jornada_abierta','{}',null,'20:00','[]','[]',true,true,true,'[]');`);
 await db.exec(await readFile(new URL('../../supabase/schema/specialty-notifications.sql',import.meta.url),'utf8'));
 const collect=async time=>(await db.query('select private.specialty_collect_notifications($1::timestamptz) r',[time])).rows[0].r;
 assert.equal((await collect('2026-11-06T22:59:00Z')).length,0);
 assert.equal((await collect('2026-11-06T23:00:00Z')).length,1);
 assert.equal((await collect('2026-11-06T23:01:00Z')).length,0);
 assert.equal((await collect('2026-11-07T23:00:00Z')).length,0);
 assert.equal((await db.query('select count(*)::int n from notificaciones_entregas')).rows[0].n,1);
 await db.exec(`update notificaciones_reglas set evento_codigo='avance_registrado',destinatarios_roles='["Supervisor","Revisor"]';update private.specialty_sessions set estado='cerrada';`);
 const closed=await collect('2026-11-09T23:00:00Z');assert.equal(closed.length,1);assert.equal(closed[0].destinatario,'review@example.invalid');
 assert.equal((await collect('2026-11-09T23:00:00Z')).length,0);
 assert.equal((await db.query("select count(*)::int n from notificaciones_entregas where destinatario='2'")).rows[0].n,1);
 }finally{await db.close();}
});
