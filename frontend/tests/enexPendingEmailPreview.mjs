import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {renderEnexPendingEmail} from '../../supabase/functions/_shared/enexPendingEmail.mjs';

const output=new URL('./artifacts/enex-pending-email/',import.meta.url);
await mkdir(output,{recursive:true});
const branding=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):null;
const mail=renderEnexPendingEmail({company:'EMINSG',name:'Responsable de prueba',day:'2026-11-24',count:3,oldest:'2026-11-20',vehicles:[{vehicle:'TEST-01',portal:'transporte',count:2},{vehicle:'TEST-02',portal:'empresa',count:1}]},branding);
// A browser has no MIME attachments; resolve CID solely for the visual proof.
const previewHtml=mail.html.replace('cid:company-logo',branding?.logo_base64||'');
await writeFile(new URL('correo-prueba.html',output),previewHtml);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [760,390]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
  await page.setContent(previewHtml,{waitUntil:'networkidle'});
  if(branding){const logo=page.locator('img');if(!await logo.evaluate(img=>img.complete&&img.naturalWidth>0))throw Error('Logo failed to render');}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error(`Overflow at ${width}`);
  await page.screenshot({path:new URL(`correo-prueba-${width}.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  await page.close();
 }
}finally{await browser.close();}
console.log('Fictional email preview generated; no email sent.');
