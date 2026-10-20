import test from 'node:test';import assert from 'node:assert/strict';
import {activeWorkerCenter,workerAdditionalCenters,workerAssignedToWork,workerAssignmentDestinations}from'./workerCenters.js';
const worker={id:1,empresa:'TEST',obra_nombre:'Principal',centro_gestion_id:10};
const link={id:1,empresa:'TEST',trabajador_id:1,centro_gestion_id:20,centro_nombre:'Otra obra',fecha_inicio:'2026-10-01',fecha_termino:null,centro_activo:true};
test('worker belongs to principal and additional works with one identity',()=>{
  assert.equal(workerAssignedToWork(worker,{nombre:'Principal',empresa:'TEST',centro_gestion_id:10},[link],'2026-10-19'),true);
  assert.equal(workerAssignedToWork(worker,{nombre:'Otra obra',empresa:'TEST',centro_gestion_id:20},[link],'2026-10-19'),true);
  assert.equal(workerAssignedToWork(worker,{nombre:'Ajena',empresa:'OTRA',centro_gestion_id:20},[link],'2026-10-19'),false);
});
test('dates inclusive; inactive, future, past and foreign links do not confer membership',()=>{
  assert.equal(activeWorkerCenter({...link,fecha_termino:'2026-10-19'},'2026-10-19'),true);
  for(const invalid of [{...link,centro_activo:false},{...link,fecha_inicio:'2026-10-20'},{...link,fecha_termino:'2026-10-18'},{...link,empresa:'OTRA'}])assert.equal(workerAdditionalCenters(worker,[invalid],'2026-10-19').length,0);
});
test('principal and repeated memberships do not duplicate badges; ended contract not eligible in additional work',()=>{
  assert.equal(workerAdditionalCenters(worker,[link,link,{...link,centro_gestion_id:10}],'2026-10-19').length,1);
  assert.equal(workerAssignedToWork({...worker,fecha_vencimiento_contrato:'2026-10-18'},{empresa:'TEST',nombre:'Otra',centro_gestion_id:20},[link],'2026-10-19'),false);
});
test('unified destinations show a center even without a primary work',()=>{
  const destinations=workerAssignmentDestinations({id:1,empresa:'TEST'},[],[link],'2026-10-19');
  assert.equal(destinations.length,1);
  assert.equal(destinations[0].name,'Otra obra');
  assert.equal(destinations[0].primary,false);
});
test('unified destinations preserve primary, exclude foreign centers, and deduplicate additional ones',()=>{
  const destinations=workerAssignmentDestinations(worker,[{id:10,empresa:'TEST',codigo:'10',nombre:'Principal'}],[link,link,{...link,centro_gestion_id:10}],'2026-10-19');
  assert.equal(destinations.length,2);
  assert.equal(destinations[0].primary,true);
  assert.equal(destinations[0].name,'10 · Principal');
  assert.equal(workerAssignmentDestinations({id:1,empresa:'TEST',centro_gestion_id:10},[{id:10,empresa:'OTHER',nombre:'Foreign'}],[]).length,0);
});
