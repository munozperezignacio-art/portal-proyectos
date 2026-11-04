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
  // Isolated authorization/approval fixtures; never impersonates production users.
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table usuarios(auth_user_id uuid,empresa text,nombre text,rol text,rol_base text,obras text,permisos jsonb);
   create table roles(empresa text,nombre text,rol_base text,permisos jsonb);
   create function private.obraxis_actor_can_access_company(c text) returns boolean language sql stable security definer as $$select exists(select 1 from public.usuarios where auth_user_id=auth.uid() and empresa=c)$$;
   alter table obras add primary key(id);alter table maestro_personal add primary key(id);
   insert into usuarios values('10000000-0000-0000-0000-000000000001','A','Administradora','Administrador de Empresa','Administrador Empresa','todas','{}'),
    ('10000000-0000-0000-0000-000000000002','A','Contrato','Administrador de Contratos','Personalizado','Obra','{}'),
    ('10000000-0000-0000-0000-000000000003','A','Supervisor','Supervisor','Personalizado','todas','{"rrhh.imputaciones.editar":true,"rrhh.imputaciones.aprobar":true}');
   grant usage on schema auth,private to authenticated;
   grant select on all tables in schema public to authenticated;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261104144849_aprobar_imputaciones_partidas_personal.sql',import.meta.url),'utf8'));
  const asUser=async(id,query,params=[])=>db.transaction(async tx=>{await tx.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-00000000000${id}',true);`);return tx.query(query,params);});
  const call="select guardar_imputacion_personal_partidas('A',1,'D-2',$1,101,'[{\"partida_id\":1,\"porcentaje\":100}]','Ajuste de distribución revisado')";
  await assert.rejects(asUser(3,call,[0]),{code:'42501'});
  await asUser(1,call,[0]);
  let result=await get();assert.equal(result[1].obra_liquidaciones_partidas[0].monto_imputado,101);assert.equal(result[1].version_imputacion,1);
  assert.equal(result[1].historial_imputacion[0].responsable,'Administradora');
  await assert.rejects(asUser(1,call,[0]),/cargo cambió/);
  await asUser(2,call,[1]);assert.equal((await get())[1].historial_imputacion.length,2);
  await assert.rejects(asUser(1,"insert into rrhh_partidas_decisiones(empresa,obra_id,trabajador_id,fecha,distribucion,motivo,actualizado_por) values('A',1,1,'2026-10-21','[]','x',auth.uid())"),{code:'42501'});
  await assert.rejects(asUser(1,"select guardar_imputacion_personal_partidas('B',2,'D-2',0,101,'[]','Intento ajeno')"),{code:'42501'});
  await db.exec(`update usuarios set obras='Obra no autorizada' where nombre='Contrato'`);
  await assert.rejects(asUser(2,call,[2]),{code:'42501'});
  await db.exec(`update usuarios set permisos='{"rrhh.imputaciones.editar":false}' where nombre='Administradora'`);
  await assert.rejects(asUser(1,call,[2]),{code:'42501'});
  assert.equal((await get()).reduce((s,r)=>s+Number(r.monto_real),0),224,'approval never duplicates base costs');
 } finally {await db.close();}
});
