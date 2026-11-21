import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1280,390]){
const page=await browser.newPage({viewport:{width,height:900}});await page.route('https://**/*',r=>r.abort());
await page.goto('http://127.0.0.1:4181/e2e/fixtures/role-responsibilities.html');
await page.getByRole('button',{name:'Responsabilidades por módulo'}).click();
assert.equal(await page.getByRole('button',{name:'Guardar permisos',exact:true}).count(),0);
assert.equal(await page.getByRole('checkbox',{name:'Imputaciones pendientes de Gastos',exact:true}).count(),0);
await page.getByRole('heading',{name:'Obras · Maquinaria de obra',exact:true}).waitFor();
await page.getByRole('heading',{name:'Módulos globales · Maquinaria y Equipos',exact:true}).waitFor();
await page.getByRole('checkbox',{name:'Reporte diario de maquinaria pendiente',exact:true}).check();
await page.getByRole('button',{name:'Guardar responsabilidades'}).click();
await page.getByText('Responsabilidades guardadas.',{exact:false}).waitFor();
assert.equal((await page.evaluate(()=>window.saved.p_codigos)).length,2);
assert.ok((await page.evaluate(()=>window.saved.p_codigos)).includes('gastos_imputacion_pendiente'));
await page.reload();await page.getByRole('button',{name:'Responsabilidades por módulo'}).click();await page.getByRole('button',{name:'Guardar responsabilidades'}).waitFor();await page.getByRole('checkbox',{name:'Reporte diario de maquinaria pendiente',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Reporte diario de maquinaria pendiente',exact:true}).isChecked(),true);
assert.equal(await page.getByRole('checkbox',{name:'Imputaciones pendientes de RRHH',exact:true}).isChecked(),false);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:'tests/artifacts/role-responsibilities-'+width+'.png'});
console.log(width+': PASS save/reopen/module selection/no horizontal overflow');await page.close();
}}finally{await browser.close();}
