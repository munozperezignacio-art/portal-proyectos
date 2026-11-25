import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();let saved;
 await page.route('**/rest/v1/inventario_maquinaria*',route=>route.fulfill({json:[{id:1,tipo:'Excavadora',patente:'TEST-01'}]}));
 await page.route('**/rest/v1/rpc/guardar_operador_externo',route=>{saved=route.request().postDataJSON();return route.fulfill({json:{ok:true,id:'test'}});});
 await page.goto('http://127.0.0.1:4189/tests/fixtures/external-operator.html');
 await page.getByLabel('RUT',{exact:true}).fill('12.345.678-5');
 await page.getByLabel('Nombre completo').fill('Externo de prueba');
 await page.getByLabel('Empresa o proveedor').fill('Proveedor test');
 await page.getByRole('button',{name:'Guardar operador externo'}).click();
 assert.match(await page.getByRole('alert').innerText(),/al menos un equipo/);
 assert.equal(saved,undefined);
 await page.getByLabel('TEST-01 · Excavadora').check();
 await page.getByRole('button',{name:'Guardar operador externo'}).click();
 await page.getByLabel('Tu RUT').waitFor();
 assert.deepEqual(saved.p_datos.equipos_autorizados,[1]);
 assert.equal(saved.p_datos.rut_externo,'123456785');
 assert.equal(saved.p_datos.trabajador_id,undefined);
 assert.equal(await page.locator('input[type=password]').count(),0);
 await page.getByLabel('Tu RUT').fill('12.345.678-5');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('navigation',{name:'Acciones del equipo'}).waitFor();
 assert.equal(await page.getByRole('navigation').getByRole('button').count(),4);
 await page.getByRole('button',{name:'Realizar reporte',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.openedAction),'reporte');
 console.log('PASS external operator editor, equipment required, normalized RUT, no payroll ID; QR RUT-only and four-action landing.');
}finally{await browser.close();}
