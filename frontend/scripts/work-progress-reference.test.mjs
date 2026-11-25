import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {inheritProgressPlan,resolveWorkDependencies} from '../src/utils/dependentProgress.js';
test('plan follows reference duration with different units, changes and chains',()=>{
 const parts=[{id:1,partida:'Pilas',cantidad:100,rendimiento_meta:20,duracion_programada:10},{id:2,partida:'Apoyo',cantidad:500,avance_depende_de:1,avance_referencia_propia:true,costo_por_dia:23},{id:3,cantidad:1,avance_depende_de:2}];
 const before=JSON.stringify(parts),plan=inheritProgressPlan(parts);
 assert.equal(plan[1].rendimiento,50);assert.equal(plan[1].duracion_programada,10);assert.equal(plan[2].rendimiento,.1);
 assert.equal(plan[1].costo_por_dia,23);assert.equal(JSON.stringify(parts),before);
 assert.equal(inheritProgressPlan([{...parts[0],duracion_programada:20},...parts.slice(1)])[1].rendimiento,25);
 assert.equal(resolveWorkDependencies(parts,[])[1].avance_depende_de,1);
});
test('work-local dependencies need no budget; protect scope, cycles, prices and history',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;
 create table presupuestos_items(id integer primary key,presupuesto_id integer,partida text,cantidad numeric,es_titulo boolean default false,tipo_item text default 'PARTIDA');
 create table partidas_obra(id integer primary key,presupuesto_item_id integer,obra_id integer,empresa text,obra_nombre text,partida text,unidad text,es_titulo boolean default false,cantidad_presupuestada numeric,costo_por_dia numeric);
 create table obra_presupuestos(presupuesto_id integer,empresa text,obra_nombre text);
 create table avances_produccion_partidas(id integer primary key,obra_id integer,empresa text,partida_id integer,partida text,cantidad numeric);
 insert into partidas_obra(id,obra_id,empresa,obra_nombre,partida,unidad,cantidad_presupuestada,costo_por_dia) values (1,1,'A','Obra A','Pilas','UND',100,20),(2,1,'A','Obra A','Apoyo','m2',500,33),(3,2,'A','Otra','Otra','UND',100,22),(4,1,'A','Obra A','Histórica','UND',5,20);
 insert into avances_produccion_partidas values (1,1,'A',1,'Pilas',40),(2,1,'A',4,'Histórica',2);`);
 await db.exec(await readFile(new URL('../../supabase/schema/budget-progress-dependency.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/schema/work-progress-reference.sql',import.meta.url),'utf8'));
 await db.exec('update partidas_obra set avance_referencia_propia=true,avance_depende_de=1 where id=2');
 await db.exec("insert into partidas_obra(id,obra_id,empresa,obra_nombre,partida,unidad,cantidad_presupuestada,avance_referencia_propia,avance_depende_de) values(5,1,'A','Obra A','Creada','GL',1,true,2)");
 await assert.rejects(db.exec('update partidas_obra set avance_referencia_propia=true,avance_depende_de=2 where id=1'),/circulares/);
 await assert.rejects(db.exec('update partidas_obra set avance_depende_de=3 where id=2'),/misma obra/);
 await assert.rejects(db.exec('update partidas_obra set cantidad_presupuestada=0 where id=1'),/positiva/);
 await assert.rejects(db.exec('update partidas_obra set avance_referencia_propia=true,avance_depende_de=1 where id=4'),/historial/);
 await assert.rejects(db.exec("insert into avances_produccion_partidas values(3,1,'A',2,'Apoyo',1)"),/automáticamente/);
 await assert.rejects(db.exec('delete from partidas_obra where id=1'),/foreign key/);
 assert.equal((await db.query('select costo_por_dia from partidas_obra where id=2')).rows[0].costo_por_dia,'33');
 assert.equal((await db.query('select count(*)::int n from avances_produccion_partidas')).rows[0].n,2);
 }finally{await db.close();}
});
