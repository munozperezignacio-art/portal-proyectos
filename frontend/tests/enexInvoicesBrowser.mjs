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
 let issues=0;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname!=='/test-invoices')return route.continue();
  const q=JSON.parse(route.request().postData());let data,error=null;
  try{
   if(q.table)data=(await db.query('select * from enex_invoices order by issued_at desc')).rows;
   else if(q.upload){await db.query("insert into storage.objects values('enex-invoices',$1,'00000000-0000-0000-0000-000000000001')",[q.upload]);data={path:q.upload};}
   else if(q.name==='preview_enex_invoice')data=(await db.query('select preview_enex_invoice($1) v',[q.args.p_invoice])).rows[0].v;
   else {issues++;data=(await db.query('select (issue_enex_invoice($1,$2,$3)).*',[q.args.p_id,q.args.p_invoice,q.args.p_expected])).rows[0];}
  }catch(e){error={message:e.message};}await route.fulfill({contentType:'application/json',body:JSON.stringify({data,error})});
 });
 await page.goto(origin+'/e2e/fixtures/enex-invoices.html');await page.getByLabel('Factura PDF').setInputFiles(pdf);
 try{await page.getByLabel('N° factura').waitFor({timeout:15000});}catch(e){console.log(await page.locator('body').innerText(),errors);throw e;}await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
 assert.equal(await page.getByLabel('N° factura').inputValue(),'4161315');assert.equal(await page.getByLabel('Litros facturados',{exact:true}).inputValue(),'3.595');
 assert.equal((await page.getByLabel('Guías de despacho').inputValue()).split(/\s+/).length,28);
 // Actual supplied PDF parser, synthetic values/assignments only for local issuance.
 await page.getByLabel('Guías de despacho').fill('100 200');await page.getByLabel('Litros facturados',{exact:true}).fill('300');await page.getByLabel('Monto exento').fill('0');
 await page.getByRole('button',{name:'Cruzar guías y asignaciones'}).click();await page.getByRole('checkbox',{name:/Revisé el PDF/}).waitFor();
 await page.getByRole('checkbox',{name:/Revisé el PDF/}).check();await page.getByRole('button',{name:'Emitir los dos formularios'}).click();
 await page.getByRole('button',{name:/Descargar consumo/}).waitFor();assert.equal(issues,1);
 for(const kind of ['consumo','cargo']){
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:kind==='consumo'?/Descargar consumo/:/Descargar formulario de cargo/}).click();
  const path=`test-results/enex-invoices/${kind}-${width}.xlsx`;await(await dl).saveAs(path);
  const wb=XLSX.read(await readFile(path),{type:'buffer'}),s=wb.Sheets[wb.SheetNames[0]];
  assert.equal(s[kind==='consumo'?'T29':'S23'].v,5811767);assert.ok(s[kind==='consumo'?'T29':'S23'].f);
  assert.equal(s[kind==='consumo'?'K29':'S20'].v,5387591);
 }
 await page.reload();await page.getByRole('button',{name:'Ver y descargar'}).click();await page.getByRole('button',{name:/Descargar consumo/}).waitFor();assert.equal(issues,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 await page.screenshot({path:`test-results/enex-invoices/${width}.png`,fullPage:true});console.log(`PASS ${width}px: PDF read, 28 guides, preview, issue, two XLSX exact totals, reload, no duplicate`);
 await page.close();await db.close();
}}finally{await browser.close();}
