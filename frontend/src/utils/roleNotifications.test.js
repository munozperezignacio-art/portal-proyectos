import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
import {notificationRecipient} from '../../../supabase/functions/_shared/notificationRecipients.mjs';
const pref=(changes={})=>({email:false,mobile:false,web:true,works:'assigned',forms:'all',form_ids:[],equipment:'all',equipment_ids:[],...changes});
test('notification channels are independent and enforce current role/work',()=>{
 const row={empresa:'TEST',destinatario:'1',obra_nombre:'Lonco',payload:{role_notification:true,role_name:'Supervisor',works_scope:'assigned',channels:{web:true,email:false,mobile:false}}};
 const user={empresa:'TEST',id:1,rol:'Supervisor',obras:'Lonco'};
 assert.equal(notificationRecipient(row,user,'web'),true);assert.equal(notificationRecipient(row,user,'mobile'),false);assert.equal(notificationRecipient(row,user,'email'),false);
 assert.equal(notificationRecipient(row,{...user,obras:'Other'},'web'),false);assert.equal(notificationRecipient(row,{...user,rol:'Other'},'web'),false);
 row.payload.works_scope='all';assert.equal(notificationRecipient(row,{...user,obras:'Other'},'web'),true);
});
test('SQL routing: role settings, tenant/work/form filtering, dedup and email queue',async()=>{
 const db=new PGlite();try{await db.exec(`
 create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.obraxis_actor_can_manage_company(text) returns boolean language sql as $$select $1='TEST'$$;
 create function private.obraxis_actor_can_access_company(text) returns boolean language sql as $$select $1='TEST'$$;
 create table roles(id integer primary key,empresa text,nombre text,rol_base text,archivado boolean);
 create table usuarios(id integer,empresa text,rol text,rol_base text,usuario text,correo text,obras text,auth_user_id uuid);
 create table obras(id integer,empresa text,nombre text);
 create table prevencion_formularios(id integer,empresa text);
 create table inventario_maquinaria(id text,empresa text);
 create table maquinaria_uso_diario(id integer,empresa text,equipo_id text);
 create table maquinaria_mantenciones(id integer,empresa text,obra_nombre text,equipo_id text);
 create table maquinaria_fallas(id integer,empresa text,obra_nombre text,equipo_id text);
 create table inventario_materiales(id integer,empresa text,obra_nombre text);
 create table asistencia_personal(id integer,empresa text,obra_nombre text);
 create table prevencion_respuestas(id integer,formulario_id integer,obra_id integer);
 create table private.obra_notification_events(id uuid default gen_random_uuid(),empresa text,obra_id integer,event_key text,unique(empresa,obra_id,event_key));
 create table notificaciones_reglas(id uuid default gen_random_uuid(),empresa text,nombre text,evento_codigo text,modulo text,destinatarios_roles jsonb,canal_email boolean,canal_plataforma boolean,canal_push boolean,activa boolean,frecuencia text,hora_envio time,condiciones jsonb);
 create table notificaciones_entregas(id bigint generated always as identity,regla_id uuid,empresa text,evento_codigo text,obra_nombre text,canal text,destinatario text,asunto text,estado text,payload jsonb,enviada_at timestamptz);
 insert into roles values(1,'TEST','Supervisor',null,false),(2,'TEST','OT',null,false);
 insert into usuarios values(1,'TEST','Supervisor',null,'one','one@example.invalid','Lonco',null),(2,'TEST','Supervisor',null,'two','two@example.invalid','Coquimbo',null),(3,'TEST','OT',null,'three','three@example.invalid','Coquimbo',null);
 insert into obras values(1,'TEST','Lonco'),(2,'TEST','Coquimbo');
 insert into prevencion_formularios values(11,'TEST'),(12,'OTHER');
 `);
 await db.exec(readFileSync(new URL('../../../supabase/schema/role-notifications.sql',import.meta.url),'utf8'));
 const save=(role,settings,expected={})=>db.query("select save_role_notifications('TEST',$1,$2,$3)",[role,JSON.stringify(settings),JSON.stringify(expected)]);
 await save(1,{obra_reporte_avance:pref({email:true})});await save(2,{obra_reporte_avance:pref({works:'all',mobile:true,web:false})});
 await db.query("select private.emit_work_notification('TEST',1,'report:1','obra_reporte_avance','Nuevo reporte','{}')");
 let rows=(await db.query('select * from notificaciones_entregas')).rows;assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.canal==='Correo').length,1);assert.deepEqual(rows.filter(r=>r.canal==='Plataforma').map(r=>r.destinatario).sort(),['1','3']);
 await db.query("select private.emit_work_notification('TEST',1,'report:1','obra_reporte_avance','Nuevo reporte','{}')");assert.equal((await db.query('select * from notificaciones_entregas')).rows.length,3);
 await assert.rejects(save(1,{}),/Recarga/);
 await assert.rejects(save(2,{prevencion_registro_recibido:pref({forms:'selected',form_ids:['12']})},{obra_reporte_avance:pref({works:'all',mobile:true,web:false})}),/Formulario ajeno/);
 await save(1,{prevencion_registro_recibido:pref({forms:'selected',form_ids:['11']})},{obra_reporte_avance:pref({email:true})});
 await db.exec('insert into prevencion_respuestas values(21,11,1)');rows=(await db.query("select * from notificaciones_entregas where evento_codigo='prevencion_registro_recibido'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].destinatario,'1');
 await db.exec('insert into prevencion_respuestas values(22,11,null)');assert.equal((await db.query("select * from notificaciones_entregas where evento_codigo='prevencion_registro_recibido'")).rows.length,1);
 await save(1,{asistencia_registrada:pref()},{prevencion_registro_recibido:pref({forms:'selected',form_ids:['11']})});
 await db.exec("insert into asistencia_personal values(1,'TEST','Lonco'),(2,'TEST','Lonco'),(3,'TEST','Lonco')");
 assert.equal((await db.query("select * from notificaciones_entregas where evento_codigo='asistencia_registrada'")).rows.length,1);
 }finally{await db.close();}
});

