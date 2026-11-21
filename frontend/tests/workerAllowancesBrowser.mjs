import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:1100}});await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:4181/e2e/fixtures/worker-allowance-modes.html');
 await page.getByText('Asignación anterior:',{exact:false}).waitFor();
 await page.getByLabel('Proporcional a los días trabajados según marcajes',{exact:true}).check();
 assert.match(await page.locator('output').textContent(),/100000/);
 await page.getByRole('button',{name:'Guardar ficha'}).click();await page.reload();
 assert.ok(await page.getByLabel('Proporcional a los días trabajados según marcajes',{exact:true}).isChecked());
 await page.getByLabel('Monto mensual completo independiente de la asistencia',{exact:true}).check();
 await page.getByRole('button',{name:'Guardar ficha'}).click();await page.reload();
 assert.ok(await page.getByLabel('Monto mensual completo independiente de la asistencia',{exact:true}).isChecked());
 assert.match(await page.locator('output').textContent(),/200000/);
 await page.getByRole('button',{name:'+ Agregar asignación'}).click();
 assert.ok(await page.getByLabel('Proporcional a los días trabajados según marcajes',{exact:true}).nth(1).isChecked());
 assert.ok(await page.getByLabel('Monto mensual completo independiente de la asistencia',{exact:true}).first().isChecked());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`tests/artifacts/worker-allowances-${width}.png`,fullPage:true});
 console.log(`${width}: PASS independent choices, save/reopen and no horizontal overflow`);await page.close();
}}finally{await browser.close();}
