import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [390,1280]){const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
const url='http://127.0.0.1:4181/e2e/fixtures/work-fleet.html';await page.goto(url);await expect(page.getByRole('heading',{name:'Maquinaria · actividad y control'})).toBeVisible();
await expect(page.getByText('Sin información suficiente',{exact:true})).toBeVisible();await expect(page.getByText('266 L',{exact:true})).toBeVisible();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`tests/artifacts/work-fleet-${width}.png`,fullPage:true});
await page.getByLabel('Filtrar equipo').selectOption('2');await expect(page.getByText('Sin datos',{exact:true})).toBeVisible();await expect(page.locator('span').filter({hasText:'EXC-04 · EXCAVADORA'})).toHaveCount(0);
await page.getByLabel('Filtrar equipo').selectOption('1');await page.getByLabel('Desde maquinaria').fill('2026-11-19');await expect(page.getByText('Sin datos',{exact:true})).toBeVisible();
await page.goto(url+'?restricted');await expect(page.getByText('Sin permiso para ver costos.')).toBeVisible();assert.ok(!(await page.locator('body').innerText()).includes('$510.747'));
await page.goto(url+'?empty');await expect(page.getByText('No hay equipos vinculados.')).toBeVisible();
await page.goto(url+'?error');await expect(page.getByRole('alert')).toContainText('Consulta interrumpida');assert.deepEqual(errors,[]);await page.close();}
console.log('PASS desktop/mobile: date and equipment filters, missing-data state, restricted costs/checklists, empty/error states and layout.');}finally{await browser.close();}
