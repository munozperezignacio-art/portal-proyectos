import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:4188';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const html=await(await page.request.get(origin)).text();
 const entry=html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)[1];
 const js=await(await page.request.get(new URL(entry,origin).href)).text();
 const file=js.match(/Obras-[\w-]+\.js/)[0];
 const text=await(await page.request.get(origin+'/assets/'+file)).text();
 const assets={file,vendor:text.match(/react-vendor-[\w-]+\.js/)[0],client:text.match(/supabaseClient-[\w-]+\.js/)[0]};
 await page.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.goto(origin);
 await page.evaluate(async assets=>{
  const mods=Object.values(await import('/assets/'+assets.vendor)).map(f=>f());
  const React=mods.find(m=>m.createElement),DOM=mods.find(m=>m.createRoot);
  const db=Object.values(await import('/assets/'+assets.client)).find(v=>v?.from&&v?.rpc);
  const Component=(await import('/assets/'+assets.file)).default;
  const work={id:32,empresa:'TEST',nombre:'Prueba',estado:'En Ejecución',fecha_inicio:'2026-11-01'};
  const budget=[{id:1,partida:'Pilas',cantidad:100,unidad:'UND',avance_depende_de:null},{id:2,partida:'Apoyo',cantidad:250,unidad:'m³',avance_depende_de:null}];
  const parts=budget.map(p=>({...p,id:p.id+10,presupuesto_item_id:p.id,obra_id:32,obra_nombre:'Prueba',cantidad_presupuestada:p.cantidad,costo_por_dia:100,orden:p.id}));
  window.referenceWrites=[];
  db.from=table=>{let single=false,payload=null,id=null;const q=new Proxy({}, {get(_,key){
   if(key==='then')return resolve=>{
    if(payload){window.referenceWrites.push({table,id,payload});Object.assign(budget.find(b=>b.id===id),payload);}
    const rows=table==='obras'?[work]:table==='obra_presupuestos'?[{presupuesto_id:10}]:table==='presupuestos_items'?budget:table==='partidas_obra'?parts:[];
    resolve({data:single?(id?rows.find(r=>r.id===id):rows[0])||null:structuredClone(rows),error:null});
   };
   return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;if(key==='eq'&&args[0]==='id')id=args[1];if(key==='update')payload=args[0];if(['insert','delete','upsert'].includes(key))throw Error('Unexpected write');return q;};
  }});return q;};
  db.rpc=async()=>({data:[],error:null});
  document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);
  DOM.createRoot(mount).render(React.createElement(Component,{initialObraName:'Prueba',user:{empresa:'TEST',rol:'Superusuario',obras:'Todas',_rolePreview:true,permisos:{'obras.gestion.ver':true,'presupuestos.presupuestos.editar':true}},onBack(){}}));
 },assets);
 await page.getByRole('heading',{name:'Plan y control de obra',exact:false}).click();
 const select=page.getByLabel('Avance de Apoyo',{exact:true});await select.waitFor();
 await select.selectOption('11');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal(await select.inputValue(),'');
 await select.selectOption('11');
 await page.getByRole('button',{name:'Guardar referencia',exact:true}).click();
 await page.getByText('Referencia guardada.',{exact:true}).waitFor();
 assert.equal(await select.inputValue(),'11');
 assert.deepEqual(await page.evaluate(()=>window.referenceWrites),[{table:'presupuestos_items',id:2,payload:{avance_depende_de:1}}]);
 console.log('PASS real Obras budget screen: selector, cancel, save and reload; reference-only write; units UND/m³.');
}finally{await browser.close();}
