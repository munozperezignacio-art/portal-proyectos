import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pileDesign,revisionRows} from '../src/utils/pileCatalogRevision.js';
import {catalogFixture} from './pileCatalogFixture.mjs';
test('catalog revisions are authorized, atomic, idempotent and preserve existing history',async()=>{
 const db=await catalogFixture();
 const call=async(action,data={},work=1)=>(await db.query('select public.specialty_catalog_api($1,$2,$3) r',[work,action,JSON.stringify({partida_id:1,...data})])).rows[0].r;
 const payload=rows=>({rows,plano:'Rev F',fecha:'2026-11-28',motivo:'Actualización de plano',request_id:crypto.randomUUID()});
 const row={numero:'1',etapa:'General',norte:5923799.64,este:678626.48,frente:'TORRE A',longitud_diseno:10,antes:null};
 try{
  const first=payload([row]);assert.deepEqual(await call('create',first),{added:1,updated:0});assert.deepEqual(await call('create',first),{added:1,updated:0});
  await assert.rejects(call('create',payload([row])),/ya existe/);
  const el=(await db.query('select * from private.specialty_elements')).rows[0];
  await db.query("insert into private.specialty_sessions(id,obra_id,partida_id,fecha,responsable,estado,datos) values('10000000-0000-4000-8000-000000000001',1,1,'2026-11-01',auth.uid(),'cerrada',$1)",[JSON.stringify({pilas:[{element_id:el.id,terminada:true}]})]);
  await db.exec(`update private.specialty_elements set sesion_id='10000000-0000-4000-8000-000000000001',topografia='{"cota_inicial":99}' where numero='1';insert into avances_produccion_partidas(obra_id,cantidad) values(1,1);
   insert into private.specialty_protocols(id,obra_id,sesion_id,tipo,fecha,correlativo,estado,snapshot,autor) values('20000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000001','ejecucion','2026-11-01','1','aprobado','{"immutable":true}',auth.uid());`);
  const snapshot=async()=>(await db.query("select (select jsonb_agg(to_jsonb(t)) from private.specialty_sessions t) sessions,(select jsonb_agg(to_jsonb(t)) from private.specialty_protocols t) protocols,(select jsonb_agg(to_jsonb(t)) from avances_produccion_partidas t) reports")).rows;
  const before=await snapshot();const edit={...pileDesign(el),norte:5923800,antes:pileDesign(el)};
  assert.deepEqual(await call('edit',payload([edit])),{added:0,updated:1});
  await assert.rejects(call('edit',payload([edit])),/cambió/);
  const latest=(await db.query('select * from private.specialty_elements where id=$1',[el.id])).rows[0];
  await assert.rejects(call('edit',payload([{...pileDesign(latest),frente:'TORRE B',antes:pileDesign(latest)}])),/vinculada/);
  const imported=payload([{...row,numero:'2'},{...pileDesign(latest),este:100,antes:pileDesign(latest)}]);
  assert.deepEqual(await call('import',imported),{added:1,updated:1});
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual((await db.query('select topografia from private.specialty_elements where id=$1',[el.id])).rows[0].topografia,{cota_inicial:99});
  assert.equal((await call('state')).history.length,4);
  await assert.rejects(call('import',payload([{...row,numero:'3'},{...row,numero:'4',norte:'NaN'}])),/inválidas/);
  assert.equal((await db.query('select count(*)::int n from private.specialty_elements')).rows[0].n,2,'failed batch rolls back; absent pile preserved');
  await db.exec("set test.permissions='none'");await assert.rejects(call('edit',payload([edit])),/permiso/);await assert.rejects(call('import',imported),/permiso/);
  await assert.rejects(call('state',{},2),/No autorizado/);await assert.rejects(call('state',{partida_id:2}),/Partida no configurada/);
  await db.exec("set test.permissions='obras.especialidad.crear'");assert.deepEqual(await call('create',payload([{...row,numero:'5'}])),{added:1,updated:0});await assert.rejects(call('edit',payload([edit])),/permiso/);
  await db.exec("set test.uid=''");await assert.rejects(call('state'),/No autorizado/);
 }finally{await db.close();}
});
test('Excel revision preserves omitted design fields and matches stage plus number',()=>{
 const el={id:'a',numero:'1',etapa:'General',norte:1,este:2,frente:'TORRE A',longitud_diseno:10};
 const rows=revisionRows({catalog:[{numero:'1',etapa:'',frente:'',norte:3,este:4}],columns:{longitud_diseno:-1}},[el],'General','');
 assert.equal(rows[0].frente,'TORRE A');assert.equal(rows[0].longitud_diseno,10);assert.deepEqual(rows[0].antes,pileDesign(el));
});
