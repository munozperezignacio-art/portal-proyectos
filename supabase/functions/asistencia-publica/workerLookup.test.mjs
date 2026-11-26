import test from 'node:test';
import assert from 'node:assert/strict';
import { rutKey, assignedOn, lookupWorker, readPages } from './workerLookup.mjs';
import { formatRut, validateRut } from '../../../frontend/src/utils/rutUtils.js';
const work = {empresa:'EMINSG',nombre:'Obra A'};
const worker = {id:1,empresa:'EMINSG',estado:'Activo',rut:'19.091.412-7',obra_nombre:'Obra A',fecha_asig:'2026-11-01'};
const period = {id:1,empresa:'EMINSG',trabajador_id:1,obra_nombre:'Obra A',fecha_inicio:'2026-11-12',fecha_termino:null};
const day = '2026-11-26';
test('all separators and lowercase K normalize identically in UI and server',()=>{
  for(const value of ['19.091.412-7','19091412-7','190914127','19.091.4127',' 19 091 412 - 7 ']) {
    assert.equal(rutKey(value),'190914127'); assert.equal(validateRut(value),true);
    assert.equal(formatRut(value),'19.091.412-7');
  }
  for(const value of ['9.562.247-k','9562247-K','9562247k']) {
    assert.equal(rutKey(value),'9562247K'); assert.equal(validateRut(value),true);
  }
  assert.equal(validateRut('19.091.412-8'),false);
});
test('period authorizes even when ficha lacks work; unrelated, ended, future and inactive denied',()=>{
  assert.equal(assignedOn({...worker,obra_nombre:null},[period],work,day),true);
  for(const p of [{...period,obra_nombre:'Other'},{...period,fecha_termino:'2026-11-25'}])
    assert.equal(assignedOn(worker,[p],work,day),false);
  assert.equal(assignedOn({...worker,obra_nombre:null},[{...period,fecha_inicio:'2026-12-01'}],work,day),false);
  assert.equal(assignedOn({...worker,estado:'Inactivo'},[period],work,day),false);
  assert.equal(assignedOn({...worker,empresa:'Other'},[period],work,day),false);
  assert.equal(assignedOn(worker,[period,{...period,id:2}],work,day),false);
  assert.equal(assignedOn(worker,[],work,day),true);
});
test('paginated lookup errors fail closed',async()=>{
  await assert.rejects(readPages(()=>({range:async()=>({error:new Error('db')})})),/verificar/);
  const rows=await readPages(()=>({range:async(a)=>({data:a===0?Array(500).fill(1):[2]})}));
  assert.equal(rows.length,501);
});
test('lookup matches formats and rejects ambiguous identities',async()=>{
  const dbFor=workers=>({from(table){const q={select:()=>q,eq:()=>q,ilike:()=>q,order:()=>q,range:async()=>({data:table==='maestro_personal'?workers:[period]})};return q;}});
  for(const value of ['190914127','19.091.412-7','19091412-7'])
    assert.equal((await lookupWorker(dbFor([worker]),work,value,day)).id,1);
  assert.equal(await lookupWorker(dbFor([worker,{...worker,id:2}]),work,worker.rut,day),null);
});
