import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}});
 await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:4181/');
 await page.evaluate(async()=>{
  const React=await import('/node_modules/.vite/deps/react.js');
  const DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
  const {supabase}=await import('/src/supabaseClient.js');
  window.savedDuties=[];
  supabase.rpc=async(name,p)=>{if(name!=='especialidad_responsabilidades_rol')throw Error('Unexpected RPC');if(p.p_codigos)window.savedDuties.push(p);return {data:p.p_codigos||[],error:null};};
  const Component=(await import('/src/components/SpecialtyRoleDuties.jsx')).default;
  document.getElementById('root').style.display='none';
  const mount=document.createElement('div');document.body.append(mount);
  (DOM.default||DOM).createRoot(mount).render((React.default||React).createElement(Component,{company:'TEST',role:{id:1}}));
 });
 await page.getByText('Obras · Avance por especialidad',{exact:true}).waitFor();
 const boxes=page.getByRole('checkbox');assert.equal(await boxes.count(),3);
 for(let i=0;i<3;i++)assert.equal(await boxes.nth(i).isChecked(),false);
 await page.getByLabel('Topografía de terreno',{exact:true}).check();
 await page.getByRole('button',{name:'Guardar responsabilidades de especialidad'}).click();
 await page.getByRole('status').waitFor();
 const saved=await page.evaluate(()=>window.savedDuties);
 assert.deepEqual(saved,[{p_empresa:'TEST',p_rol:1,p_codigos:['topografia'],p_esperados:[]}]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(`${width}: PASS unchecked defaults and role-scoped save`);
 await page.close();
}}finally{await browser.close();}
