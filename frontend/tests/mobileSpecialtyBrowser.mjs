import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve('../mobile').replaceAll('\\','/');
const mocks={
 '@/theme/ThemeProvider':`import {lightColors} from '/src/lib/theme.ts';export const useTheme=()=>({colors:lightColors});export const useThemedStyles=fn=>fn(lightColors);`,
 '@react-native-async-storage/async-storage':`export default {getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v)};`,
 '@react-native-community/netinfo':`export default {fetch:async()=>({isConnected:true}),addEventListener:()=>()=>{}};`,
 'expo-crypto':`export const randomUUID=()=>crypto.randomUUID();`,
 'expo-router':`export const router={push:p=>{window.navigation=p;}};`,
 '@expo/vector-icons':`export const Ionicons=()=>null;`,
 'react-native-safe-area-context':`export {View as SafeAreaView} from 'react-native';`,
 '@/lib/supabase':`export const supabase={rpc:async(name,p)=>window.rpc(name,p),from:()=>{const filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q},order:()=>q,range:async()=>{window.filters=filters;return {data:window.answers.filter(x=>x.proyecto_nombre===filters.proyecto_nombre),error:null}}};return q;}};`,
};
const server=await createServer({configFile:false,root,optimizeDeps:{include:['react','react-dom/client','react-native-web','react-native'],exclude:Object.keys(mocks)},plugins:[{name:'test-adapters',enforce:'pre',resolveId:id=>id.startsWith('\0mock:')?id:Object.hasOwn(mocks,id)?'\0mock:'+id:null,load:id=>id.startsWith('\0mock:')?mocks[id.slice(6)]:null},react()],resolve:{alias:[...Object.keys(mocks).map(find=>({find,replacement:'\0mock:'+find})),{find:/^react-native$/,replacement:root+'/node_modules/react-native-web/dist/index.js'},{find:'@',replacement:root+'/src'}],dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[root]}}});
await server.listen();const browser=await chromium.launch({headless:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=await server.transformIndexHtml('/','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{
  const R=await import('/node_modules/.vite/deps/react.js'),D=await import('/node_modules/.vite/deps/react-dom_client.js');const React=R.default||R,DOM=D.default||D;window.React=React;window.mount=DOM.createRoot(document.getElementById('root'));
  window.elements=[{id:'A',numero:'1',etapa:'General',frente:'TORRE A',partida_id:1,revision_topografia:0,topografia:{tipo_control:'BST',deformacion:.2}},{id:'B',numero:'2',etapa:'General',frente:'TORRE A',partida_id:1,revision_topografia:0,topografia:{}}];window.configured=false;window.sent=[];
  window.rpc=async(name,p)=>{if(p.p_action==='state')return {data:{settings:window.configured?[{partida_id:1}]:[],elements:window.elements,sessions:[],protocols:[],can_execute:true,can_topography:true}};if(window.offline){window.retryId=p.p_data.request_id;return {error:{message:'Sin conexión'}};}window.sent.push(p);const el=window.elements.find(e=>e.id===p.p_data.element_id);el.topografia=p.p_data.datos;el.revision_topografia++;return {data:{revision:el.revision_topografia}};};
  const {SpecialtyJournal}=await import('/src/components/SpecialtyJournal.tsx');window.Journal=SpecialtyJournal;window.profile={id:1,empresa:'TEST',usuario:'tester',obras:'Asturias',permisos:{'obras.prevencion.ver':true}};
  window.renderJournal=key=>window.mount.render(React.createElement(SpecialtyJournal,{key,profile:window.profile,workId:1,parts:[{id:1,partida:'Pilas'}],onSaved:()=>{}}));window.renderJournal('empty');
 });
 await page.waitForTimeout(300);assert.equal(await page.getByRole('button',{name:/Pilas de grava/}).count(),0);
 await page.evaluate(()=>{window.configured=true;window.renderJournal('configured');});
 await page.getByRole('button',{name:'Pilas de grava · Ejecución',exact:true}).waitFor();
 await page.getByRole('button',{name:'Pilas de grava · Topografía',exact:true}).click();
 await page.getByRole('button',{name:'Agregar pila 2',exact:true}).click();await page.getByRole('button',{name:'Agregar pila 1',exact:true}).click();
 for(const n of [2,1]){await page.getByLabel(`Cota inicial (m) pila ${n}`,{exact:true}).fill(String(100+n));await page.getByLabel(`Cota final (m) pila ${n}`,{exact:true}).fill(String(80+n));}
 await page.evaluate(()=>window.renderJournal('recovered'));
 await page.getByRole('button',{name:'Pilas de grava · Topografía',exact:true}).click();
 await page.getByLabel('Cota final (m) pila 1',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Cota inicial (m) pila 2',{exact:true}).inputValue(),'102','Draft recovers after remount');
 await page.evaluate(()=>{window.offline=true;});
 await page.getByRole('button',{name:'Guardar jornada de topografía',exact:true}).click();
 await page.getByText(/0 pilas guardadas; 2 pendientes/).waitFor();
 await page.evaluate(()=>{window.offline=false;});
 await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/mobile-topography-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Guardar jornada de topografía',exact:true}).click();await page.getByText('2 pilas guardadas. Topografía vinculada sin sumar avance de ejecución.').waitFor();
 assert.deepEqual(await page.evaluate(()=>window.sent.map(p=>[p.p_action,p.p_data.element_id])),[['topography','B'],['topography','A']]);
 assert.equal(await page.evaluate(()=>window.sent[0].p_data.request_id===window.retryId),true,'Retry keeps the same request identity');
 assert.equal(await page.evaluate(()=>window.elements[0].topografia.tipo_control),'BST');
 await page.evaluate(async()=>{const {WorkPrevention}=await import('/src/components/WorkPrevention.tsx');window.answers=[{id:1,proyecto_nombre:'Asturias',inspector:'Tester',created_at:'2026-11-28',prevencion_formularios:{titulo:'Inspección EPP'}},{id:2,proyecto_nombre:'Otra',prevencion_formularios:{titulo:'Ajeno'}}];window.mount.render(window.React.createElement(WorkPrevention,{profile:window.profile,workName:'Asturias'}));});
 await page.getByText('Inspección EPP',{exact:true}).waitFor();assert.equal(await page.getByText('Ajeno',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.filters['prevencion_formularios.empresa']),'TEST');
 await page.getByText('Ver respuestas →',{exact:true}).click();assert.equal(await page.evaluate(()=>window.navigation.params.id),'1');
 await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/mobile-prevention-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(`PASS ${width}: specialty visibility, topography reverse order/BST preserved, scoped prevention records`);await page.close();
}}finally{await browser.close();await server.close();}
