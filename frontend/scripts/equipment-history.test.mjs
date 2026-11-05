import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('intervalo inclusivo, lote atómico y asignación actual intacta',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.maquinaria_puede_editar_grupos(text) returns boolean language sql as $$select $1='A'$$;
 create table obras(id bigint,empresa text);insert into obras values(1,'A');
 create table inventario_maquinaria(id int,empresa text,obra_nombre text,tipo text,patente text,costo_interno numeric,unidad_costo_interno text);
 insert into inventario_maquinaria values(1,'A','Actual','Uno','EQ1',10,'$/día'),(2,'A','Actual','Dos','EQ2',20,'$/día');
 create table maquinaria_periodos_costo(id bigserial primary key,empresa text,equipo_id int,obra_id bigint,desde date,hasta date,tarifa numeric,equipo_tipo text,equipo_patente text,asignacion_id bigint);
 insert into maquinaria_periodos_costo(empresa,equipo_id,desde) values('A',2,'2025-10-21');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261105013636_asignacion_historica_equipos.sql',import.meta.url),'utf8'));
 const run=(end,company='A')=>db.query("select public.asignar_equipos_historicos($1,1,array[1,2],date '2025-09-28',$2)",[company,end]);
 await assert.rejects(run('2025-10-21'),/superpone/);
 assert.equal((await db.query('select count(*)::int n from maquinaria_periodos_costo')).rows[0].n,1);
 await assert.rejects(run('2025-10-20','B'),/permiso/);
 await run('2025-10-20');
 await assert.rejects(run('2025-10-20'),/superpone/);
 const result=await db.query("select count(*)::int n from maquinaria_periodos_costo where hasta='2025-10-21'");
 assert.equal(result.rows[0].n,2);
 assert.equal((await db.query("select count(*)::int n from inventario_maquinaria where obra_nombre='Actual'")).rows[0].n,2);
 await db.exec(`alter table obras add column nombre text;alter table inventario_maquinaria add column fecha_asig date,add column fecha_hasta_estimada date,add column fecha_cambio_asignacion date;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select false$$;
 create function private.obraxis_actor_can_access_company(text) returns boolean language sql as $$select $1='A'$$;
 create table maquinaria_decisiones_costo(tipo text,obra_id int);
 insert into obras values(2,'A','Otra');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261105020015_obras_equipos_compartidos.sql',import.meta.url),'utf8'));
 const shared=()=>db.query("select public.asignar_equipos_historicos('A',2,array[1,2],date '2025-09-28',null)");
 await shared();await shared();
 assert.equal((await db.query("select count(*)::int n from maquinaria_periodos_costo where obra_id=2 and hasta='infinity'")).rows[0].n,2);
 await db.exec("select public.baja_equipo_obra('A',2,(select id from maquinaria_periodos_costo where obra_id=2 and equipo_id=1),'2025-10-05')");
 assert.equal((await db.query("select count(*)::int n from maquinaria_periodos_costo where obra_id=2 and hasta='2025-10-05'")).rows[0].n,1);
 }finally{await db.close();}
});
