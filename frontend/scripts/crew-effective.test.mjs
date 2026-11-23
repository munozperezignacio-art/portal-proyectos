import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('reasons, retrospective crew membership, dates, authorization and unchanged report/cost',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./crew-effective-fixture.sql',import.meta.url),'utf8'));
  await db.exec(`insert into obras(id,empresa,nombre,centro_gestion_id) values(32,'TEST','Lonco',1);
   insert into obra_cuadrillas(id,empresa,obra_id,nombre,miembros) values(4,'TEST',32,'IMPACT','["Gerardo"]');
   insert into maestro_personal(id,empresa,nombre) values(1,'TEST','Gerardo'),(2,'TEST','Franco'),(3,'TEST','Leonel'),(4,'TEST','Boris'),(5,'TEST','Edgardo'),(6,'TEST','Sebastian');
   insert into partidas_obra(id,empresa,obra_id,partida,unidad,cantidad_presupuestada,costo_por_dia) values(160,'TEST',32,'Pilas','UND',100,1000);
   insert into avances_produccion_partidas(id,empresa,obra_id,partida_id,partida,cantidad,created_at,cuadrilla_id,cuadrilla_miembros) values(123,'TEST',32,160,'Pilas',5,'2020-11-13 12:00:00+00',4,'["Gerardo"]');
   insert into rrhh_imputaciones_diarias(id,empresa,trabajador_id,fecha,centro_aprobado_id,estado,costo_total) select id,'TEST',id,'2020-11-13',1,'Aprobada',10000 from maestro_personal;`);
  // Needed only because the production migration replaces an existing view.
  await db.exec(await readFile(new URL('../../supabase/schema/crew-effective-members.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./crew-effective-manual-view.sql',import.meta.url),'utf8'));
  await db.exec(`insert into rrhh_partidas_decisiones(empresa,obra_id,trabajador_id,fecha,version,distribucion) values('TEST',32,2,'2020-11-13',1,'[{"partida_id":999,"partida":"Manual","porcentaje":100}]');`);
  const before=(await db.query('select * from avances_produccion_partidas')).rows;
  const states=await db.query('select trabajador,estado_imputacion_partidas from rrhh_costos_personal_automaticos');
  assert.equal(states.rows.filter(r=>r.estado_imputacion_partidas==='No incluido en la cuadrilla del reporte').length,5);
  assert.equal(states.rows.find(r=>r.trabajador==='Gerardo').estado_imputacion_partidas,'Distribuida');
  const save=`select guardar_cuadrilla_vigencia('TEST',32,4,0,'IMPACT','','General','["Gerardo","Franco","Leonel","Boris","Edgardo","Sebastian"]','2020-11-13','Prueba retroactiva')`;
  await db.exec("set test.deny='yes'");await assert.rejects(db.exec(save),/permiso/);await db.exec("set test.deny='no'");
  await db.exec(save);
  const after=(await db.query('select * from rrhh_costos_personal_automaticos')).rows;
  assert.equal(after.filter(r=>r.estado_imputacion_partidas==='Distribuida').length,6);
  assert.equal(after.reduce((s,r)=>s+Number(r.monto_real),0),60000);
  const manual=(await db.query('select * from rrhh_costos_personal_vigentes where trabajador_id=2')).rows[0];
  assert.equal(manual.estado_imputacion_partidas,'Aprobada manualmente');
  assert.equal(manual.obra_liquidaciones_partidas[0].partida_id,999);
  assert.deepEqual((await db.query('select * from avances_produccion_partidas')).rows,before);
  assert.deepEqual((await db.query(`select cuadrilla_integrantes_vigentes('TEST',32,4,'2020-11-12','["Original"]') m`)).rows[0].m,['Original']);
  assert.deepEqual((await db.query(`select cuadrilla_integrantes_vigentes('OTHER',32,4,'2020-11-13','["Original"]') m`)).rows[0].m,['Original']);
  assert.deepEqual((await db.query(`select cuadrilla_integrantes_vigentes('TEST',32,5,'2020-11-13','["Original"]') m`)).rows[0].m,['Original']);
  await assert.rejects(db.exec(save),/cambió/);
  assert.equal((await db.query('select count(*)::int n from obra_cuadrillas')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from obra_cuadrilla_vigencias')).rows[0].n,1);
 }finally{await db.close();}
});
