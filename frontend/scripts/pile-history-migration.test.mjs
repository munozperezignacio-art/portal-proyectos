import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {specialtyProgress} from '../src/utils/specialtyProgress.mjs';

test('historical migration: exact reconciliation, retries, tenant isolation and date cutoff', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create schema private; create schema auth; create role anon; create role authenticated;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table obras(id integer primary key,empresa text,nombre text);
   create table partidas_obra(id integer primary key,obra_id integer,empresa text,partida text,unidad text);
   create table avances_produccion_partidas(id serial primary key,empresa text,obra_id integer,obra_nombre text,supervisor text,partida_id integer,partida text,unidad text,cantidad numeric,observaciones text,created_at timestamptz);
   create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $1='EMINSG' and $2=32 and auth.uid()='00000000-0000-4000-8000-000000000001'::uuid$$;
   grant usage on schema public,auth to authenticated,anon;
   insert into obras values(32,'EMINSG','IP-EDIFICO L LONCO'),(33,'OTHER','Other');
   insert into partidas_obra values(160,32,'EMINSG','Pilas de Grava IMPACT','UND'),(161,32,'EMINSG','Pilas de grava adiconales EJE T','UND');`);
  await db.exec(await readFile(new URL('../../supabase/schema/specialty-progress.sql',import.meta.url),'utf8'));
  const source={sha256:'a'.repeat(64),source:'test.xlsx',catalog:[1,2,3].map(n=>({etapa:'Etapa 1',numero:String(n),norte:n,este:n,longitud_diseno:6})),history:[1,2,3].map(n=>({etapa:'Etapa 1',numero:String(n),fecha:n<3?'2026-01-01':'2026-01-02',paladas:4,volumen:1,longitud:6}))};
  await db.exec("insert into avances_produccion_partidas(empresa,obra_id,partida_id,partida,cantidad,created_at) values('EMINSG',32,160,'Pilas de Grava IMPACT',2,'2026-01-01T15:00:00Z')");
  const run=async(s=source)=>(await db.query('select private.import_pile_history($1,$2,$3,$4,$5) r',[32,'EMINSG','IP-EDIFICO L LONCO',JSON.stringify({'Etapa 1':160}),JSON.stringify(s)])).rows[0].r;
  assert.equal((await run()).new_reports,1);
  assert.equal((await run()).new_reports_this_call,0);
  assert.equal((await db.query('select sum(cantidad)::int n from avances_produccion_partidas')).rows[0].n,3);
  await assert.rejects(run({...source,history:source.history.slice(1)}),/otros datos/);
  await assert.rejects(run({...source,sha256:'b'.repeat(64),catalog:source.catalog.map(e=>({...e,este:99}))}),/difieren/);
  await assert.rejects(db.exec('update avances_produccion_partidas set cantidad=4'),/conciliado/);
  await db.exec("set test.uid='00000000-0000-4000-8000-000000000001';set role authenticated;");
  const state=(await db.query('select public.specialty_progress_state(32) s')).rows[0].s;
  assert.equal(specialtyProgress(state,[160],'2026-01-01').filter(p=>p.status==='done').length,2);
  assert.equal(specialtyProgress(state,[160],'2026-01-02').filter(p=>p.status==='done').length,3);
  await assert.rejects(db.exec('select public.specialty_progress_state(33)'),/No autorizado/);
  await assert.rejects(db.exec('select * from private.specialty_elements'),/permission denied/);
  await assert.rejects(run(),/permission denied/);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.exec('select public.specialty_progress_state(32)'),/permission denied/);
  if(process.env.PILE_FIXTURE){
   await db.exec('reset role;truncate private.specialty_elements,private.specialty_sessions,private.specialty_settings,private.specialty_history_imports,public.avances_produccion_partidas cascade;');
   const {source:real,baseline}=JSON.parse(await readFile(process.env.PILE_FIXTURE,'utf8'));
   for(const r of baseline.reports)await db.query('insert into avances_produccion_partidas(id,empresa,obra_id,partida_id,partida,cantidad,created_at) values($1,$2,32,$3,$4,$5,$6)',[r.id,'EMINSG',r.partida_id,baseline.parts.find(p=>p.id===r.partida_id).partida,r.cantidad,`${r.fecha}T15:00:00Z`]);
   await db.exec("select setval('avances_produccion_partidas_id_seq',(select max(id) from avances_produccion_partidas))");
   const importReal=async()=>(await db.query('select private.import_pile_history(32,$1,$2,$3,$4) r',['EMINSG','IP-EDIFICO L LONCO',JSON.stringify({'Etapa 1':160,'Etapa 2':161}),JSON.stringify(real)])).rows[0].r;
   assert.equal((await importReal()).new_reports,1);
   assert.equal((await importReal()).new_reports_this_call,0);
   assert.equal((await db.query('select sum(cantidad)::int n from avances_produccion_partidas where partida_id in (160,161)')).rows[0].n,381);
   const realState=(await db.query('select public.specialty_progress_state(32) s')).rows[0].s;
   assert.equal(realState.elements.length,483);
   assert.equal(specialtyProgress(realState,[160,161],'2026-11-06').filter(p=>p.status==='done').length,381);
   assert.equal(specialtyProgress(realState,[160,161],'2026-11-05').filter(p=>p.status==='done').length,361);
  }
 } finally {await db.close();}
});

test('real LONCO fixture: 483 catalog, 381 historical, only one missing report', {skip:!process.env.PILE_FIXTURE}, async () => {
 const {source,baseline}=JSON.parse(await readFile(process.env.PILE_FIXTURE,'utf8'));
 const totals=new Map();for(const p of source.history){const key=`${p.fecha}:${p.etapa==='Etapa 1'?160:161}`;totals.set(key,(totals.get(key)||0)+1);}
 const missing=[];for(const [key,qty] of totals){const [day,id]=key.split(':');const reports=baseline.reports.filter(r=>r.fecha===day&&r.partida_id===Number(id));if(!reports.length)missing.push({day,qty});else assert.equal(reports.reduce((s,r)=>s+Number(r.cantidad),0),qty);}
 assert.equal(source.catalog.length,483);assert.equal(source.history.length,381);assert.deepEqual(missing,[{day:'2026-11-06',qty:20}]);
});
