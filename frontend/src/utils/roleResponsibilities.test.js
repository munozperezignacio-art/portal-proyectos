import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('role responsibilities: persistence, isolation, stale updates and work boundary',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.obraxis_actor_can_manage_company(text) returns boolean language sql as $$select $1='TEST'$$;
 create table roles(id integer,nombre text,empresa text,archivado boolean);
 create table usuarios(id integer,usuario text,correo text,empresa text,rol text,obras text);
 create table notificaciones_reglas(id uuid default gen_random_uuid() primary key,empresa text,nombre text,evento_codigo text,modulo text,descripcion text,obra_nombre text,destinatarios_roles jsonb default '[]',destinatarios_usuarios jsonb default '[]',correos_adicionales jsonb default '[]',canal_email boolean,canal_plataforma boolean,canal_push boolean,frecuencia text,hora_envio time,condiciones jsonb default '{}',activa boolean,creado_por text,updated_at timestamptz);
 create table notificaciones_entregas(regla_id uuid,empresa text,obra_nombre text,destinatario text);
 insert into roles values(1,'Supervisor','TEST',false),(2,'Oficina Técnica','TEST',false),(3,'Supervisor','OTHER',false);
 insert into usuarios values(1,'uno','uno@example.invalid','TEST','Supervisor','Lonco'),(2,'dos','dos@example.invalid','TEST','Supervisor','Coquimbo'),(3,'tres','tres@example.invalid','OTHER','Supervisor','Lonco'),(4,'cuatro','cuatro@example.invalid','TEST','Oficina Técnica','Lonco');
 `);
 await db.exec(readFileSync(new URL('../../../supabase/schema/role-responsibilities.sql',import.meta.url),'utf8'));
 const save=(role,codes,old=[],company='TEST')=>db.query('select guardar_responsabilidades_rol($1,$2,$3,$4)',[company,role,codes,old]);
 await save(1,['gastos_imputacion_pendiente']);
 await assert.rejects(save(1,[],[]),/Otro administrador/);
 await assert.rejects(save(3,['gastos_imputacion_pendiente'],[],'OTHER'),/permiso/);
 await assert.rejects(save(3,[]),/Rol no disponible/);
 await assert.rejects(save(2,['inventado']),/desconocida/);
 await save(2,['gastos_imputacion_pendiente']);
 const r=(await db.query('select * from notificaciones_reglas')).rows;
 assert.equal(r.length,1);assert.deepEqual(r[0].destinatarios_roles,['Supervisor','Oficina Técnica']);assert.equal(r[0].canal_email,false);assert.equal(r[0].condiciones.alcance_tipo,'asignadas');
 for(const user of [1,2,3,4])await db.query("insert into notificaciones_entregas values($1,'TEST','Lonco',$2)",[r[0].id,String(user)]);
 assert.deepEqual((await db.query('select destinatario from notificaciones_entregas')).rows.map(x=>x.destinatario),['1','4']);
 await db.query("insert into notificaciones_entregas values($1,'TEST',null,'1')",[r[0].id]);assert.equal((await db.query('select * from notificaciones_entregas')).rows.length,2);
 await save(1,[],['gastos_imputacion_pendiente']);await save(2,[],['gastos_imputacion_pendiente']);
 assert.equal((await db.query('select activa from notificaciones_reglas')).rows[0].activa,false);
 await db.query("insert into notificaciones_entregas values($1,'TEST','Lonco','1')",[r[0].id]);assert.equal((await db.query('select * from notificaciones_entregas')).rows.length,2);
 }finally{await db.close();}
});

