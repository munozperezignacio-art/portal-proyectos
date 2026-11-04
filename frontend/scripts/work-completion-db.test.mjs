import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('completion follows full physical scope, audits once, preserves dates and costs',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema private;
 create table obras(id integer primary key,empresa text,nombre text,fecha_termino_real date);
 create table partidas_obra(id integer primary key,empresa text,obra_id integer,obra_nombre text,partida text,unidad text,tipo_item text,es_titulo boolean,cantidad_presupuestada numeric);
 create table avances_produccion_partidas(id integer primary key,empresa text,obra_id integer,obra_nombre text,partida_id integer,partida text,cantidad numeric,created_at timestamptz);
 create table bitacora_eventos_obra(empresa text,obra_nombre text,categoria text constraint bitacora_eventos_obra_categoria_check check(categoria in ('Estados de Pago','Calidad','Prevención')),accion text,detalle text,actor text,fecha date);
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select true$$;
 insert into obras(id,empresa,nombre) values(1,'A','Obra'),(2,'B','Obra');
 insert into partidas_obra values(1,'A',1,'Obra','Pilas','UND',null,false,100),(2,'A',1,'Obra','Logistica','GL',null,false,1),(3,'A',1,'Obra','Titulo','TITULO',null,true,0);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261104172729_termino_automatico_obra.sql',import.meta.url),'utf8'));
 const state=async()=>(await db.query("select * from obra_termino_trabajos where obra_id=1")).rows[0];
 await db.exec(`insert into avances_produccion_partidas values(1,'A',1,'Obra',1,'Pilas',99.999,'2026-01-01T12:00Z'),(2,'A',1,'Obra',2,'Logistica',1,'2026-01-01T12:00Z'),(3,'B',2,'Obra',1,'Pilas',999,'2026-01-01T12:00Z')`);
 assert.equal((await state()).estado,'en_curso');
 await db.exec(`insert into avances_produccion_partidas values(4,'A',1,'Obra',1,'Pilas',0.001,'2026-01-02T02:00Z')`);
 assert.equal((await state()).estado,'completada');
 await db.exec("update obras set fecha_termino_real='2020-01-01' where id=1");
 assert.equal((await db.query('select fecha_termino_real from obras where id=1')).rows[0].fecha_termino_real.toISOString().slice(0,10),'2026-01-01');
 assert.equal((await state()).fecha_termino.toISOString().slice(0,10),'2026-01-01'); // Chile, not UTC.
 assert.equal((await db.query('select * from bitacora_eventos_obra')).rows.length,1);
 await db.exec(`update avances_produccion_partidas set cantidad=cantidad where id=4`);
 assert.equal((await db.query('select * from bitacora_eventos_obra')).rows.length,1);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.exec("update obra_termino_trabajos set fecha_termino='2020-01-01'");}),{code:'42501'});
 await db.exec(`delete from avances_produccion_partidas where id=4`);
 assert.equal((await state()).estado,'revisar');
 assert.equal((await state()).fecha_termino.toISOString().slice(0,10),'2026-01-01');
 assert.equal((await state()).fecha_calculada,null);
 assert.equal((await db.query('select * from bitacora_eventos_obra')).rows.length,2);
 // Empty scopes and zero quantities must never certify 100%.
 assert.equal((await db.query('select estado from obra_termino_trabajos where obra_id=2')).rows[0].estado,'en_curso');
 await db.exec(`insert into partidas_obra values(4,'B',2,'Obra','Cero','UND',null,false,0)`);
 assert.equal((await db.query('select estado from obra_termino_trabajos where obra_id=2')).rows[0].estado,'en_curso');
 } finally {await db.close();}
});
