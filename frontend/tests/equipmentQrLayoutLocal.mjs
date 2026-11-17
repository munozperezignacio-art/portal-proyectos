import {spawn} from 'node:child_process';import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4187'],{windowsHide:true,stdio:'ignore'});let browser;
try{
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4187')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1280,390]){
const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4187/e2e/fixtures/equipment-qr-layout.html');
await page.getByLabel('Tu RUT').fill('12.345.678-5');await page.getByRole('button',{name:'Continuar',exact:true}).click();
await page.getByRole('button',{name:'Realizar reporte',exact:true}).click();
await page.getByText('Reporte diario de maquinaria',{exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Realizar reporte',exact:true}).count(),0);
assert.equal(await page.getByRole('button',{name:'Documentos',exact:true}).count(),0);
const widths=await page.locator('header').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().width)));
assert.equal(widths[0],widths[1]);
await page.screenshot({path:'tests/equipment-report-'+width+'.png',fullPage:true});
await page.getByRole('button',{name:'Volver al equipo',exact:true}).click();await page.getByRole('button',{name:'Realizar checklist',exact:true}).click();await page.getByText('Checklist prueba',{exact:true}).waitFor();
const check=await page.locator('header').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().width)));assert.equal(check[0],check[1]);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
await page.screenshot({path:'tests/equipment-checklist-'+width+'.png',fullPage:true});
await page.close();console.log('PASS report/checklist navigation and equal widths '+width);
}
const p=await browser.newPage();await p.goto('http://127.0.0.1:4187/e2e/fixtures/equipment-qr-layout.html?docs');
await p.getByLabel('Nombre del documento',{exact:true}).fill('Certificado prueba');
await p.getByLabel('Fecha de vencimiento (opcional)').fill('2027-03-01');
await p.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
await p.getByRole('button',{name:'Subir documento',exact:true}).click();await p.getByRole('button',{name:'Certificado prueba',exact:true}).waitFor();
await p.getByText('Vencimiento: 2027-03-01',{exact:true}).waitFor();
await p.getByLabel('Visible en QR',{exact:true}).check();await p.getByRole('button',{name:'Editar datos'}).click();
await p.getByLabel('Nombre',{exact:true}).fill('Certificado editado');await p.getByRole('button',{name:'Guardar datos'}).click();
await p.getByRole('button',{name:'Certificado editado',exact:true}).waitFor();
await p.getByRole('button',{name:'Eliminar',exact:true}).click();await p.getByRole('button',{name:'Confirmar eliminación'}).click();
await p.getByRole('button',{name:'Certificado editado',exact:true}).waitFor({state:'detached'});
await p.getByRole('button',{name:'Ver eliminados'}).click();await p.getByRole('button',{name:'Restaurar como privado'}).click();
await p.getByRole('button',{name:'Ver documentos activos'}).click();await p.getByRole('button',{name:'Certificado editado',exact:true}).waitFor();
assert.equal(await p.getByLabel('Visible en QR',{exact:true}).isChecked(),false);
console.log('PASS document upload, name, expiry, edit, delete and private restore');
await p.goto('http://127.0.0.1:4187/e2e/fixtures/equipment-qr-layout.html?editor');
await p.getByRole('button',{name:'Editar checklist',exact:true}).click();
await p.getByRole('button',{name:'Guardar cambios',exact:true}).waitFor();
assert.equal(await p.locator('input').filter({visible:true}).evaluateAll(els=>els.some(e=>e.value==='Lista de verificación excavadora')),true);
await p.getByRole('button',{name:'Volver a la ficha del equipo',exact:true}).click();
await p.getByRole('button',{name:'Editar checklist',exact:true}).waitFor();
console.log('PASS direct editor opens existing checklist and returns to equipment');
}finally{await browser?.close();server.kill();}

