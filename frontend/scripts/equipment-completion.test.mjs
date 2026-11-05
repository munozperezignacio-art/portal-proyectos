import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('notice once, admin confirmation, inclusive last day and other works preserved',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $1='A'$$;
 create table obras(id integer primary key,empresa text,nombre text);insert into obras values(1,'A','Obra'),(2,'A','Otra');
 create table usuarios(id integer,empresa text,rol text,rol_base text,obras text);insert into usuarios values(1,'A','Administrador de Empresa','Administrador Empresa','todas'),(2,'A','Supervisor','Supervisor','todas'),(3,'B','Administrador Empresa','Administrador Empresa','todas');
 create table roles(empresa text,nombre text,rol_base text,archivado boolean);
 create table notificaciones_entregas(empresa text,obra_nombre text,evento_codigo text,canal text,destinatario text,asunto text,estado text,payload jsonb,enviada_at timestamptz);
 create table obra_termino_trabajos(empresa text,obra_id integer,estado text,fecha_termino date,actualizado_en timestamptz);
 insert into obra_termino_trabajos values('A',1,'completada','2025-10-30',now());
 create table inventario_maquinaria(id integer,empresa text,obra_nombre text,fecha_asig date,fecha_hasta_estimada date,fecha_cambio_asignacion date);
 insert into inventario_maquinaria values(7,'A','Otra',null,null,null),(8,'A','Obra',null,null,null);
 create table maquinaria_periodos_costo(id bigint,empresa text,obra_id integer,equipo_id integer,desde date,hasta date);
 insert into maquinaria_periodos_costo values(1,'A',1,7,'2025-10-01','infinity'),(2,'A',2,7,'2025-10-01',null),(3,'A',1,8,'2025-10-01',null);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261105152122_aviso_baja_equipos_termino.sql',import.meta.url),'utf8'));
 await db.exec("update obra_termino_trabajos set estado=estado");
 assert.equal((await db.query('select count(*)::int n from notificaciones_entregas')).rows[0].n,1);
 await assert.rejects(db.exec("select public.responder_cierre_maquinaria('B',1,'2025-10-30','baja',array[7])"),/administradores/);
 await assert.rejects(db.exec("select public.responder_cierre_maquinaria('A',1,'2025-10-29','baja',array[7])"),/cambió/);
 await assert.rejects(db.exec("select public.responder_cierre_maquinaria('A',1,'2025-10-30','baja',array[7,999])"),/disponible/);
 assert.equal((await db.query("select hasta::text h from maquinaria_periodos_costo where id=1")).rows[0].h,'infinity');
 await db.exec("select public.responder_cierre_maquinaria('A',1,'2025-10-30','baja',array[7])");
 assert.equal((await db.query("select hasta::text h from maquinaria_periodos_costo where id=1")).rows[0].h,'2025-10-31');
 assert.equal((await db.query("select hasta from maquinaria_periodos_costo where id=2")).rows[0].hasta,null);
 assert.equal((await db.query("select hasta from maquinaria_periodos_costo where id=3")).rows[0].hasta,null);
 await assert.rejects(db.exec("select public.responder_cierre_maquinaria('A',1,'2025-10-30','mantener','{}')"),/respondida/);
 }finally{await db.close();}
});
