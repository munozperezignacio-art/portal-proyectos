import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:4181/e2e/fixtures/equipment-checklist-copy.html');
 await page.getByRole('button',{name:'Editar checklist',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Buscar formulario').fill('inspeccion');
 await page.getByRole('radio').check();
 await page.screenshot({path:`tests/artifacts/checklist-copy-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Usar copia',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Checklist vinculado');
 assert.equal(await page.evaluate(()=>window.copyCalls),1);
 await page.getByRole('button',{name:'Editar checklist',exact:true}).click();
 await expect(page.getByText(/Editas la copia exclusiva/)).toBeVisible();
 await expect(page.getByText('Campo base bloqueado').first()).toBeVisible();
 await page.locator('input').evaluateAll(inputs=>{const field=inputs.find(x=>x.value==='Estado de los cables');if(!field)throw Error('Missing copied question');});
 const question=page.locator('input[value="Estado de los cables"]');
 await question.fill('Estado adaptado');
 await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await expect(page.getByText('Formulario actualizado con éxito.')).toBeVisible();
 const saved=await page.evaluate(()=>({source:window.forms[0],copy:window.forms[1]}));
 assert.equal(saved.source.campos.items[0].label,'Estado de los cables');
 assert.equal(saved.copy.campos.items.at(-1).label,'Estado adaptado');
 assert.equal(saved.copy.campos.control_documental.equipo_checklist_id,7);
 assert.equal(await page.evaluate(()=>window.copyCalls),1);
 assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS mobile and desktop: search, copy, return to edit, protected fields, no duplicate, no overflow.');
}finally{await browser.close();}
