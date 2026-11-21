import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:4181/e2e/fixtures/earnings-selection.html');
 await page.getByLabel('Personal CAM ·').waitFor();
 assert.ok(await page.getByLabel('Personal CAM ·').isChecked());assert.ok(await page.getByLabel('Personal Lonco ·').isChecked());
 assert.equal(await page.getByLabel('Persona dada de baja ·').count(),0);assert.equal(await page.getByLabel('Sin relación ·').count(),0);
 await page.getByLabel('Lonco',{exact:true}).uncheck();await page.getByLabel('Personal Lonco ·').waitFor({state:'detached'});
 assert.ok(await page.getByLabel('Personal CAM ·').isChecked());
 await page.getByLabel('Personal CAM ·').uncheck();assert.ok(await page.getByRole('button',{name:'Descargar Excel de haberes'}).isDisabled());
 await page.getByLabel('Lonco',{exact:true}).check();await page.getByLabel('Personal Lonco ·').waitFor();assert.ok(await page.getByLabel('Personal CAM ·').isChecked());
 await page.getByLabel('Incluir trabajadores dados de baja').check();await page.getByLabel('Persona dada de baja ·').waitFor();assert.ok(await page.getByLabel('Persona dada de baja ·').isChecked());
 await page.getByLabel('Incluir trabajadores dados de baja').uncheck();await page.getByLabel('Persona dada de baja ·').waitFor({state:'detached'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(`${width}: PASS works select their personnel, exclude inactive by default, preserve historical opt-in`);await page.close();
}}finally{await browser.close();}
