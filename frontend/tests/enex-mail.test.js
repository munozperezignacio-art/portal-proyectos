import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {ENEX_PERMISSION,allowedMailPermission,enexMailRequest,enexMailContent} from '../../supabase/functions/enviar-correo-sistema/enex-mail.js';
import {emailRecipientLists} from '../../supabase/functions/enviar-correo-sistema/recipients.js';
const id='00000000-0000-0000-0000-000000000003';
const row={id,empresa:'TEST_A',portal:'transporte',occurred_local:'2026-01-02T03:04:05',kind:'Carga',liters_milli:12345,amount_signed:-18000,currency:null,tax_breakdown:null,enex_assignments:[]};
const body={permissionKey:ENEX_PERMISSION,to:'person@example.test',enexCompany:'TEST_A',enexMovementIds:[id],htmlContent:'<script>client untrusted</script>',subject:'untrusted'};
const profile={empresa:'TEST_A',correo:'person@example.test',rol:'admin',rol_base:'admin',permisos:{[ENEX_PERMISSION]:true}};
function harness({profilePatch={},rows=[row],providerStatus=200,throwFetch=false}={}) {
 let handler;const requests=[];const actor={...profile,...profilePatch};
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}}),admin:{getUserById:async()=>({data:{user:{id:'actor'}}})}},from(table){return {
 select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='usuarios'?actor:{permisos:{},archivado:false}};},async gte(){return {count:0};},async in(){return {data:rows};},async insert(){return {error:null};}
 };}};
 let code=readFileSync(new URL('../../supabase/functions/enviar-correo-sistema/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 code=stripTypeScriptTypes(code);
 vm.runInNewContext(code,{Deno:{env:{get:()=> 'synthetic-config'},serve:fn=>{handler=fn;}},createClient:()=>db,Response,TextEncoder,crypto:webcrypto,emailRecipientLists,ENEX_PERMISSION,allowedMailPermission,enexMailRequest,enexMailContent,
 fetch:async(url,options)=>{requests.push({url,...options});if(throwFetch)throw Error('synthetic transport failure');return new Response(JSON.stringify({id:'fake-provider-id'}),{status:providerStatus});}});
 return {requests,run:async(payload=body)=>handler(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify(payload)}))};
}
test('only exact new permission expands existing allowlist',()=>{assert.equal(allowedMailPermission(ENEX_PERMISSION),true);for(const key of ['maquinaria.uso.enviar','maquinaria.enex.importar','maquinaria.enex.enviar.extra'])assert.equal(allowedMailPermission(key),false);assert.equal(allowedMailPermission('obras.maquinaria.enviar'),true);});
test('Enex success reads persisted rows and discards supplied HTML',async()=>{const h=harness(),r=await h.run();assert.equal(r.status,200);assert.equal(h.requests.length,1);const payload=JSON.parse(h.requests[0].body);assert.equal(payload.subject,'Obraxis | Resumen de combustible');assert.match(payload.html,/12.345 litros/);assert.doesNotMatch(payload.html,/client untrusted/);assert.deepEqual(payload.to,['person@example.test']);assert.equal(payload.from,'Obraxis <notificaciones@obraxis.cl>');assert.match(h.requests[0].headers['Idempotency-Key'],/^enex-/);});
test('admin fallback does not enable Enex sending',async()=>{const h=harness({profilePatch:{permisos:{}}});assert.equal((await h.run()).status,403);assert.equal(h.requests.length,0);});
for(const patch of [{to:'other@example.test'},{cc:['other@example.test']},{enexCompany:'TEST_B'},{attachments:[{name:'x'}]},{enexMovementIds:[]},{enexMovementIds:[id,id]}])test('reject request '+JSON.stringify(patch),async()=>{const h=harness();assert.equal((await h.run({...body,...patch})).status,403);assert.equal(h.requests.length,0);});
test('partial persistence prevents send',async()=>{const h=harness({rows:[]});assert.equal((await h.run()).status,409);assert.equal(h.requests.length,0);});
test('foreign tenant prevents send even with faulty mock RLS',async()=>{const h=harness({rows:[{...row,empresa:'TEST_B'}]});assert.equal((await h.run()).status,409);assert.equal(h.requests.length,0);});
test('provider request has deterministic idempotency key',async()=>{const h=harness();await h.run();await h.run();assert.equal(h.requests[0].headers['Idempotency-Key'],h.requests[1].headers['Idempotency-Key']);});
test('provider failure is not retried',async()=>{const h=harness({providerStatus:503});assert.equal((await h.run()).status,502);assert.equal(h.requests.length,1);});
test('uncertain transport is not retried',async()=>{const h=harness({throwFetch:true});assert.ok((await h.run()).status>=500);assert.equal(h.requests.length,1);});
test('legacy permission/recipients unchanged',async()=>{const h=harness({profilePatch:{permisos:{}}});const r=await h.run({...body,permissionKey:'obras.maquinaria.enviar',to:'other@example.test',subject:'Legacy',htmlContent:'Legacy'});assert.equal(r.status,200);assert.equal(JSON.parse(h.requests[0].body).subject,'Legacy');assert.equal(h.requests[0].headers['Idempotency-Key'],undefined);});
test('summary escapes company XSS',()=>{const company='<script>TEST</script>';const content=enexMailContent(company,[id],[{...row,empresa:company}]);assert.doesNotMatch(content.html,/<script>/);assert.match(content.html,/&lt;script&gt;/);});
