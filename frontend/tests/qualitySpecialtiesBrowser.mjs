import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
 create table obras(id integer primary key,empresa text,nombre text);
 create table usuarios(auth_user_id uuid,empresa text,nombre text,usuario text);
 create table partidas_obra(id integer primary key,obra_id integer,empresa text,partida text,es_titulo boolean);
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $2=1$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select true$$;
 insert into obras values(1,'TEST','Obra de prueba');
 insert into partidas_obra values(1,1,'TEST','Pilas existentes',false),(2,1,'TEST','Hormigón losa',false),(3,1,'TEST','Excavación',false);
 insert into usuarios values('00000000-0000-4000-8000-000000000001','TEST','Tester','t');`);
await db.exec(await readFile(new URL('../../supabase/schema/quality-specialties.sql',import.meta.url),'utf8'));
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 await db.exec('begin');
 let pileSettings=[];const nativeWrites=[];
 const page=await browser.newPage({viewport:{width,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',async route=>{
  if(route.request().url().includes('/rpc/quality_specialties_api')){
   const p=route.request().postDataJSON();
   try{const r=await db.query('select public.quality_specialties_api($1,$2,$3) r',[p.p_work,p.p_action,JSON.stringify(p.p_data)]);await route.fulfill({json:r.rows[0].r});}
   catch(e){await route.fulfill({status:400,json:{message:e.message}});}
  }else if(route.request().url().includes('/rpc/specialty_api')){
   const p=route.request().postDataJSON();
   if(p.p_action==='configure'){nativeWrites.push(p.p_data);pileSettings=[{partida_id:p.p_data.partida_id,activa_desde:p.p_data.activa_desde,revision:1,datos_fijos:{}}];await route.fulfill({json:{ok:true}});}
   else await route.fulfill({json:{actor:'test',settings:pileSettings,elements:[],sessions:[],protocols:[],users:[],can_configure:true,can_import:true}});
  }else await route.abort();
 });
 const html=await server.transformIndexHtml('/','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
 await page.route(server.resolvedUrls.local[0],r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{
  await import('/src/index.css');const React=await import('/node_modules/.vite/deps/react.js'),DOM=await import('/node_modules/.vite/deps/react-dom_client.js');
  const Component=(await import('/src/components/QualitySpecialties.jsx')).default;
  document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);
  (DOM.default||DOM).createRoot(mount).render((React.default||React).createElement(Component,{work:{id:1,nombre:'Obra de prueba'},user:{empresa:'TEST'},parts:[{id:1,partida:'Pilas existentes',unidad:'UND'},{id:2,partida:'Hormigón losa',unidad:'m³'},{id:3,partida:'Excavación',unidad:'m³'}]}));
 });
 await page.getByText('Esta obra no tiene especialidades configuradas.').waitFor();
 assert.equal(await page.getByRole('button',{name:'Topografía pendiente',exact:true}).count(),0);
 assert.equal(await page.getByLabel('Especialidad',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Configurar especialidad',exact:true}).click();
 assert.equal(await page.getByLabel('Nombre de la especialidad',{exact:true}).count(),0);
 assert.equal(await page.locator('select').filter({has:page.locator('option[value="1"]')}).locator('option').count(),1,'Only compatible unit part appears for native setup');
 await page.getByRole('button',{name:'Guardar configuración de especialidad',exact:true}).click();
 await page.getByRole('button',{name:'Configurar especialidad y cargar coordenadas'}).waitFor();
 assert.equal(nativeWrites.length,1);
 assert.equal(nativeWrites[0].partida_id,1);
 assert.equal(await page.locator('select').filter({has:page.locator('option[value="1"]')}).locator('option').count(),1,'Native protocols only show configured parts');
 await page.getByRole('button',{name:'Agregar especialidad',exact:true}).click();
 await page.getByLabel('Especialidad a configurar',{exact:true}).selectOption('new');
 await page.getByLabel('Nombre de la especialidad',{exact:true}).fill(`Hormigón ${width}`);
 await page.getByRole('checkbox',{name:'Hormigón losa · m³'}).check();
 await page.getByRole('button',{name:'Guardar especialidad y partidas'}).click();
 await page.getByRole('button',{name:'Agregar tipo de protocolo'}).click();
 await page.getByLabel('Nombre del tipo de protocolo').fill('Recepción de hormigón');
 await page.getByLabel('Controles del protocolo (uno por línea)').fill('Dimensiones\nTerminación');
 await page.getByRole('button',{name:'Guardar formato',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Formato guardado'}).waitFor();
 await page.getByLabel('Partida',{exact:true}).selectOption('2');
 assert.equal(await page.getByLabel('Partida',{exact:true}).locator('option').count(),2,'Only linked part is selectable');
 await page.getByRole('button',{name:'Crear protocolo',exact:true}).click();
 await page.getByLabel('Resultado · Dimensiones',{exact:true}).selectOption('Conforme');
 await page.getByLabel('Resultado · Terminación',{exact:true}).selectOption('No aplica');
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Protocolo #1 guardado'}).waitFor();
 await page.getByRole('button',{name:'Editar formato',exact:true}).click();
 await page.getByLabel('Controles del protocolo (uno por línea)').fill('Control nuevo');
 await page.getByRole('button',{name:'Guardar formato',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Formato guardado'}).waitFor();
 await page.getByRole('button',{name:'Ver / editar protocolo'}).click();
 assert.equal(await page.getByLabel('Resultado · Dimensiones',{exact:true}).inputValue(),'Conforme','Saved protocol retains original controls');
 await page.getByRole('button',{name:'Aprobar protocolo',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Protocolo #1 aprobado'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF'}).click();
 await (await download).saveAs(`C:/Users/ignac/AppData/Local/Temp/quality-specialty-${width}.pdf`);
 await page.screenshot({path:`C:/Users/ignac/AppData/Local/Temp/quality-specialty-${width}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No mobile overflow');
 await page.getByLabel('Especialidad',{exact:true}).selectOption('pilas_grava');
 await page.getByRole('button',{name:'Configurar especialidad y cargar coordenadas'}).waitFor();
 assert.deepEqual(errors,[]);console.log(`PASS ${width}: create specialty/link part/configure format/create/edit/approve/PDF/return to piles`);
 await page.close();
 await db.exec('rollback');
 }}finally{await browser.close();await server.close();await db.close();}
