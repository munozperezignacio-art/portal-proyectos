import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir} from 'node:fs/promises';
const origin=process.argv[2]||'http://127.0.0.1:4192';
const db=new PGlite();
await db.exec(`create role authenticated;create role anon;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.enex_allowed(company text,action text) returns boolean language sql stable as $$select company='TEST'$$;
 grant usage on schema auth,private to authenticated;grant execute on function auth.uid(),private.enex_allowed(text,text) to authenticated;`);
await db.exec(await readFile(new URL('../../supabase/schema/enex-invoice-rules.sql',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true});
await mkdir('test-results/enex-invoice-rules',{recursive:true});
let uncertain=false,writes=0;
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort(); // Never touch production.
   if(url.pathname!=='/test-invoice-rules')return route.continue();
   const q=JSON.parse(route.request().postData());
   assert.equal(q.table,'enex_invoice_rules');
   const company=q.insert?.empresa||q.filters.find(([k])=>k==='empresa')?.[1];
   const revision=q.filters.find(([k])=>k==='revision')?.[1];
   const result=await db.transaction(async tx=>{
    await tx.exec('set local role authenticated');
    if(q.insert){writes++;return tx.query('insert into enex_invoice_rules(empresa,machinery_threshold_milli) values($1,$2) returning *',[company,q.insert.machinery_threshold_milli]);}
    if(q.update){writes++;return tx.query('update enex_invoice_rules set machinery_threshold_milli=$1 where empresa=$2 and revision=$3 returning *',[q.update.machinery_threshold_milli,company,revision]);}
    return tx.query('select * from enex_invoice_rules where empresa=$1',[company]);
   });
   const body=uncertain&&(q.insert||q.update)?{data:null,error:{message:'Synthetic uncertain reply after commit'}}:{data:result.rows[0]||null,error:null};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`${origin}/e2e/fixtures/enex-invoice-rules.html`);
  const input=page.getByLabel('Maquinaria cuando la carga supera (litros)');
  await input.waitFor();await page.getByRole('button',{name:'Guardar regla',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
  await input.fill(width===1280?'200,5':'190');
  if(width===390)uncertain=true;
  const before=writes;
  await page.getByRole('button',{name:'Guardar regla',exact:true}).click();
  if(width===1280){
   await page.getByRole('status').waitFor();await page.reload();
   await page.waitForFunction(()=>document.querySelector('input')?.value==='200.5');
   const saved=(await db.query("select * from enex_invoice_rules where empresa='TEST'")).rows[0];
   assert.equal(saved.machinery_threshold_milli,200500);
  }else{
   await page.getByRole('alert').waitFor();
   assert.equal(await page.getByRole('button',{name:'Guardar regla',exact:true}).isDisabled(),true);
   await page.getByRole('button',{name:'Actualizar configuración'}).click();
   await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);
   assert.equal(await input.inputValue(),'190');assert.equal(writes,before+1);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-results/enex-invoice-rules/${width}.png`,fullPage:true});
  await context.close();console.log(`PASS ${width}px: render, save, persistence and ${width===390?'uncertain reply/reload without retry':'reopen'}`);
 }
 assert.equal((await db.query('select * from enex_invoice_rules_audit')).rows.length,2);
}finally{await browser.close();await db.close();}
