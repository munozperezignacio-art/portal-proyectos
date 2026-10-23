import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {ENEX_PERMISSION,allowedMailPermission,enexMailRequest,enexMailContent} from '../../supabase/functions/enviar-correo-sistema/enex-mail.js';
import {renderEnexMail} from '../../supabase/functions/enviar-correo-sistema/enex-mail-template.js';
import {emailRecipientLists} from '../../supabase/functions/enviar-correo-sistema/recipients.js';
const id='00000000-0000-0000-0000-000000000003';
const row={id,empresa:'TEST_A',portal:'transporte',occurred_local:'2026-01-02T03:04:05',kind:'Carga',liters_milli:12345,amount_signed:-18000,currency:null,tax_breakdown:null,enex_assignments:[]};
const body={permissionKey:ENEX_PERMISSION,to:'person@example.test',enexCompany:'TEST_A',enexMovementIds:[id],htmlContent:'<script>client untrusted</script>',subject:'untrusted'};
const profile={empresa:'TEST_A',correo:'person@example.test',rol:'admin',rol_base:'admin',permisos:{[ENEX_PERMISSION]:true}};
test('fuel mail shares Obraxis branding and escapes movement details',()=>{
 const result=renderEnexMail('TEST',[{...row,vehicle:'<img onerror=bad>',document:'123'}],1,[row.occurred_local]);
 assert.match(result.html,/obraxis-primary.png/);
 assert.match(result.html,/Movimientos incluidos/);
 assert.match(result.html,/GD\/Boleta: 123/);
 assert.match(result.html,/&lt;img onerror=bad&gt;/);
 assert.doesNotMatch(result.html,/<img onerror/);
});
function harness({profilePatch={},rows=[row],providerStatus=200,throwFetch=false,auditFailure=false}={}) {
 let handler;const requests=[];const actor={...profile,...profilePatch};
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}}),admin:{getUserById:async()=>({data:{user:{id:'actor'}}})}},from(table){return {
 select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='usuarios'?actor:{permisos:{},archivado:false}};},async gte(){return {count:0};},async in(){return {data:rows};},async insert(value){if(table==='auditoria_plataforma'){assert.ok(['exitoso','fallido','pendiente','observado'].includes(value.resultado));assert.ok(['informativo','atencion','critico'].includes(value.nivel));return {error:auditFailure?{message:'synthetic sensitive diagnostic'}:null};}return {error:null};}
 };}};
 let code=readFileSync(new URL('../../supabase/functions/enviar-correo-sistema/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 // The entrypoint uses JavaScript-compatible syntax; VM runs the actual handler on Node 22.12.
 vm.runInNewContext(code,{Deno:{env:{get:()=> 'synthetic-config'},serve:fn=>{handler=fn;}},createClient:()=>db,Response,TextEncoder,crypto:webcrypto,emailRecipientLists,ENEX_PERMISSION,allowedMailPermission,enexMailRequest,enexMailContent,renderEnexMail,
 fetch:async(url,options)=>{requests.push({url,...options});if(throwFetch)throw Error('synthetic transport failure');return new Response(JSON.stringify({id:'fake-provider-id'}),{status:providerStatus});}});
 return {requests,run:async(payload=body)=>handler(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify(payload)}))};
}
test('only exact new permission expands existing allowlist',()=>{assert.equal(allowedMailPermission(ENEX_PERMISSION),true);for(const key of ['maquinaria.uso.enviar','maquinaria.enex.importar','maquinaria.enex.enviar.extra'])assert.equal(allowedMailPermission(key),false);assert.equal(allowedMailPermission('obras.maquinaria.enviar'),true);});
test('Enex success reads persisted rows and discards supplied HTML',async()=>{const h=harness(),r=await h.run();assert.equal(r.status,200);assert.equal(h.requests.length,1);const payload=JSON.parse(h.requests[0].body);assert.equal(payload.subject,'Obraxis | Resumen de combustible');assert.match(payload.html,/12,345/);assert.match(payload.text,/12,345 litros/);assert.doesNotMatch(payload.html,/client untrusted/);assert.deepEqual(payload.to,['person@example.test']);assert.equal(payload.from,'Obraxis <notificaciones@obraxis.cl>');assert.match(h.requests[0].headers['Idempotency-Key'],/^enex-/);});
test('admin fallback does not enable Enex sending',async()=>{const h=harness({profilePatch:{permisos:{}}});assert.equal((await h.run()).status,403);assert.equal(h.requests.length,0);});
for(const patch of [{to:'other@example.test'},{cc:['other@example.test']},{enexCompany:'TEST_B'},{attachments:[{name:'x'}]},{enexMovementIds:[]},{enexMovementIds:[id,id]}])test('reject request '+JSON.stringify(patch),async()=>{const h=harness();assert.equal((await h.run({...body,...patch})).status,403);assert.equal(h.requests.length,0);});
test('partial persistence prevents send',async()=>{const h=harness({rows:[]});assert.equal((await h.run()).status,409);assert.equal(h.requests.length,0);});
test('foreign tenant prevents send even with faulty mock RLS',async()=>{const h=harness({rows:[{...row,empresa:'TEST_B'}]});assert.equal((await h.run()).status,409);assert.equal(h.requests.length,0);});
test('provider request has deterministic idempotency key',async()=>{const h=harness();await h.run();await h.run();assert.equal(h.requests[0].headers['Idempotency-Key'],h.requests[1].headers['Idempotency-Key']);});
test('provider failure is not retried',async()=>{const h=harness({providerStatus:503});assert.equal((await h.run()).status,502);assert.equal(h.requests.length,1);});
test('uncertain transport is not retried',async()=>{const h=harness({throwFetch:true});assert.ok((await h.run()).status>=500);assert.equal(h.requests.length,1);});
test('legacy permission/recipients unchanged',async()=>{const h=harness({profilePatch:{permisos:{}}});const r=await h.run({...body,permissionKey:'obras.maquinaria.enviar',to:'other@example.test',subject:'Legacy',htmlContent:'Legacy'});assert.equal(r.status,200);assert.equal(JSON.parse(h.requests[0].body).subject,'Legacy');assert.equal(h.requests[0].headers['Idempotency-Key'],undefined);});
test('summary escapes company XSS',()=>{const company='<script>TEST</script>';const content=enexMailContent(company,[id],[{...row,empresa:company}]);assert.doesNotMatch(content.html,/<script>/);assert.match(content.html,/&lt;script&gt;/);});

