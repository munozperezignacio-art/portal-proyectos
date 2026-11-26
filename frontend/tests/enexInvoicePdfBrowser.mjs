import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Supply the user's PDF locally; never commit invoices or send test data to production.
const [origin,pdf]=process.argv.slice(2);
if(!origin||!pdf)throw Error('Usage: node tests/enexInvoicePdfBrowser.mjs http://127.0.0.1:4193 /path/F-4158588.pdf');
const browser=await chromium.launch({headless:true});
await mkdir('test-results/enex-invoices',{recursive:true});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname!=='/test-invoices')return route.continue();
   const request=JSON.parse(route.request().postData());
   assert.ok(request.table,'PDF extraction must not save, upload, reconcile or emit');
   await route.fulfill({contentType:'application/json',body:JSON.stringify({data:[],error:null})});
  });
  await page.goto(origin+'/e2e/fixtures/enex-invoices.html');
  await page.getByLabel('Factura PDF').setInputFiles(pdf);
  await page.getByLabel('N° factura').waitFor();
  await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
  const expected={
   'N° factura':'4158588','Litros facturados':'303','Neto combustible ($ CLP)':'447.054',
   'Cargo / descuento Shellcard ($ CLP)':'0','Monto neto ($ CLP)':'447.054',
   'IVA ($ CLP)':'84.940','Impuesto específico ($ CLP)':'-39.082','Total factura ($ CLP)':'492.912',
  };
  for(const [label,value]of Object.entries(expected))assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value,label);
  assert.equal(await page.getByLabel('Guías de despacho').inputValue(),'43532335 43679426 43695459 43731555 43772652');
  assert.equal(await page.getByLabel('Monto exento ($ CLP)',{exact:true}).inputValue(),'');
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`test-results/enex-invoices/pdf-4158588-${width}.png`,fullPage:true});
  console.log(`PASS ${width}px: actual PDF -> PDF.js -> review fields, 303 liters, 5 guides, full fuel net, no writes`);
  await page.close();
 }
}finally{await browser.close();}
