import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('daily budget weighting, crew boundaries, legacy names and exact reconciliation',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create table rrhh_costos_centros_aprobados(nomina_id bigint,nomina_item_id bigint,empresa text,centro_gestion_id int,dias_detalle jsonb,monto numeric);
   create table rrhh_nomina_items(id bigint,trabajador_id int,trabajador_nombre text);
   create table rrhh_nominas_mensuales(id bigint,periodo text,estado text);
   create table rrhh_imputaciones_diarias(id int,empresa text,trabajador_id int,fecha date,centro_aprobado_id int,costo_total numeric,costo_detalle jsonb,estado text);
   create table maestro_personal(id int,empresa text,nombre text);
   create table obra_liquidaciones(empresa text,trabajador_id int,periodo text,nomina_item_id bigint);
   create table obras(id int,empresa text,centro_gestion_id int,nombre text);
   create table partidas_obra(id int,empresa text,obra_id int,partida text,cantidad_presupuestada numeric,costo_por_dia numeric,es_titulo boolean,unidad text);
   create table avances_produccion_partidas(id int,empresa text,obra_id int,partida_id int,partida text,cantidad numeric,created_at timestamptz,cuadrilla_id bigint,cuadrilla_miembros jsonb);
   insert into maestro_personal values(1,'A','Ana'),(2,'A','Luis');
   insert into obras values(1,'A',1,'Obra'),(2,'B',2,'Otra empresa');
   insert into rrhh_imputaciones_diarias values(1,'A',1,'2026-10-21',1,101,'{}','Aprobada'),(2,'A',2,'2026-10-21',1,101,'{}','Aprobada');
   insert into partidas_obra values(1,'A',1,'Pilas',10,30,false,'UND'),(2,'A',1,'Logística',1,100,false,'GL');
   insert into avances_produccion_partidas values(1,'A',1,null,'Pilas',1,'2026-10-21 12:00+00',null,'[]'),(2,'A',1,2,'Logística',1,'2026-10-21 12:00+00',null,'[]'),(3,'A',1,null,'Pilas',2,'2026-10-21 12:00+00',null,'[]');
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261104143348_ponderar_personal_partidas_avanzadas.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261104144150_identificar_personal_sin_reporte_pendiente.sql',import.meta.url),'utf8'));
  const get=async()=> (await db.query('select * from rrhh_costos_personal_vigentes order by trabajador_id')).rows;
  let rows=await get();
  assert.equal(rows.length,2);
  for(const r of rows){assert.deepEqual(r.obra_liquidaciones_partidas.map(x=>x.monto_imputado),[75.75,25.25]);assert.equal(r.obra_liquidaciones_partidas[0].factor,0.75);}
  await db.exec(`update avances_produccion_partidas set cuadrilla_id=8,cuadrilla_miembros='["Ana"]' where id in (1,3)`);
  rows=await get();
  assert.equal(rows[0].obra_liquidaciones_partidas.length,2);
  assert.deepEqual(rows[1].obra_liquidaciones_partidas.map(x=>x.monto_imputado),[101]);
  await db.exec(`update avances_produccion_partidas set cuadrilla_id=9,cuadrilla_miembros='["Ana"]' where id=2`);
  assert.equal((await get())[1].obra_liquidaciones_partidas.length,0);
  await db.exec(`update partidas_obra set costo_por_dia=null where id=2`);
  assert.equal((await get())[0].obra_liquidaciones_partidas.length,0);
  await db.exec(`update partidas_obra set costo_por_dia=100 where id=2; update avances_produccion_partidas set created_at='2026-10-22 12:00+00'`);
  assert.equal((await get())[0].obra_liquidaciones_partidas.length,0);
  assert.equal((await get())[0].estado_imputacion_partidas,'Pendiente de aprobación: sin reporte de avance');
  await db.exec(`update avances_produccion_partidas set created_at='2026-10-21 12:00+00',cuadrilla_id=null; update avances_produccion_partidas set empresa='B' where id=2`);
  assert.deepEqual((await get())[0].obra_liquidaciones_partidas.map(x=>x.monto_imputado),[101]);
  await db.exec(`update avances_produccion_partidas set empresa='A'; insert into partidas_obra values(3,'A',1,'Pilas',1,1,false,'UND')`);
  assert.equal((await get())[0].obra_liquidaciones_partidas.length,0,'ambiguous legacy name cannot be guessed');
  await db.exec(`delete from partidas_obra where id=3; insert into rrhh_nomina_items values(5,1,'Ana'); insert into rrhh_nominas_mensuales values(5,'2026-10','Cerrada'); insert into rrhh_costos_centros_aprobados values(5,5,'A',1,'[{"fecha":"2026-10-21","monto":123}]',123)`);
  rows=await get();assert.equal(rows.length,2);assert.equal(Number(rows[0].monto_real),123);assert.equal(rows[0].obra_liquidaciones_partidas.reduce((s,x)=>s+x.monto_imputado,0),123);
  assert.deepEqual(await get(),rows,'re-reading never adds costs');
 } finally {await db.close();}
});
