import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('database rejects cycles, cross-budget, zero quantity, manual writes and history conversion',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;
 create table presupuestos_items(id integer primary key,presupuesto_id integer,partida text,cantidad numeric,es_titulo boolean default false,tipo_item text default 'PARTIDA');
 create table partidas_obra(id integer primary key,presupuesto_item_id integer,obra_id integer,empresa text,obra_nombre text,partida text);
 create table obra_presupuestos(presupuesto_id integer,empresa text,obra_nombre text);
 create table avances_produccion_partidas(id integer primary key,obra_id integer,empresa text,partida_id integer,partida text,cantidad numeric);
 insert into presupuestos_items(id,presupuesto_id,partida,cantidad) values(1,1,'Pilas',100),(2,1,'Apoyo',250),(3,2,'Otra empresa',100),(4,1,'Histórica',10);
 insert into obra_presupuestos values(1,'A','Obra A');
 insert into partidas_obra values(10,null,1,'A','Obra A','Pilas'),(20,null,1,'A','Obra A','Apoyo'),(40,null,1,'A','Obra A','Histórica');
 insert into avances_produccion_partidas values(1,1,'A',10,'Pilas',40),(2,1,'A',40,'Histórica',2);`);
 await db.exec(await readFile(new URL('../../supabase/schema/budget-progress-dependency.sql',import.meta.url),'utf8'));
 await db.exec('update presupuestos_items set avance_depende_de=1 where id=2');
 await assert.rejects(db.exec('update presupuestos_items set avance_depende_de=2 where id=1'),/circulares/);
 await assert.rejects(db.exec('update presupuestos_items set avance_depende_de=3 where id=2'),/mismo presupuesto/);
 await assert.rejects(db.exec('update presupuestos_items set cantidad=0 where id=1'),/positiva/);
 await assert.rejects(db.exec('update presupuestos_items set avance_depende_de=1 where id=4'),/historial/);
 await assert.rejects(db.exec("insert into avances_produccion_partidas values(3,1,'A',20,'Apoyo',1)"),/automáticamente/);
 await assert.rejects(db.exec("insert into avances_produccion_partidas values(3,1,'A',null,'Apoyo',1)"),/automáticamente/);
 assert.equal((await db.query('select count(*)::int n from avances_produccion_partidas')).rows[0].n,2);
 }finally{await db.close();}
});
