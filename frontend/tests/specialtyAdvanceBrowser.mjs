import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const works=JSON.parse(await readFile(new URL('./fixtures/specialtyAdvanceWorks.json',import.meta.url),'utf8'));
works.find(w=>w.id===100).elements=JSON.parse(await readFile(new URL('./fixtures/asturiasAllPiles.json',import.meta.url),'utf8')).sort((a,b)=>Number(a.numero)-Number(b.numero));
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390])for(const work of works){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],writes=[];let failOnce=true;
 const state={actor:'test',settings:work.settings,elements:structuredClone(work.elements),sessions:[],protocols:[],users:[],reports:[],can_execute:true,can_topography:true,can_configure:true,can_import:true};
 if(state.elements.length)state.elements[0].topografia={observaciones:'Conservar',tipo_ensayo:'BST'};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{
  if(!route.request().url().includes('/rpc/specialty_api'))return route.abort();
  const p=route.request().postDataJSON();
  if(p.p_action==='state')return route.fulfill({json:state});
  writes.push(p);assert.equal(p.p_action,'topography','Only topography may write in this test');
  if(failOnce){failOnce=false;return route.fulfill({status:503,json:{message:'Conexión interrumpida de prueba'}});}
  const el=state.elements.find(e=>e.id===p.p_data.element_id);assert.ok(el);el.topografia=p.p_data.datos;el.revision_topografia++;
  return route.fulfill({json:{ok:true}});
 });
 const html=await server.transformIndexHtml('/','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async work=>{
  await import('/src/index.css');const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js'),React=R.default||R;
  const Reports=(await import('/src/components/SpecialtyReports.jsx')).default,Actions=(await import('/src/components/SpecialtyAdvanceActions.jsx')).default;
  const root=document.getElementById('root');root.style.display='none';const mount=document.createElement('main');document.body.append(mount);
  function App(){const [history,setHistory]=React.useState({}),[mode,setMode]=React.useState('registro');return React.createElement('div',{className:'p-3 space-y-4'},React.createElement('nav',{className:'flex flex-wrap gap-2'},React.createElement(Actions,{workId:work.id,parts:work.parts,history,mode,onChange:setMode})),React.createElement('div',{hidden:!['especialidad','topografia'].includes(mode)},React.createElement(Reports,{work,user:{empresa:'TEST',id:1},parts:work.parts,onHistory:setHistory,mode:mode==='topografia'?'topography':'journal',active:false})),React.createElement('span',{'data-testid':'loaded'},history.workId||''));}
  (D.default||D).createRoot(mount).render(React.createElement(App));
 },work);
 await page.getByTestId('loaded').filter({hasText:String(work.id)}).waitFor();
 if(!work.piles){assert.equal(await page.getByRole('button').count(),0);await page.close();console.log(`${work.nombre} ${width}: no operational entry without piles`);continue;}
 await page.getByRole('button',{name:'Pilas de grava · Ejecución',exact:true}).click();
 assert.equal(await page.getByLabel('Partida asociada').locator('option').count(),1);
 assert.equal(await page.getByRole('button',{name:/Configurar/}).count(),0);
 await page.getByLabel('Fecha de la jornada').fill('2026-11-28');await page.getByRole('button',{name:'Iniciar jornada de trabajo'}).click();
 const search=page.getByRole('searchbox');await search.fill('NOEXISTE');await page.getByText('No se encontraron pilas con ese número o frente en esta partida.').waitFor();
 if(work.id===100){
  await search.fill('');assert.equal(await page.getByRole('button',{name:/^Agregar pila \d+$/}).count(),290);
  assert.deepEqual((await page.getByRole('button',{name:/^Agregar pila \d+$/}).allTextContents()).slice(0,3),['Agregar pila 1','Agregar pila 2','Agregar pila 3']);
  for(const pile of work.elements){await search.fill('Pila '+pile.numero);assert.equal(await page.getByRole('button',{name:/^Agregar pila \d+$/}).count(),1);assert.equal(await page.getByRole('button',{name:'Agregar pila '+pile.numero,exact:true}).count(),1);}
  console.log(`${width}: execution search checked individually for all 290 piles`);
 }
 await search.fill(work.id===100?'torre a':'frente principal');assert.equal(await page.getByRole('button',{name:'Agregar pila 1',exact:true}).count(),1);
 await search.fill('PILA 1');await page.getByRole('button',{name:'Agregar pila 1',exact:true}).click();await page.getByRole('button',{name:'En esta jornada'}).waitFor();
 await search.fill('pila 2');assert.equal(await page.locator('tbody tr').count(),0);
 if(work.id===98)assert.equal(await page.getByRole('button',{name:'Ejecución ya registrada'}).isDisabled(),true);
 await page.getByRole('button',{name:'Pilas de grava · Topografía',exact:true}).click();
 await page.getByRole('heading',{name:'Registrar topografía por pila'}).waitFor();
 if(work.id===100){
  const finder=page.getByRole('searchbox');assert.equal(await page.getByRole('button',{name:/^Agregar pila \d+$/}).count(),290);
  for(const pile of work.elements){await finder.fill(pile.numero);assert.equal(await page.getByRole('button',{name:/^Agregar pila \d+$/}).count(),1);assert.equal(await page.getByRole('button',{name:'Agregar pila '+pile.numero,exact:true}).count(),1);}
  await finder.fill('');assert.ok(!(await page.locator('main').innerText()).includes('General'));
  console.log(`${width}: topography search checked individually for all 290 piles`);
 }
 await page.getByRole('button',{name:'Agregar pila 2',exact:true}).click();await page.getByRole('button',{name:'Agregar pila 1',exact:true}).click();
 for(const n of [2,1]){await page.getByLabel(`Cota inicial (m) pila ${n}`,{exact:true}).fill('99,48');await page.getByLabel(`Cota final (m) pila ${n}`,{exact:true}).fill('85');}
 await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/web-specialty-${work.id}-${width}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page overflow');
 await page.getByRole('button',{name:'Guardar jornada de topografía'}).click();await page.getByText(/0 pilas guardadas; 2 pendientes/).waitFor();
 await page.getByRole('button',{name:'Guardar jornada de topografía'}).click();await page.getByText('2 pilas guardadas. Mediciones vinculadas sin sumar avance de ejecución.').waitFor();
 assert.equal(writes[0].p_data.request_id,writes[1].p_data.request_id,'Retry keeps idempotency key');
 assert.deepEqual(writes.slice(1).map(w=>w.p_data.element_id),[work.elements[1].id,work.elements[0].id]);assert.equal(writes[2].p_data.datos.observaciones,'Conservar');assert.equal(writes[2].p_data.datos.tipo_ensayo,'BST');assert.equal(writes[0].p_data.datos.cota_inicial,'99.48');
 await page.evaluate(async work=>{
  const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js'),A=(await import('/src/components/SpecialtyAdvanceActions.jsx')).default,React=R.default||R;
  for(const [id,execute,topo,workId] of [['topo-only',false,true,work.id],['execute-only',true,false,work.id],['no-permission',false,false,work.id],['stale-work',true,true,999]]){
   const el=document.createElement('div');el.id=id;document.body.append(el);(D.default||D).createRoot(el).render(React.createElement(A,{workId:work.id,parts:work.parts,history:{workId,settings:work.settings,elements:work.elements,can_execute:execute,can_topography:topo},onChange:()=>{}}));
  }
 },work);
 await page.locator('#topo-only button').waitFor();assert.equal(await page.locator('#topo-only button').textContent(),'Pilas de grava · Topografía');assert.equal(await page.locator('#execute-only button').textContent(),'Pilas de grava · Ejecución');assert.equal(await page.locator('#no-permission button, #stale-work button').count(),0);
 if(work.id===100){
  await page.evaluate(async elements=>{
   document.querySelector('main').hidden=true;const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js'),React=R.default||R;
   const {TopoInbox}=await import('/src/components/SpecialtyReports.jsx'),Coordinates=(await import('/src/components/SavedPileCoordinates.jsx')).default;
   for(const [id,Component,props]of [['quality-topo',TopoInbox,{elements,sessions:[],disabled:true}],['coordinates',Coordinates,{elements}]]){const el=document.createElement('section');el.id=id;document.body.append(el);(D.default||D).createRoot(el).render(React.createElement(Component,props));}
  },work.elements);
  const quality=page.locator('#quality-topo'),coords=page.locator('#coordinates');await quality.getByText('290 pilas coinciden con los filtros.').waitFor();
  while(await quality.getByRole('button',{name:'Ver más pilas'}).count())await quality.getByRole('button',{name:'Ver más pilas'}).click();
  assert.equal(await quality.locator('summary').count(),290);assert.equal(await coords.locator('tbody tr').count(),290);
  assert.deepEqual((await quality.locator('summary').allTextContents()).slice(0,3),['Pila 1 · TORRE A','Pila 2 · TORRE A','Pila 3 · TORRE A']);
  for(const pile of work.elements){await quality.getByLabel('Número de pila',{exact:true}).fill('Pila '+pile.numero);assert.equal(await quality.locator('summary').count(),1);assert.equal(await quality.locator('summary').textContent(),`Pila ${pile.numero} · TORRE A`);await coords.getByLabel('Buscar pila',{exact:true}).fill(pile.numero);assert.equal(await coords.locator('tbody tr').count(),1);assert.equal(await coords.locator('tbody tr td').first().textContent(),pile.numero);}
  await quality.getByLabel('Número de pila',{exact:true}).fill('2');await coords.getByLabel('Buscar pila',{exact:true}).fill('2');
  assert.ok(!/General|Etapa/.test(await quality.innerText()));assert.ok(!/General|Etapa/.test(await coords.innerText()));
  await quality.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/quality-pile2-${width}.png`});console.log(`${width}: Quality topography and coordinates checked individually for all 290 piles`);
 }
 assert.deepEqual(errors,[]);await page.close();console.log(`${work.nombre} ${width}: configured parts, search, execution status, topography order and preservation OK`);
}}finally{await browser.close();await server.close();}
