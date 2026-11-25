import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {reconcileEnexInvoice} from '../src/utils/enexInvoiceReconciliation.js';
export const invoice={empresa:'TEST',portal:'transporte',document:'123',issuer_rut:'92011000-2',receiver_rut:'96725910-1',date:'2026-11-16',due_date:'2026-12-16',account:'2003',guides:['100','200'],liters_milli:300000,fuel_net:300000,shellcard_net:500,net:300500,vat:57095,specific_tax:-100,exempt:0,total:357495};
export async function database(includeDrafts=true){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('test.uid',true),''),'00000000-0000-0000-0000-000000000001')::uuid$$;
 create function private.enex_allowed(company text,action text) returns boolean language sql stable as $$select company='TEST' and coalesce(current_setting('test.denied',true),'')<>'yes'$$;
 grant usage on schema auth,private,storage to authenticated;grant execute on function auth.uid(),private.enex_allowed(text,text) to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;
 grant select,insert on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create table public.enex_movements(id uuid primary key,empresa text,portal text,document text,vehicle text,liters_milli bigint);
 create table public.enex_assignments(movement_id uuid primary key,empresa text,obra_id integer,centro_gestion_id integer);
 create table public.obras(id integer primary key,empresa text,centro_gestion_id integer);
 create table public.facturacion_centros_gestion(id integer primary key,empresa text,codigo text,nombre text,activo boolean);
 insert into public.enex_movements values('00000000-0000-0000-0000-000000000100','TEST','transporte','100','ABC',200000),('00000000-0000-0000-0000-000000000200','TEST','transporte','200','XYZ',100000);
 insert into public.enex_assignments values('00000000-0000-0000-0000-000000000100','TEST',null,1),('00000000-0000-0000-0000-000000000200','TEST',null,2);
 insert into public.facturacion_centros_gestion values(1,'TEST','001','Terreno',true),(2,'TEST','820','CAM Coquimbo',true);`);
 for(const file of ['enex-invoice-rules.sql','enex-invoices.sql',...(includeDrafts?['enex-invoice-drafts.sql']:[])])await db.exec(await readFile(new URL('../../supabase/schema/'+file,import.meta.url),'utf8'));
 return db;
}
if(process.argv[1]?.endsWith('enexInvoicesDatabase.test.mjs'))test('SQL reconciliation, immutable issuance, company isolation, duplicates and source preservation',async()=>{
 const db=await database();
 try{
 const before=(await db.query('select row_to_json(a) as v from enex_assignments a order by movement_id')).rows;
 const preview=async inv=>(await db.query('select public.preview_enex_invoice($1) as v',[inv])).rows[0].v;
 const result=await preview(invoice);assert.equal(result.ready,true);
 const movements=(await db.query('select m.*,row_to_json(a) as assignment from enex_movements m join enex_assignments a on a.movement_id=m.id')).rows;
 const centers=(await db.query('select * from facturacion_centros_gestion')).rows;
 const local=reconcileEnexInvoice({invoice,movements,centers});assert.deepEqual(result.rows,local.rows);
 for(const diff of [-20001,-20000,0,20000,20001])assert.equal((await preview({...invoice,liters_milli:300000+diff})).ready,Math.abs(diff)<=20000);
 assert.equal((await preview({...invoice,guides:['100','999']})).ready,false);
 await assert.rejects(preview({...invoice,guides:['100','100']}),/repetidas/);
 await assert.rejects(preview({...invoice,empresa:'OTHER'}),/Sin permiso/);
 const id='00000000-0000-0000-0000-000000000003';
 const issue=()=>db.query('select (public.issue_enex_invoice($1,$2,$3)).*',[id,invoice,result]);
 await assert.rejects(issue(),/PDF/);
 await db.exec(`insert into storage.objects values('enex-invoices','TEST/${id}/source.pdf','00000000-0000-0000-0000-000000000001')`);
 await db.exec('update enex_assignments set centro_gestion_id=2');
 await assert.rejects(issue(),/cambiaron/);
 await db.exec("update enex_assignments set centro_gestion_id=1 where movement_id='00000000-0000-0000-0000-000000000100'");
 await db.exec('set role authenticated');
 await issue();await issue();assert.equal((await db.query('select count(*)::int n from enex_invoices')).rows[0].n,1);
 await assert.rejects(db.query('update enex_invoices set document=\'999\''),/permission denied/);
 await assert.rejects(db.query('select public.issue_enex_invoice($1,$2,$3)',['00000000-0000-0000-0000-000000000004',invoice,result]),/ya fue emitida/);
 assert.equal((await preview({...invoice,document:'124'})).ready,false);
 await db.exec("set test.denied='yes'");assert.equal((await db.query('select * from enex_invoices')).rows.length,0);
 await assert.rejects(preview(invoice),/Sin permiso/);
 await db.exec('reset role');assert.deepEqual((await db.query('select row_to_json(a) as v from enex_assignments a order by movement_id')).rows,before);
 }finally{await db.close();}
});
