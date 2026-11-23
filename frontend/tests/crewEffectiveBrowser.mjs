import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:4181';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 let assets=null;
 if(origin.startsWith('https:')){
  const html=await(await page.request.get(origin)).text();const entry=html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)[1];
  const js=await(await page.request.get(new URL(entry,origin).href)).text();const file=js.match(/Obras-[\w-]+\.js/)[0];
  const text=await(await page.request.get(origin+'/assets/'+file)).text();
  assets={file,vendor:text.match(/react-vendor-[\w-]+\.js/)[0],client:text.match(/supabaseClient-[\w-]+\.js/)[0]};
 }
 await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.goto(origin);
 await page.evaluate(async assets=>{
  let React,DOM,db,Component;
  if(assets){const mods=Object.values(await import('/assets/'+assets.vendor)).map(f=>f());React=mods.find(m=>m.createElement);DOM=mods.find(m=>m.createRoot);db=Object.values(await import('/assets/'+assets.client)).find(v=>v?.from&&v?.rpc);Component=(await import('/assets/'+assets.file)).default;}
  else{React=(await import('/node_modules/.vite/deps/react.js')).default;DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;db=(await import('/src/supabaseClient.js')).supabase;Component=(await import('/src/components/Obras.jsx')).default;}
  const work={id:32,empresa:'TEST',nombre:'Lonco',estado:'En Ejecución',fecha_inicio:'2026-11-01'};
  const crew={id:4,empresa:'TEST',obra_id:32,obra_nombre:'Lonco',nombre:'IMPACT',miembros:['Gerardo'],version_integrantes:0};
  window.crewWrites=[];
  db.from=table=>{let single=false;const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:single?(table==='obras'?work:null):table==='obras'?[work]:table==='obra_cuadrillas'?[crew]:[],error:null});return ()=>{if(key==='single'||key==='maybeSingle')single=true;if(['insert','update','delete','upsert'].includes(key))throw Error('Unexpected table write');return q;};}});return q;};
  db.rpc=async(name,p)=>{if(name==='guardar_cuadrilla_vigencia'){window.crewWrites.push(p);return {data:{cuadrilla:{...crew,version_integrantes:1},reportes_vinculados:1},error:null};}return {data:[],error:null};};
  document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);
  DOM.createRoot(mount).render(React.createElement(Component,{initialObraName:'Lonco',user:{empresa:'TEST',rol:'Superusuario',obras:'Todas',_rolePreview:true,permisos:{'obras.personal.ver':true,'obras.personal.crear':true,'obras.personal.editar':true}},onBack(){}}));
 },assets);
 await page.getByRole('heading',{name:'Equipo de Obra',exact:true}).click();
 await page.getByRole('button',{name:'Cuadrillas',exact:true}).click();
 await page.getByTitle('Editar cuadrilla de trabajo').click();
 await page.getByLabel('Aplicar integrantes desde').fill('2026-11-13');
 await page.getByLabel('Motivo del cambio').fill('Prueba de vigencia retroactiva');
 await page.getByRole('button',{name:'Guardar Cuadrilla de Trabajo',exact:true}).click();
 await page.waitForFunction(()=>window.crewWrites.length===1,{},{timeout:10000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(-3000));console.log(await page.locator('input:invalid').evaluateAll(xs=>xs.map(x=>({type:x.type,value:x.value,max:x.max}))));throw e;});
 await page.getByRole('heading',{name:'Editar Cuadrilla de Trabajo',exact:true}).waitFor({state:'hidden'});
 const writes=await page.evaluate(()=>window.crewWrites);assert.equal(writes.length,1);assert.equal(writes[0].p_id,4);assert.equal(writes[0].p_desde,'2026-11-13');assert.equal(writes[0].p_version,0);
 await page.getByRole('button',{name:'Crear Cuadrilla',exact:true}).click();
 assert.equal(await page.getByRole('heading',{name:'Crear Cuadrilla de Trabajo',exact:true}).count(),1);
 assert.equal(await page.getByLabel('Motivo del cambio').inputValue(),'');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal((await page.evaluate(()=>window.crewWrites)).length,1);
 console.log('PASS actual crew editor: retrospective date, existing id/version, atomic RPC, create reset, cancel without writes.');
}finally{await browser.close();}
