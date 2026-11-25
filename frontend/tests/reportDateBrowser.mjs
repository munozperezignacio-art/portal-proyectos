import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4189/tests/fixtures/report-date.html');
 await page.getByRole('button',{name:'Enviar reporte',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 assert.match(await page.getByRole('dialog').innerText(),/24\/11\/2026/);
 await page.getByRole('button',{name:'Volver y revisar fecha'}).click();
 assert.equal(await page.evaluate(()=>window.sent||0),0);
 await page.getByRole('button',{name:'Enviar reporte',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar fecha y enviar'}).click();
 assert.equal(await page.evaluate(()=>window.sent),1);
 console.log('PASS date warning: correct equipment/date, cancel without sending, confirm once.');
}finally{await browser.close();}
