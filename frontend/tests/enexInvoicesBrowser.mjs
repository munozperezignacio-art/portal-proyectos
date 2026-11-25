import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {database} from './enexInvoicesDatabase.test.mjs';
import * as XLSX from 'xlsx';
const origin=process.argv[2]||'http://127.0.0.1:4193';
const pdf='../../../.codex-attachments/4ddf8181-70e0-4153-bb87-326d4775e526/a6777490-f608-4327-9383-079178938a47/PdfApiCallViewTemp3.pdf';
const browser=await chromium.launch({headless:true});await mkdir('test-results/enex-invoices',{recursive:true});
try{for(const width of [1280,390]){
 const db=await database(),page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let issues=0,uploads=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname!=='/test-invoices')return route.continue();
  const q=JSON.parse(route.request().postData());let data,error=null;
  try{
   if(q.table){
    assert.ok(['enex_invoices','enex_invoice_drafts'].includes(q.table));
    data=(await db.query(`select * from ${q.table}`)).rows.filter(r=>q.filters.every(([k,v])=>r[k]===v));
    data=q.single?(data[0]||null):data.slice(q.start||0,(q.end??999)+1);
   }
   else if(q.upload){uploads++;await db.query("insert into storage.objects values('enex-invoices',$1,'00000000-0000-0000-0000-000000000001')",[q.upload]);data={path:q.upload};}
   else if(q.name==='preview_enex_invoice')data=(await db.query('select preview_enex_invoice($1) v',[q.args.p_invoice])).rows[0].v;
   else if(q.name==='save_enex_invoice_draft')data=(await db.query('select (save_enex_invoice_draft($1,$2,$3)).*',[q.args.p_id,q.args.p_invoice,q.args.p_revision])).rows[0];
   else {issues++;data=(await db.query('select (issue_enex_invoice($1,$2,$3)).*',[q.args.p_id,q.args.p_invoice,q.args.p_expected])).rows[0];}
  }catch(e){error={message:e.message};}await route.fulfill({contentType:'application/json',body:JSON.stringify({data,error})});
 });
 await page.goto(origin+'/e2e/fixtures/enex-invoices.html');await page.getByLabel('Factura PDF').setInputFiles(pdf);
 try{await page.getByLabel('N° factura').waitFor({timeout:15000});}catch(e){console.log(await page.locator('body').innerText(),errors);throw e;}await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
 assert.equal(await page.getByLabel('N° factura').inputValue(),'4161315');assert.equal(await page.getByLabel('Litros facturados',{exact:true}).inputValue(),'3.595');
 assert.equal((await page.getByLabel('Guías de despacho').inputValue()).split(/\s+/).length,28);
 // Actual supplied PDF parser, synthetic values/assignments only for local issuance.
 await page.getByLabel('Guías de despacho').fill('100 200');await page.getByLabel('Litros facturados',{exact:true}).fill('300');await page.getByLabel('Monto exento').fill('0');
 await db.exec("delete from enex_assignments where movement_id='00000000-0000-0000-0000-000000000200'");
 await page.getByRole('button',{name:'Guardar factura y cruzar'}).click();
 await page.locator('.enex-invoice-pending-card').getByText('1 de 2 movimientos con asignación válida',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Emitir los dos formularios'}).count(),0);assert.equal(uploads,1);assert.equal(issues,0);
 await page.reload();await page.locator('.enex-invoice-pending-card').getByText('1 de 2 movimientos con asignación válida',{exact:true}).waitFor();
 await page.screenshot({path:`test-results/enex-invoices/pending-${width}.png`,fullPage:true});
 await db.exec("insert into enex_assignments values('00000000-0000-0000-0000-000000000200','TEST',null,2)");
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.locator('.enex-invoice-pending-card').getByText('2 de 2 movimientos con asignación válida',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Abrir factura 4161315'}).click();await page.getByRole('checkbox',{name:/Revisé el PDF/}).waitFor();
 assert.equal(await page.getByLabel('Monto exento').inputValue(),'0');assert.equal(uploads,1);
 await page.getByRole('checkbox',{name:/Revisé el PDF/}).check();await page.getByRole('button',{name:'Emitir los dos formularios'}).click();
 await page.getByRole('button',{name:/Descargar consumo/}).waitFor();assert.equal(issues,1);assert.equal(uploads,1);
 for(const kind of ['consumo','cargo']){
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:kind==='consumo'?/Descargar consumo/:/Descargar formulario de cargo/}).click();
  const path=`test-results/enex-invoices/${kind}-${width}.xlsx`;await(await dl).saveAs(path);
  const wb=XLSX.read(await readFile(path),{type:'buffer'}),s=wb.Sheets[wb.SheetNames[0]];
  assert.equal(s[kind==='consumo'?'T29':'S23'].v,5811767);assert.ok(s[kind==='consumo'?'T29':'S23'].f);
  assert.equal(s[kind==='consumo'?'K29':'S20'].v,5387591);
 }
 await page.reload();await page.getByRole('button',{name:'Ver y descargar'}).click();await page.getByRole('button',{name:/Descargar consumo/}).waitFor();assert.equal(issues,1);
 if(width===1280){
  const record=(await db.query('select * from enex_invoices')).rows[0];
  record.reconciliation.groups=Array.from({length:10},()=>record.reconciliation.groups).flat();
  for(const kind of ['consumo','cargo']){
   const bytes=await page.evaluate(async({record,kind})=>{const {createEnexInvoiceForm}=await import('/src/utils/enexInvoiceForms.js');return Array.from(await createEnexInvoiceForm(record,kind,await(await fetch(`/templates/enex/${kind}.xlsx`)).arrayBuffer()));},{record,kind});
   const wb=XLSX.read(new Uint8Array(bytes),{type:'array'});assert.equal(wb.SheetNames.length,kind==='cargo'?3:2);
   assert.equal(wb.SheetNames.reduce((sum,n)=>sum+wb.Sheets[n][kind==='cargo'?'S23':'T29'].v,0),58117670);
  }
  console.log('PASS overflow: 20 groups, multiple complete form pages, no truncation or duplicated totals');
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 await page.screenshot({path:`test-results/enex-invoices/${width}.png`,fullPage:true});console.log(`PASS ${width}px: pending persisted 1/2, reload, automatic progress 2/2, reopen, single PDF upload, issue, two XLSX exact totals, no duplicate`);
 await page.close();await db.close();
}}finally{await browser.close();}
