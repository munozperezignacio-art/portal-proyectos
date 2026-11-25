import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createAssignmentDb,rpc,uid} from './fixtures/enexAssignmentDb.mjs';
import {ENEX_PENDING_PATH} from '../src/utils/enexNavigation.js';
const origin=process.argv[2] || 'http://127.0.0.1:4187';
const db=await createAssignmentDb();
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 for(const owner of [1,2,3]) {
  const context=await browser.newContext({viewport:owner===2?{width:390,height:844}:{width:1440,height:1000}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  let saveCalls=0;
  const user={id:uid(owner),email:`test${owner}@example.invalid`,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-11-25T00:00:00Z'};
  const profile={id:owner,empresa:'EMINSG',usuario:`test${owner}`,nombre:`Responsable de prueba ${owner}`,correo:user.email,rol:'Supervisor',rol_base:'Supervisor',modulos:'',obras:'',submenus:'',permisos:{}};
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.${Buffer.from('synthetic').toString('base64url')}`;
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin)return route.continue();
   if(!url.hostname.endsWith('.supabase.co'))return route.abort();
   const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/auth/v1/user')return send(user);
   if(url.pathname.endsWith('/login-usuario'))return send({access_token:token,refresh_token:'synthetic-refresh'});
   if(url.pathname.endsWith('/runtime-config'))return send({data:{mantenimiento_activo:false}});
   if(url.pathname.includes('/functions/v1/'))return send({data:[]});
   if(url.pathname.includes('/rest/v1/rpc/')){
    const name=url.pathname.split('/').at(-1);
    if(!['enex_my_pending','enex_charge_center'].includes(name))return send([]);
    try{
     const result=await rpc(db,owner,name,req.postDataJSON());
     if(name==='enex_charge_center'){
      saveCalls++;
      // Simulate an uncertain reply AFTER commit for owner 2. Never resend.
      if(owner===2)return send({message:'Synthetic lost response',code:'NETWORK'},503);
     }
     return send(result);
    }catch(e){console.error('Local RPC failed:',name,e.message);return send({message:e.message,code:e.code},400);}
   }
   const table=url.pathname.split('/').at(-1);
   const rows=table==='usuarios'?[profile]:table==='roles'?[{id:1,empresa:'EMINSG',nombre:'Supervisor',permisos:{},archivado:false}]:table==='config_empresa'?[{empresa:'EMINSG',modulos_activos:'obras',color_primario:'#1e3a8a'}]:[];
   return send(req.headers().accept?.includes('vnd.pgrst.object')?(rows[0]||null):rows);
  });
  await page.goto(origin+ENEX_PENDING_PATH);
  await page.getByPlaceholder('Ingresa tu usuario').waitFor();
  assert.equal(await page.getByRole('heading',{name:'Combustibles · Mis pendientes',exact:true}).count(),0,'signed out: no loads');
  await page.getByPlaceholder('Ingresa tu usuario').fill(`test${owner}`);
  await page.getByPlaceholder('Escribe el nombre de tu empresa (ej. Obraxis)').fill('EMINSG');
  await page.getByPlaceholder('••••••••').fill('synthetic-local-only');
  await page.locator('form button[type="submit"]').first().click();
  try { await page.getByRole('heading',{name:'Combustibles · Mis pendientes',exact:true}).waitFor(); }
  catch(e) { console.error('Synthetic test page:',await page.locator('body').innerText(),errors); throw e; }
  assert.equal(new URL(page.url()).search,'?modulo=combustibles');
  if(owner===3){
   await page.getByText('No tienes cargas pendientes.',{exact:true}).waitFor();
   assert.equal(saveCalls,0);
  }else{
   try {await page.getByText(new RegExp(`Documento TEST-DOC-${owner}`)).waitFor();}
   catch(e){console.error('Synthetic pending page:',await page.locator('body').innerText(),errors);throw e;}
   assert.equal(await page.getByText(new RegExp(`Documento TEST-DOC-${owner===1?2:1}`)).count(),0);
   await page.reload(); // Existing session and fixed destination survive reload.
   await page.getByText(new RegExp(`Documento TEST-DOC-${owner}`)).waitFor();
   await page.getByLabel('Centro de gestión').selectOption('1');
   await page.getByRole('button',{name:'Guardar asignación',exact:true}).click();
   if(owner===2){
    await page.getByRole('alert').filter({hasText:'No se pudo confirmar'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Guardar asignación',exact:true}).isEnabled(),false);
    await page.getByRole('button',{name:'Actualizar pendientes',exact:true}).click();
   }
   await page.getByText('No tienes cargas pendientes.',{exact:true}).waitFor();
   await page.reload();
   await page.getByText('No tienes cargas pendientes.',{exact:true}).waitFor();
   assert.equal(saveCalls,1);
  }
  console.log(`PASS owner ${owner}: login → personal pending → ${owner===3?'empty':owner===2?'uncertain response/reload without resend':'save/persist/reopen'}`);
  await context.close();
 }
 assert.equal((await db.query('select * from enex_assignments')).rows.length,2);
 assert.equal((await db.query('select * from enex_assignment_audit')).rows.length,2);
 assert.deepEqual(errors,[]);
 console.log('PASS: browser → actual deployed SQL in local PGlite → persistence; no production calls.');
} finally {await browser.close();await db.close();}