test('audit failure preserves accepted provider result and never retries',async()=>{const h=harness({auditFailure:true});const r=await h.run();const value=await r.json();assert.equal(r.status,200);assert.equal(value.success,true);assert.equal(value.id,'fake-provider-id');assert.equal(value.auditRecorded,false);assert.equal(value.warning,'AUDIT_NOT_RECORDED');assert.doesNotMatch(JSON.stringify(value),/sensitive diagnostic/);assert.equal(h.requests.length,1);});
test('audit success is explicitly reported',async()=>{const h=harness();const value=await (await h.run()).json();assert.equal(value.auditRecorded,true);assert.equal(value.warning,undefined);});

test('UTF8 formatting and stable canonical data',()=>{const a=enexMailContent('Compañía',[id],[{...row,empresa:'Compañía',ingested_at:'2026-01-02T12:00:00Z'}]);assert.match(a.html,/Compañía/);assert.match(a.text,/Asignaciones/);assert.ok(a.text.includes('$18.000'));assert.doesNotMatch(a.html,/\uFFFD/);assert.match(a.text,/2 de enero de 2026/);assert.equal(a.canonical,enexMailContent('Compañía',[id],[{...row,empresa:'Compañía'}]).canonical);});

test("approved redesigned summary has a stable distinct revision",()=>{const c=enexMailContent("TEST_A",[id],[row]);assert.equal(JSON.parse(c.canonical)[0],"enex-summary-v2");assert.equal(c.canonical,enexMailContent("TEST_A",[id],[row]).canonical);});
test('volume alert is strictly above 250 litres and missing card never means clean',()=>{
 for(const [liters_milli,count] of [[250000,0],[250001,1]]){
  const content=enexMailContent('TEST_A',[id],[{...row,liters_milli}]);
  assert.ok(content.text.includes(`${count} cargas de más de 250 litros`));
  assert.match(content.html,/falta el identificador de tarjeta/);
 }
});
