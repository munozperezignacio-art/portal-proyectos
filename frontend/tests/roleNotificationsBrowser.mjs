import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});try{for(const width of [1280,390]){
const page=await browser.newPage({viewport:{width,height:1000}});await page.route('https://**/*',r=>r.abort());await page.goto('http://127.0.0.1:4181/e2e/fixtures/role-notifications.html');
await page.getByRole('checkbox',{name:'Formulario recibido · Correo',exact:true}).check();
await page.getByRole('checkbox',{name:'Formulario recibido · Aplicación móvil',exact:true}).check();
await page.getByLabel('Formulario recibido · Obras',{exact:true}).selectOption('all');
await page.getByLabel('Formulario recibido · Selección',{exact:true}).selectOption('selected');
await page.getByRole('checkbox',{name:'Tarjeta PARE',exact:true}).check();
await page.getByRole('button',{name:'Guardar notificaciones'}).click();await page.getByText('Notificaciones guardadas.',{exact:false}).waitFor();
const saved=await page.evaluate(()=>window.saved.p_settings.prevencion_registro_recibido);assert.equal(saved.web,false);assert.equal(saved.email,true);assert.equal(saved.mobile,true);assert.equal(saved.works,'all');assert.deepEqual(saved.form_ids,['12']);
await page.reload();await page.getByRole('checkbox',{name:'Tarjeta PARE',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Tarjeta PARE',exact:true}).isChecked(),true);assert.equal(await page.getByRole('checkbox',{name:'Formulario recibido · Campana web',exact:true}).isChecked(),false);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'tests/artifacts/role-notifications-'+width+'.png'});console.log(width+': PASS independent channels/all works/form selection/save/reopen');await page.close();}}finally{await browser.close();}

