import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const raw=readFileSync(new URL('../../supabase/functions/enex-automation/index.ts',import.meta.url),'utf8');
function harness({authorized=true,status='imported',fetchFails=false,persistFails=false}={}) {
 let handler,sent=0;const updates=[];
 const run={id:'run',status,new_ids:['movement'],repeated:2};
 const db={rpc:async name=>name==='verify_internal_cron_secret'?{data:authorized}:{data:run},from:name=>{
  let patch;
  const chain={select:()=>patch?Promise.resolve({data:[{id:'run'}]}):chain,eq:()=>chain,in:async()=>({data:persistFails?[]:[{id:'movement'}]}),update:p=>{patch=p;updates.push(p);return chain;},then:resolve=>resolve({error:null})};return chain;
 }};
 vm.runInNewContext(raw.replace(/^import .*;\r?\n/gm,'').replace('body:unknown','body').replace(/\)!/g,')'),{
  createClient:()=>db,enexMailContent:()=>({subject:'fuel',html:'html',text:'text'}),Response,AbortSignal,Date,JSON,
  Deno:{env:{get:()=> 'configured'},serve:h=>{handler=h;}},
  fetch:async()=>{sent++;if(fetchFails)throw Error('uncertain');return {ok:true,json:async()=>({id:'provider-id'})};}
 });
 return {invoke:()=>handler(new Request('https://test',{method:'POST',body:JSON.stringify({run_id:'run',rows:[],evidence:{}})})),sent:()=>sent,updates};
}
test('unauthorized calls never import or mail',async()=>{const h=harness({authorized:false});assert.equal((await h.invoke()).status,401);assert.equal(h.sent(),0);});
test('no new, accepted, sending and uncertain runs never send again',async()=>{for(const status of ['no_new','accepted','sending','uncertain','failed']){const h=harness({status});await h.invoke();assert.equal(h.sent(),0);}});
test('persistence verified before mail',async()=>{const h=harness({persistFails:true});assert.equal((await h.invoke()).status,500);assert.equal(h.sent(),0);});
test('acceptance is stored separately from delivery',async()=>{const h=harness();const r=await (await h.invoke()).json();assert.equal(h.sent(),1);assert.equal(h.updates[0].status,'sending');assert.equal(r.status,'accepted');assert.equal(r.delivery_confirmed,false);});
test('unknown provider result is retained and not reported as success',async()=>{const h=harness({fetchFails:true});const r=await h.invoke();assert.equal(r.status,502);assert.equal(h.updates.at(-1).status,'uncertain');});
