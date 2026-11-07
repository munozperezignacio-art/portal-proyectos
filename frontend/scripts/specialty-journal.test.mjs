import test from 'node:test';
import assert from 'node:assert/strict';
import {createJournalStore,pileDiagram} from '../../mobile/src/lib/specialtyJournal.mjs';
test('offline reload and uncertain responses reuse one request and close once',async()=>{
 const memory=new Map(),seen=new Map();let offline=true,calls=0,closes=0;
 const options={scope:'company:user:work:part',uuid:()=>String(++calls),storage:{getItem:async k=>memory.get(k)||null,setItem:async(k,v)=>memory.set(k,v)},send:async(action,data)=>{
  if(offline)throw new Error('offline');
  if(seen.has(data.request_id))return seen.get(data.request_id);
  const value={revision:data.revision+1};seen.set(data.request_id,value);if(action==='close')closes++;
  if(seen.size===1)throw new Error('response lost');return value;
 }};
 let journal=createJournalStore(options);await journal.edit({id:'session',revision:0,datos:{pilas:[]}});
 await assert.rejects(journal.sync(),/offline/);offline=false;
 journal=createJournalStore(options);await assert.rejects(journal.sync(),/lost/);
 await journal.sync();assert.equal(calls,1);
 await journal.close();await journal.sync();await journal.sync();assert.equal(closes,1);assert.equal((await journal.read()).draft,undefined);
});
test('coordinates retain aspect ratio and distinguish the day',()=>{
 const points=pileDiagram([{id:'1',este:0,norte:0},{id:'2',este:10,norte:10}],['2']);
 assert.equal(points[1].x-points[0].x,points[0].y-points[1].y);assert.equal(points[1].status,'day');
});
test('confirmed validation failure unlocks closure without losing the draft',async()=>{
 const memory=new Map();let reject=true,calls=0;
 const journal=createJournalStore({scope:'validation',uuid:()=>String(++calls),storage:{getItem:async k=>memory.get(k)||null,setItem:async(k,v)=>memory.set(k,v)},send:async()=>{if(reject)throw Object.assign(new Error('Completa longitud'),{code:'P0001'});return {revision:1};}});
 await journal.edit({id:'session',datos:{pilas:[{id:'pile',longitud:''}]}});await journal.close();
 await assert.rejects(journal.sync(),/Completa/);
 const state=await journal.read();assert.equal(state.draft.closeRequested,false);assert.equal(state.inFlight,undefined);assert.equal(state.draft.datos.pilas.length,1);
 await journal.edit({...state.draft,datos:{pilas:[{id:'pile',longitud:6}]}});reject=false;
 await journal.close();await journal.sync();assert.equal(calls,2);assert.equal((await journal.read()).draft,undefined);
});
