import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [390,1280]){
const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
await page.goto('http://127.0.0.1:4181/e2e/fixtures/weekly-schedule.html');
await page.getByLabel('Vigente desde',{exact:true}).fill('2026-10-19');await page.getByLabel('Motivo del cambio',{exact:true}).fill('Nuevo horario Lonco');
await page.getByLabel('Viernes Salida',{exact:true}).fill('17:00');await page.getByRole('checkbox',{name:/Confirmo recalcular/}).check();
await page.getByRole('button',{name:'Guardar jornada semanal'}).click();await expect(page.getByText('Nuevo horario Lonco',{exact:true})).toBeVisible();
assert.equal(await page.evaluate(()=>window.savedSchedule.p_desde),'2026-10-19');assert.equal(await page.evaluate(()=>window.savedSchedule.p_jornada[5].end),'17:00');
await page.getByRole('button',{name:'Usar como base'}).first().click();await expect(page.getByLabel('Vigente desde',{exact:true})).toHaveValue('2026-10-19');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.getByText('Historial de cambios',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`tests/artifacts/schedule-history-${width}.png`});
assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: mobile/desktop date, save, audit history, reuse revision, responsive layout.');}finally{await browser.close();}
