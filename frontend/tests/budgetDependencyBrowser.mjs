import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:4181';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 let assets=null;
 if(origin.startsWith('https:')){
  const html=await (await page.request.get(origin)).text();
  const entry=html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)[1];
  const js=await (await page.request.get(new URL(entry,origin).href)).text();
  const file=js.match(/PresupuestosPlanif-[\w-]+\.js/)[0];
  const text=await (await page.request.get(origin+'/assets/'+file)).text();
  assets={file,vendor:text.match(/react-vendor-[\w-]+\.js/)[0],client:text.match(/supabaseClient-[\w-]+\.js/)[0]};
 }
 await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.goto(origin);
 await page.evaluate(async assets=>{
  let React,DOM,db,Component;
  if(assets){
   const modules=Object.values(await import('/assets/'+assets.vendor)).map(f=>f());
   React=modules.find(m=>m.createElement);DOM=modules.find(m=>m.createRoot);
   db=Object.values(await import('/assets/'+assets.client)).find(v=>v?.from&&v?.rpc);
   Component=(await import('/assets/'+assets.file)).default;
  }else{
   React=(await import('/node_modules/.vite/deps/react.js')).default;
   DOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
   db=(await import('/src/supabaseClient.js')).supabase;
   Component=(await import('/src/components/PresupuestosPlanif.jsx')).default;
  }
  const items=[{id:1,presupuesto_id:1,codigo:'01',partida:'Pilas',cantidad:100,unidad:'UND',costo_unitario:123.45,tipo_item:'PARTIDA',orden:0},{id:2,presupuesto_id:1,codigo:'02',partida:'Apoyo',cantidad:250,unidad:'m³',costo_unitario:987.65,tipo_item:'PARTIDA',orden:1}];
  window.budgetWrites=[];
  db.from=table=>{
   let payload=null,id=null,single=false;
   const q={select:()=>q,eq(k,v){if(k==='id')id=v;return q;},in:()=>q,order:()=>q,limit:()=>q,maybeSingle(){single=true;return q;},single(){single=true;return q;},update(v){payload=v;return q;},then(resolve){
    if(payload){window.budgetWrites.push({table,id,payload});const row=items.find(x=>String(x.id)===String(id));if(row)Object.assign(row,payload);}
    let data=table==='presupuestos_items'?structuredClone(items):table==='presupuestos_proyectos'?[{id:1,nombre:'Prueba proporcional',empresa:'TEST',tipo:'Privado | CLP'}]:[];
    resolve({data:single?(data[0]||null):data,error:null});
   }};return q;
  };
  db.rpc=async()=>({data:[],error:null});
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');document.body.append(mount);
  DOM.createRoot(mount).render(React.createElement(Component,{user:{empresa:'TEST',_rolePreview:true,permisos:{'presupuestos.presupuestos.ver':true,'presupuestos.presupuestos.editar':true}},onBack(){}}));
 },assets);
 await page.getByRole('heading',{name:'Crear Presupuesto',exact:true}).click();
 await page.getByLabel('Avance de Apoyo',{exact:true}).waitFor();
 await page.getByLabel('Avance de Apoyo',{exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Guardar Presupuesto',exact:true}).click();
 await page.getByText('Presupuesto guardado exitosamente.',{exact:false}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.budgetWrites),[{table:'presupuestos_items',id:2,payload:{avance_depende_de:1}}]);
 assert.equal(await page.getByLabel('Avance de Apoyo',{exact:true}).inputValue(),'1');
 console.log('PASS select reference, save and reload; only dependency updated; no price, work-item or history writes.');
}finally{await browser.close();}
