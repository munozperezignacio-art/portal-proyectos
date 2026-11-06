import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('margin persists without defaults, checks limits, permissions and work scope',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.obraxis_actor_can_access_company(text) returns boolean language sql as $$select $1='A'$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select current_setting('test.configure',true)='yes'$$;
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $2=1$$;
 create table obras(id integer primary key,empresa text,nombre text);
 insert into obras values(1,'A','Obra'),(2,'A','Ajena');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261106013956_margen_presupuestado_obra.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select margen_presupuestado_pct from obras where id=1')).rows[0].margen_presupuestado_pct,null);
 await assert.rejects(db.exec('update obras set margen_presupuestado_pct=20 where id=1'),/Sin permiso/);
 await db.exec(`select set_config('test.uid','10000000-0000-0000-0000-000000000001',false);select set_config('test.configure','yes',false)`);
 for(const value of [0,20,99.99]){await db.query('update obras set margen_presupuestado_pct=$1 where id=1',[value]);assert.equal(Number((await db.query('select margen_presupuestado_pct from obras where id=1')).rows[0].margen_presupuestado_pct),value);}
 for(const value of [-1,100,'NaN','Infinity'])await assert.rejects(db.query('update obras set margen_presupuestado_pct=$1 where id=1',[value]));
 await assert.rejects(db.exec('update obras set margen_presupuestado_pct=20 where id=2'),/Sin permiso/);
 await db.exec(`select set_config('test.configure','no',false)`);
 await assert.rejects(db.exec('update obras set margen_presupuestado_pct=20 where id=1'),/Sin permiso/);
 await db.exec(`update obras set nombre='Nueva ficha' where id=1`);
 }finally{await db.close();}
});
