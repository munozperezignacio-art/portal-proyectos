import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {renderEnexPendingEmail} from '../../supabase/functions/_shared/enexPendingEmail.mjs';

const output=new URL('./artifacts/enex-pending-email/',import.meta.url);
await mkdir(output,{recursive:true});
const mail=renderEnexPendingEmail({company:'EMINSG · EJEMPLO',name:'Responsable de prueba',day:'2026-11-24',count:3,oldest:'2026-11-20',vehicles:[{vehicle:'TEST-01',portal:'transporte',count:2},{vehicle:'TEST-02',portal:'empresa',count:1}]});
await writeFile(new URL('correo-prueba.html',output),mail.html);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [760,390]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
  // Render the same checked-in brand image without depending on preview-network access.
  await page.route('https://www.obraxis.cl/brand/obraxis-primary.png',route=>route.fulfill({path:new URL('../public/brand/obraxis-primary.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),contentType:'image/png'}));
  await page.setContent(mail.html,{waitUntil:'networkidle'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error(`Overflow at ${width}`);
  await page.screenshot({path:new URL(`correo-prueba-${width}.png`,output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  await page.close();
 }
}finally{await browser.close();}
console.log('Fictional email preview generated; no email sent.');
