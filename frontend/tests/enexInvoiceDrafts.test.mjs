import test from 'node:test';
import assert from 'node:assert/strict';
import {database,invoice} from './enexInvoicesDatabase.test.mjs';
import {invoiceProgress,invoiceDraftFields} from '../src/utils/enexInvoiceProgress.js';
import {parseInvoicePeso,parseInvoiceLiters} from '../src/utils/enexInvoicePdf.js';
import {readFile} from 'node:fs/promises';

test('Production migration applies atomically to existing invoice schema',async()=>{
 const db=await database(false);
 try{
  await db.exec(await readFile(new URL('../../supabase/migrations/20261125210554_enex_invoice_pending_workflow.sql',import.meta.url),'utf8'));
  assert.equal((await db.query("select has_table_privilege('authenticated','public.enex_invoice_drafts','UPDATE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('anon','public.save_enex_invoice_draft(uuid,jsonb,integer)','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query('select count(*)::int n from enex_assignments')).rows[0].n,2);
 }finally{await db.close();}
});

test('Progress distinguishes unassigned, missing, incompatible and non-guide blockers',()=>{
 const inv={guides:['1','2','3','4','5']};
 assert.deepEqual(invoiceProgress(inv,{problems:[{document:'2',message:'Movimiento pendiente de asignación'},{document:'3',message:'Guía sin movimiento'},{document:'4',message:'Centro no disponible'}]}),{total:5,assigned:2,pending:1,missing:1,other:1});
 assert.equal(invoiceProgress(inv,null).assigned,null);
 assert.equal(invoiceProgress(inv,{ready:false,problems:[{message:'Desfase superior a ±20 litros'}]}).assigned,5);
 const draft=invoiceDraftFields(invoice);assert.equal(parseInvoiceLiters(draft.liters),invoice.liters_milli);assert.equal(parseInvoicePeso(draft.specific_tax),invoice.specific_tax);
});

test('Pending invoice survives sessions, updates progress, protects revisions, and issues once without another upload',async()=>{
 const db=await database();
 try{
  const id='00000000-0000-0000-0000-000000000003',other='00000000-0000-0000-0000-000000000004';
  const preview=async inv=>(await db.query('select public.preview_enex_invoice($1) v',[inv])).rows[0].v;
  const save=async(inv=invoice,rev=0,key=id)=>(await db.query('select (public.save_enex_invoice_draft($1,$2,$3)).*',[key,inv,rev])).rows[0];
  await db.exec("delete from enex_assignments where movement_id='00000000-0000-0000-0000-000000000200'");
  const before=(await db.query('select row_to_json(a) v from enex_assignments a order by movement_id')).rows;
  await assert.rejects(save(),/PDF original/);
  await db.exec(`insert into storage.objects values('enex-invoices','TEST/${id}/source.pdf','00000000-0000-0000-0000-000000000001')`);
  await db.exec('set role authenticated');
  assert.equal((await save()).revision,1);assert.equal((await save()).revision,1);
  assert.equal((await db.query('select count(*)::int n from enex_invoice_drafts')).rows[0].n,1);
  const partial=await preview(invoice);assert.equal(invoiceProgress(invoice,partial).assigned,1);
  await assert.rejects(db.query('select public.issue_enex_invoice($1,$2,$3)',[id,invoice,partial]),/pendientes/);
  await assert.rejects(save(invoice,0,other),/ya está guardada/);
  await assert.rejects(db.query("update enex_invoice_drafts set invoice='{}'"),/permission denied/);
  await assert.rejects(db.query('delete from enex_invoice_drafts'),/permission denied/);
  await assert.rejects(save({...invoice,empresa:'OTHER'}),/Sin permiso/);
  await assert.rejects(save({...invoice,document:'999'},1),/identidad/);
  const revised={...invoice,account:'2004'};assert.equal((await save(revised,1)).revision,2);
  await assert.rejects(save({...revised,account:'2005'},1),/otro usuario/);
  assert.equal((await save(revised,1)).revision,2); // lost save response: idempotent same payload
  await db.exec("set test.denied='yes'");assert.equal((await db.query('select * from enex_invoice_drafts')).rows.length,0);await assert.rejects(save(revised,2),/Sin permiso/);
  await db.exec("reset test.denied;reset role;set role anon");await assert.rejects(save(),/permission denied/);await db.exec('reset role');
  assert.deepEqual((await db.query('select row_to_json(a) v from enex_assignments a order by movement_id')).rows,before);
  assert.equal((await db.query('select count(*)::int n from enex_invoices')).rows[0].n,0);
  // Normal assignment workflow happens independently of the invoice.
  await db.exec("insert into enex_assignments values('00000000-0000-0000-0000-000000000200','TEST',null,2)");
  const ready=await preview(revised);assert.equal(ready.ready,true);assert.equal(invoiceProgress(revised,ready).assigned,2);
  await db.exec("set test.uid='00000000-0000-0000-0000-000000000002';set role authenticated");
  assert.equal((await db.query('select invoice from enex_invoice_drafts where id=$1',[id])).rows[0].invoice.account,'2004');
  await assert.rejects(db.query('select public.issue_enex_invoice($1,$2,$3)',[id,invoice,ready]),/pendiente cambió/);
  await assert.rejects(db.query('select public.issue_enex_invoice($1,$2,$3)',[other,revised,ready]),/Facturas pendientes/);
  await db.query('select public.issue_enex_invoice($1,$2,$3)',[id,revised,ready]);
  await db.query('select public.issue_enex_invoice($1,$2,$3)',[id,revised,ready]);
  assert.equal((await db.query('select count(*)::int n from enex_invoice_drafts where emitted_at is null')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from enex_invoices')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from enex_invoice_guides')).rows[0].n,2);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 }finally{await db.close();}
});
