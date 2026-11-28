import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {catalogFixture} from '../scripts/pileCatalogFixture.mjs';
const db=await catalogFixture();
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 await db.exec('begin');const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',async route=>{const p=route.request().postDataJSON();try{const r=await db.query('select public.specialty_catalog_api($1,$2,$3) r',[p.p_work,p.p_action,JSON.stringify(p.p_data)]);await route.fulfill({json:r.rows[0].r});}catch(e){await route.fulfill({status:400,json:{message:e.message}});}});
 const html=await server.transformIndexHtml('/','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(server.resolvedUrls.local[0]);
 const render=async()=>{const elements=(await db.query('select * from private.specialty_elements where obra_id=1')).rows;await page.evaluate(async elements=>{
  await import('/src/index.css');const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js');const C=(await import('/src/components/SavedPileCoordinates.jsx')).default;
  window.catalogRoot??=(D.default||D).createRoot(document.getElementById('root'));window.catalogRoot.render((R.default||R).createElement(C,{elements,workId:1,partId:1,state:{can_create_piles:true,can_edit_piles:true,can_import:true},onSaved:async()=>{}}));
 },elements);};
 await render();await page.getByRole('button',{name:'Agregar pila',exact:true}).click();
 let dialog=page.getByRole('dialog');
 const metadata=async()=>{await dialog.getByLabel('Plano / revisión').fill('Rev F');await dialog.getByLabel('Motivo del cambio').fill('Prueba de revisión');};
 await metadata();await dialog.getByLabel('Pila',{exact:true}).fill('1');await dialog.getByLabel('Norte',{exact:true}).fill('5923799.64');await dialog.getByLabel('Este',{exact:true}).fill('678626.48');await dialog.getByLabel('Frente',{exact:true}).selectOption('TORRE A');
 await dialog.getByRole('button',{name:'Revisar cambios'}).click();await dialog.getByRole('button',{name:'Confirmar revisión'}).click();await dialog.waitFor({state:'hidden'});await render();
 await page.getByRole('button',{name:'Editar pila 1 · TORRE A'}).click();await metadata();await dialog.getByLabel('Norte',{exact:true}).fill('5923800');await dialog.getByRole('button',{name:'Revisar cambios'}).click();
 await dialog.getByText('Norte: 5923799.64 → 5923800').waitFor();await dialog.getByRole('button',{name:'Confirmar revisión'}).click();await dialog.waitFor({state:'hidden'});await render();
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Pila','Norte','Este','Frente'],[1,5923801,678626.48,'TORRE A'],[2,5923802,678625.38,'TORRE B']]),'Revisión');
 await page.getByRole('button',{name:'Importar revisión de planos'}).click();await metadata();await dialog.getByLabel('Archivo Excel de revisión').setInputFiles({name:'revision.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});
 await dialog.getByText('Revisión · 2 pilas').waitFor();await dialog.getByRole('button',{name:'Revisar cambios'}).click();await dialog.getByText('1 nuevas · 1 modificadas · 0 sin cambios.').waitFor();
 await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/catalog-revision-${width}.png`});await dialog.getByRole('button',{name:'Confirmar revisión'}).click();await dialog.waitFor({state:'hidden'});await render();
 await page.getByRole('button',{name:'Historial de revisiones'}).click();await dialog.locator('details').first().waitFor();assert.equal(await dialog.locator('details').count(),4);await dialog.locator('summary').first().click();await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/catalog-history-${width}.png`});
 assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth));assert.deepEqual(errors,[]);await page.close();await db.exec('rollback');console.log(`PASS ${width}: add/edit/import preview/history with real SQL`);
 }}finally{await browser.close();await server.close();await db.close();}
