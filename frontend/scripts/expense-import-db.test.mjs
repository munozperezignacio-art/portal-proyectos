import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('expense keys are unique per company and category mappings are protected',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table costos_reales_obra(id serial primary key,empresa text);
 create table usuarios(auth_user_id uuid,empresa text);create table obras(id integer,empresa text);
 create function private.rrhh_partidas_permiso(c text,w integer,a text) returns boolean language sql as $$select c='A' and auth.uid()='10000000-0000-0000-0000-000000000001'::uuid$$;
 insert into usuarios values('10000000-0000-0000-0000-000000000001','A');insert into obras values(1,'A'),(2,'B');
 grant usage on schema auth,private to authenticated;grant select on usuarios,obras to authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261104180303_rendiciones_iconstruye.sql',import.meta.url),'utf8'));
 await db.exec("insert into costos_reales_obra(empresa,importacion_clave) values('A','same'),('B','same')");
 await assert.rejects(db.exec("insert into costos_reales_obra(empresa,importacion_clave) values('A','same')"),{code:'23505'});
 const run=q=>db.transaction(async tx=>{await tx.exec("set local role authenticated;select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true)");return tx.exec(q);});
 await run(`insert into iconstruye_homologacion_gastos values('A','combustible','Combustible')`);
 await assert.rejects(run(`insert into iconstruye_homologacion_gastos values('B','combustible','Combustible')`),{code:'42501'});
 await assert.rejects(run(`update iconstruye_homologacion_gastos set empresa='B'`),{code:'42501'});
 await assert.rejects(run(`insert into iconstruye_homologacion_gastos values('A','bad','Desconocida')`),{code:'23514'});
 }finally{await db.close();}
});
