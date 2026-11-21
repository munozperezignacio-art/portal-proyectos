import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {activityText,activityMinutes,validateActivities,dailyProgressMessage} from './progressActivities.js';
const rows=[{inicio:'08:00',termino:'08:30',actividad:'Charla y HCR',partida_id:null},{inicio:'08:30',termino:'13:00',actividad:'Pilas de grava',partida_id:10},{inicio:'13:00',termino:'14:00',actividad:'Almuerzo',partida_id:null},{inicio:'14:00',termino:'18:00',actividad:'Pilas de grava',partida_id:10}];
test('activity durations and WhatsApp text use individual persisted intervals',()=>{assert.equal(rows.reduce((n,r)=>n+activityMinutes(r),0),600);assert.equal(activityText(rows).split('\n')[0],'- 08:00 - 08:30 Charla y HCR');assert.doesNotThrow(()=>validateActivities(rows));assert.throws(()=>validateActivities([{...rows[0],termino:'07:00'}]));assert.throws(()=>validateActivities([rows[0],{...rows[1],inicio:'08:15'}]));assert.match(dailyProgressMessage('Lonco','2026-11-20',rows,[]),/14:00 - 18:00 Pilas de grava/);});
test('SQL journal: reopen, catalog, minutes, atomic validation, revision and permissions',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
 create table obras(id integer primary key,empresa text);insert into obras values(1,'EMINSG'),(2,'OTHER');
 create table partidas_obra(id integer primary key,obra_id integer,empresa text,partida text,es_titulo boolean,unidad text);insert into partidas_obra values(10,1,'EMINSG','Pilas de grava',false,'UND'),(20,2,'OTHER','Ajena',false,'UND');
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $1='EMINSG' and $2=1$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select $1='EMINSG' and current_setting('test.allowed',true) is distinct from 'false'$$;`);
 await db.exec(readFileSync(new URL('../../../supabase/schema/progress-activities.sql',import.meta.url),'utf8'));
 const call=async(entries=null,revision=null,work=1)=>(await db.query('select public.progress_activities($1,$2,$3::jsonb,$4) result',[work,'2026-11-20',entries===null?null:JSON.stringify(entries),revision])).rows[0].result;
 assert.equal((await call()).revision,0);const saved=await call(rows,0);assert.equal(saved.revision,1);assert.deepEqual(saved.entries.map(r=>r.minutos),[30,270,60,240]);assert.equal(saved.catalog.length,2);assert.deepEqual((await call()).entries,saved.entries);
 await assert.rejects(call(rows,0),/Otro usuario/);
 await assert.rejects(call([{...rows[0],termino:'07:00'}],1),/horarios/);assert.deepEqual((await call()).entries,saved.entries);
 await assert.rejects(call([{...rows[0],partida_id:20}],1),/no pertenece/);
 await assert.rejects(call(null,null,2),/No autorizado/);
 await call([{...rows[0],actividad:'charla y hcr'}],1);assert.equal((await call()).catalog.length,2);
 const audit=await db.query('select count(*)::int n from private.progress_activity_audit');assert.equal(audit.rows[0].n,2);
 await db.exec("set test.allowed='false'");await assert.rejects(call(rows,2),/No autorizado/);
 assert.equal((await db.query("select has_function_privilege('anon','public.progress_activities(integer,date,jsonb,integer)','execute') ok")).rows[0].ok,false);
 }finally{await db.close();}
});
