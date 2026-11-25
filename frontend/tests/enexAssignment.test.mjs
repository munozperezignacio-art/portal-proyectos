import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssignmentDb,rpc,uid} from './fixtures/enexAssignmentDb.mjs';
test('deployed assignment RPC: two owners, no owner, tenant boundaries, persistence, duplicate protection and audit',async()=>{
 const db=await createAssignmentDb();
 try{
  const read=owner=>rpc(db,owner,'enex_my_pending',{p_company:'EMINSG'});
  assert.deepEqual((await read(1)).rows.map(r=>r.document),['TEST-DOC-1']);
  assert.deepEqual((await read(2)).rows.map(r=>r.document),['TEST-DOC-2']);
  assert.deepEqual((await read(3)).rows,[]);
  assert.deepEqual((await rpc(db,1,'enex_my_pending',{p_company:'OTHER'})).rows,[]);
  const save=(owner,id,center=1,company='EMINSG')=>rpc(db,owner,'enex_charge_center',{p_company:company,p_id:uid(id),p_center:center});
  await assert.rejects(save(1,102),/Movimiento no asignado/);
  await assert.rejects(save(1,101,1,'OTHER'),/Movimiento no asignado/);
  await assert.rejects(save(1,101,2),/Center\/company mismatch/);
  await assert.rejects(save(1,101,3),/Center\/company mismatch/);
  await save(1,101);
  assert.deepEqual((await read(1)).rows,[]);
  assert.equal((await read(2)).rows.length,1);
  await assert.rejects(save(1,101),/duplicate key/);
  assert.equal((await db.query('select * from enex_assignments')).rows.length,1);
  assert.equal((await db.query('select * from enex_assignment_audit')).rows.length,1);
  assert.equal((await db.query('select actor from enex_assignments')).rows[0].actor,uid(1));
  await save(2,102);
  assert.deepEqual((await read(2)).rows,[]);
 }finally{await db.close();}
});
