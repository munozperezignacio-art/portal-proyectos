import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {parsePileWorkbook} from '../src/utils/specialtyWorkbook.js';
const file='C:/Users/ignac/Downloads/Coordenadas_Pilas_Asturias_III_RevF.xlsx';
const parsed=parsePileWorkbook(await readFile(file),{frontColumn:3});
assert.equal(parsed.catalog.length,290);assert.equal(parsed.catalog[0].frente,'TORRE A');
const db=new PGlite();
await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
 create table obras(id integer primary key,empresa text,nombre text);
 create table avances_produccion_partidas(id integer primary key,obra_id integer,empresa text,partida_id integer,frente text,created_at timestamptz,cantidad numeric,unidad text,specialty_session_id uuid);
 create table private.specialty_elements(obra_id integer,frente text);
 create table private.specialty_sessions(report_ids integer[]);
 create table private.specialty_audit(obra_id integer,actor uuid,accion text,referencia text);
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $2=1$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select coalesce(current_setting('test.deny',true),'')<>$2$$;
 create function private.specialty_api(p_work integer,p_action text,p_data jsonb) returns jsonb language plpgsql as $$declare front_name text;begin
 if exists(select 1 from private.specialty_elements where obra_id=p_work and frente=front_name) or
    exists(select 1 from public.avances_produccion_partidas where obra_id=p_work and trim(frente)=front_name)
 then return '{}';end if;return '{}';end$$;
 insert into obras values(1,'TEST','Asturias prueba'),(2,'OTRA','Otra obra');
 insert into avances_produccion_partidas values(163,1,'TEST',1,'Frente Principal','2026-11-20',4,'UND',null),(164,1,'TEST',1,'Frente Principal','2026-11-21',8,'UND',null),(165,1,'TEST',1,'Frente Principal','2026-11-22',2,'UND','00000000-0000-4000-8000-000000000002');`);
await db.exec(await readFile(new URL('../../supabase/schema/work-fronts.sql',import.meta.url),'utf8'));
const rpc=async(a,d={},w=1)=>(await db.query('select public.work_fronts_api($1,$2,$3) r',[w,a,JSON.stringify(d)])).rows[0].r;
assert.deepEqual((await rpc('list')).fronts,['Frente Principal']);
await assert.rejects(()=>rpc('create',{nombre:'TORRE A'},2),/No autorizado/);
await rpc('create',{nombre:'TORRE A'});
assert.equal((await rpc('create',{nombre:' torre   a '})).created,false);
await db.exec("set test.deny='obras.avances.editar'");
await assert.rejects(()=>rpc('correct_reports',{partida_id:1,frente:'TORRE A',reports:[{id:163,frente:'Frente Principal'}]}),/Falta permiso/);
await db.exec("set test.deny=''");
await assert.rejects(()=>rpc('correct_reports',{partida_id:1,frente:'TORRE A',reports:[{id:163,frente:'otro'}]}),/cambió/);
await assert.rejects(()=>rpc('correct_reports',{partida_id:1,frente:'TORRE A',reports:[{id:163,frente:'Frente Principal'},{id:165,frente:'Frente Principal'}]}),/vinculado/);
assert.equal((await db.query('select frente from avances_produccion_partidas where id=163')).rows[0].frente,'Frente Principal');
await db.exec('delete from private.work_fronts;delete from private.specialty_audit;');
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 await db.exec('begin');const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],imports=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{
  if(route.request().url().includes('/rpc/work_fronts_api')){
   const p=route.request().postDataJSON();try{await route.fulfill({json:await rpc(p.p_action,p.p_data,p.p_work)});}catch(e){await route.fulfill({status:400,json:{message:e.message}});}
  }else await route.abort();
 });
 await page.exposeFunction('captureCatalog',data=>{imports.push(data);return {ok:true};});
 const html=await server.transformIndexHtml('/','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{
  await import('/src/index.css');const React=await import('/node_modules/.vite/deps/react.js'),DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
  const Importer=(await import('/src/components/SpecialtyWorkbookImport.jsx')).default;const {WorkFrontInput}=await import('/src/components/WorkFronts.jsx');
  document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);const R=React.default||React;
  (DOM.default||DOM).createRoot(mount).render(R.createElement(Importer,{work:{id:1},partId:1,state:{fronts:['Frente Principal'],can_import:true},call:(_a,d)=>window.captureCatalog(d),onSaved:async()=>{},catalogOnly:true}));
  window.showFrontInput=()=>{const node=document.createElement('div');document.body.append(node);(DOM.default||DOM).createRoot(node).render(R.createElement(WorkFrontInput,{workId:1,'aria-label':'Frente de avance'}));};
 });
 await page.locator('input[type=file]').setInputFiles(file);
 await page.getByLabel('Columna del frente').selectOption('3');
 await page.getByRole('button',{name:'Crear frente «TORRE A» en esta obra',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('select[aria-label="Vincular frente TORRE A"]')?.value==='TORRE A');
 await page.getByRole('button',{name:'Cargar coordenadas',exact:true}).click();
 await page.getByText('✓ Carga de coordenadas completada').waitFor();
 assert.equal(imports[0].rows.length,290);assert(imports[0].rows.every(r=>r.frente==='TORRE A'));
 await page.getByRole('button',{name:'Corregir frente de reportes anteriores',exact:true}).click();
 await page.getByLabel('Nuevo frente de reportes').selectOption('TORRE A');
 await page.getByLabel('Corregir reporte 163',{exact:true}).check();
 assert(await page.getByLabel('Corregir reporte 165',{exact:true}).isDisabled());
 assert(await page.getByRole('button',{name:'Guardar corrección de frentes'}).isDisabled());
 await page.getByLabel(/Confirmo cambiar únicamente/).check();await page.getByRole('button',{name:'Guardar corrección de frentes'}).click();
 await page.getByText(/1 reportes corregidos/).waitFor();
 const records=(await db.query('select id,frente,cantidad from avances_produccion_partidas order by id')).rows;
 assert.equal(records[0].frente,'TORRE A');assert.equal(records[1].frente,'Frente Principal');assert.equal(Number(records[0].cantidad),4);
 await page.evaluate(()=>window.showFrontInput());await page.waitForFunction(()=>[...document.querySelectorAll('select[aria-label="Frente de avance"] option')].some(o=>o.value==='TORRE A'));
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(`PASS Asturias: 290 filas, crear frente, corregir selección, selector avance (${width}px)`);
 await page.close();await db.exec('rollback');
}}finally{await browser.close();await server.close();await db.close();}
