import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('station migration, import, duplicate protection and owner-only mobile reads',async()=>{
 const db=new PGlite();
 await db.exec(`
 create role authenticated; create role service_role; create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.enex_allowed(text,text) returns boolean language sql as $$select true$$;
 create table public.enex_movements(id uuid primary key default gen_random_uuid(),empresa text,portal text,document text,occurred_local timestamp,vehicle text,kind text,liters_milli bigint,amount_signed bigint,actor uuid,import_source text,unique(empresa,portal,document));
 create table public.enex_automation_runs(id uuid,evidence jsonb,payload jsonb,new_ids uuid[],repeated int,status text);
 create table public.enex_import_receipts(empresa text,actor uuid,received int,inserted int,repeated int,import_source text);
 create table public.usuarios(empresa text,correo text,auth_user_id uuid);
 create table public.facturacion_centros_gestion(id int,nombre text,codigo text,empresa text,activo bool);
 create table private.enex_pending_owned(id uuid,vehicle text,portal text,document text,occurred_local timestamp,amount_signed bigint,empresa text,owner_id uuid);
 `);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261117180000_enex_stations.sql',import.meta.url),'utf8'));
 const uid='00000000-0000-0000-0000-000000000001';
 await db.query("select set_config('test.uid',$1,false)",[uid]);
 const row={portal:'empresa',document:'123',occurred_local:'2026-11-17 08:00:00',vehicle:'TEST',kind:'Carga',liters_milli:10000,amount_signed:-15000,station:'Estación prueba',station_commune:'Comuna prueba'};
 const invoke=rows=>db.query('select public.import_enex_movements($1,$2::jsonb) result',['TEST',JSON.stringify(rows)]);
 assert.equal((await invoke([row])).rows[0].result.inserted,1);
 assert.equal((await invoke([row])).rows[0].result.repeated,1);
 await assert.rejects(invoke([{...row,station:'Otra'}]),/Conflicting/);
 assert.equal((await db.query('select station from enex_movements')).rows[0].station,row.station);
 await db.query('insert into private.enex_pending_owned select id,vehicle,portal,document,occurred_local,amount_signed,empresa,$1::uuid from enex_movements',[uid]);
 const own=(await db.query("select enex_my_pending('TEST') result")).rows[0].result;
 assert.equal(own.rows[0].station,row.station);assert.equal(own.rows[0].station_commune,row.station_commune);
 await db.query("select set_config('test.uid',$1,false)",['00000000-0000-0000-0000-000000000002']);
 assert.deepEqual((await db.query("select enex_my_pending('TEST') result")).rows[0].result.rows,[]);
 await db.query('insert into usuarios values ($1,$2,$3)',['EMINSG','imunozp@eminsg.cl',uid]);
 const result=await db.query('select enex_import_server($1,$2::jsonb,$3::jsonb) result',[uid,JSON.stringify([row]),JSON.stringify({company:'EMIN SISTEMAS GEOTECNICOS S.A.',portal:'empresa',from:'2026-11-17',through:'2026-11-17',all_pages_checked:true})]);
 assert.equal(result.rows[0].result.new_ids.length,1);
 assert.equal((await db.query("select station from enex_movements where empresa='EMINSG'")).rows[0].station,row.station);
 await db.close();
});

