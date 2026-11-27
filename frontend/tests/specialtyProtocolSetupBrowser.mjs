import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({headless:true});
try {for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 const html=await server.transformIndexHtml('/', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{
  await import('/src/index.css');
  const React=await import('/node_modules/.vite/deps/react.js'),DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
  const Component=(await import('/src/components/SpecialtyProtocols.jsx')).default;
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');document.body.append(mount);
  window.calls=[];
  const sessions=[{id:'b',fecha:'2026-11-24',estado:'cerrada',datos:{pilas:[{element_id:'p',terminada:true}]}},{id:'a',fecha:'2026-11-16',estado:'cerrada',datos:{pilas:[]}}];
  (DOM.default||DOM).createRoot(mount).render((React.default||React).createElement(Component,{
   state:{protocol_create:true,protocol_edit:true,protocols:[{id:'old',sesion_id:'a',tipo:'ejecucion',fecha:'2026-11-16',correlativo:'1',estado:'borrador',revision:3,snapshot:{pilas:[],fijos:{finos:'< 2%'}}}],fronts:['Frente Principal']},
   cfg:{partida_id:1,datos_fijos:{}},sessions,elements:[{id:'p',sesion_id:'b',numero:13,etapa:'General'}],
   call:async(action,data)=>window.calls.push({action,data}),refresh:async()=>{},work:{nombre:'Prueba'},user:{empresa:'TEST'},renderTopo:()=>null
  }));
 });
 await page.getByText('Antecedentes del proyecto',{exact:true}).click();
 await page.getByLabel('Estructura',{exact:true}).selectOption('Frente Principal');
 await page.getByText('Información del árido · valores editables',{exact:true}).click();
 assert.equal(await page.getByLabel('Finos (%)',{exact:true}).inputValue(),'< 5%');
 await page.getByLabel('Finos (%)',{exact:true}).fill('< 4%');
 await page.getByLabel('Jornada del protocolo').selectOption('b');
 assert.equal(await page.getByLabel('Correlativo automático',{exact:false}).inputValue(),'2');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Crear protocolo',exact:true}).click();
 const calls=await page.evaluate(()=>window.calls);
 assert.equal(calls[0].data.correlativo,'2');
 assert.equal(calls[0].data.fijos.finos,'< 4%');
 assert.equal(calls[0].data.fijos.estructura,'Frente Principal');
 assert.deepEqual(calls[0].data.element_ids,['p']);
 await page.getByLabel('Jornada del protocolo').selectOption('a');
 assert.equal(await page.getByLabel('Correlativo automático',{exact:false}).inputValue(),'1');
 await page.getByRole('button',{name:'Editar borrador',exact:true}).click();
 assert.equal(await page.getByLabel('Finos (%)',{exact:true}).inputValue(),'< 2%');
 assert.equal(await page.getByLabel('Correlativo automático',{exact:false}).inputValue(),'1');
 assert.equal(await page.getByLabel('Jornada del protocolo').isDisabled(),true);
 assert.equal((await page.evaluate(()=>window.calls)).length,1,'Opening an existing draft must not write data');
 await page.locator('.specialty-protocols').screenshot({path:`C:/Users/ignac/AppData/Local/Temp/protocol-setup-${width}.png`});
 assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(width+': protocol form and payload PASS');
 await page.close();
}}finally{await browser.close();await server.close();}
