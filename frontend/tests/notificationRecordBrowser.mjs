import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.route('https://**/*',route=>route.abort());
 await page.goto('http://127.0.0.1:4181/e2e/fixtures/notification-record.html');
 await page.getByTitle('Centro de notificaciones').click();await page.getByRole('button').filter({hasText:'Reporte de maquinaria registrado'}).click();
 await page.getByRole('dialog',{name:'Registro de la notificación'}).waitFor();await page.getByText('Registro #41',{exact:true}).waitFor();
 assert.equal(await page.getByText('8822.4',{exact:true}).count(),1);
 assert.ok((await page.evaluate(()=>window.calls)).some(c=>c.action==='record'&&c.entrega_id===101&&c.client_channel==='web'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`tests/artifacts/notification-record-${width}.png`});await page.getByRole('button',{name:'Cerrar registro',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 console.log(`${width}: PASS notification tap opens exact record and closes`);await page.close();
}}finally{await browser.close();}
