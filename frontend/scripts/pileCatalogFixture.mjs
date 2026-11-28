import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
export async function catalogFixture(){
 const db=new PGlite();
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table obras(id integer primary key,empresa text,nombre text);
 create table usuarios(id integer,auth_user_id uuid,empresa text,nombre text,usuario text,rol text,rol_base text,obras text);
 create table partidas_obra(id integer primary key,obra_id integer,empresa text,partida text,unidad text,es_titulo boolean);
 create table notificaciones_reglas(id uuid,empresa text,activa boolean,evento_codigo text,hora_envio time,canal_push boolean,condiciones jsonb,obra_nombre text);
 create table avances_produccion_partidas(id serial primary key,empresa text,obra_id integer,obra_nombre text,supervisor text,partida_id integer,partida text,unidad text,cantidad numeric,observaciones text,created_at timestamptz);
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $2=1$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select current_setting('test.permissions',true)='all' or current_setting('test.permissions',true)=$2$$;
 create function private.work_front_names(integer) returns table(nombre text) language sql as $$select unnest(array['TORRE A','TORRE B','Frente Principal'])$$;
 insert into obras values(1,'TEST','Obra de prueba'),(2,'OTHER','Otra');
 insert into partidas_obra values(1,1,'TEST','Pilas','UND',false),(2,2,'OTHER','Pilas','UND',false);
 set test.uid='00000000-0000-4000-8000-000000000001';set test.permissions='all';`);
 await db.exec(await readFile(new URL('../../supabase/schema/specialty-reporting.sql',import.meta.url),'utf8'));
 await db.exec("alter table private.specialty_elements add column frente text;insert into private.specialty_settings(obra_id,partida_id,activa_desde) values(1,1,'2026-01-01'),(2,2,'2026-01-01');");
 await db.exec(await readFile(new URL('../../supabase/schema/specialty-catalog-revisions.sql',import.meta.url),'utf8'));
 return db;
}
