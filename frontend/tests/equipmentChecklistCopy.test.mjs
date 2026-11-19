import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {checklistCandidates} from '../../supabase/functions/_shared/equipmentQr.mjs';
test('explicit copies never attach to other equipment; native matches remain',()=>{
 const forms=[{id:1,empresa:'A',titulo:'Lista de verificación excavadora'}, {id:2,empresa:'A',titulo:'Lista de verificación excavadora',campos:{control_documental:{equipo_checklist_id:7}}}];
 assert.deepEqual(checklistCandidates({id:7,empresa:'A',tipo:'EXCAVADORA'},forms),[2]);
 assert.deepEqual(checklistCandidates({id:8,empresa:'A',tipo:'EXCAVADORA'},forms),[1]);
 assert.deepEqual(checklistCandidates({id:7,empresa:'B',tipo:'EXCAVADORA'},forms),[]);
});
test('copy RPC is isolated, idempotent and protects core without modifying equipment/history',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.obraxis_actor_can_access_company(text) returns boolean language sql as $$select $1='A'$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select $1='A' and current_setting('test.allowed',true)='yes'$$;
 set test.allowed='yes';
 create table inventario_maquinaria(id integer primary key,empresa text,patente text,horometro_inicial numeric);
 create table prevencion_formularios(id serial primary key,titulo text,descripcion text,categoria text,campos jsonb,creado_por text,publico_token text,empresa text,codigo text,revision text,fecha_revision text);
 insert into inventario_maquinaria values(7,'A','TEST-7',8822.4),(8,'B','TEST-8',0);
 insert into prevencion_formularios(titulo,empresa,campos,publico_token) values('Origen','A','{"items":[{"id":"check","type":"radio","options":["Bueno","Malo"]}],"control_documental":{}}','original');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261119135245_equipment_checklist_copy.sql',import.meta.url),'utf8'));
 const call=()=>db.query('select public.equipo_copiar_checklist(7,1) as form');
 const form=(await call()).rows[0].form;
 assert.notEqual(form.id,1);assert.notEqual(form.publico_token,'original');assert.equal(form.campos.items.length,7);
 assert.equal(form.campos.control_documental.equipo_checklist_id,7);
 assert.equal((await call()).rows[0].form.id,form.id);
 assert.equal((await db.query('select count(*)::int as n from prevencion_formularios')).rows[0].n,2);
 assert.equal((await db.query('select horometro_inicial from inventario_maquinaria where id=7')).rows[0].horometro_inicial,'8822.4');
 assert.equal((await db.query('select publico_token from prevencion_formularios where id=1')).rows[0].publico_token,'original');
 await assert.rejects(db.query('select public.equipo_copiar_checklist(8,1)'),/permiso/);
 await db.exec(`set test.allowed='no'`);await assert.rejects(call(),/permiso/);await db.exec(`set test.allowed='yes'`);
 await assert.rejects(db.query(`update prevencion_formularios set campos=jsonb_set(campos,'{items}','[]') where id=$1`,[form.id]),/protegido/);
 await assert.rejects(db.query(`update prevencion_formularios set campos=jsonb_set(campos,'{items,5,required}','false') where id=$1`,[form.id]),/protegido/);
 await assert.rejects(db.query(`update prevencion_formularios set campos=jsonb_set(campos,'{control_documental,equipo_checklist_id}','8') where id=$1`,[form.id]),/vinculación/);
 await db.query(`update prevencion_formularios set campos=jsonb_set(campos,'{items,6,label}','"Adaptado"') where id=$1`,[form.id]);
 assert.equal((await db.query('select campos from prevencion_formularios where id=1')).rows[0].campos.items[0].label,undefined);
 }finally{await db.close();}
});
