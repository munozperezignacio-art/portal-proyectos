import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetItemForWorkPart,saveWorkProgressReference} from './workProgressReference.js';
import {dependentProgress} from './dependentProgress.js';
const parts=[{id:11,presupuesto_item_id:1,partida:'Pilas',cantidad:100,unidad:'UND'},{id:12,presupuesto_item_id:2,partida:'Apoyo',cantidad:250,unidad:'m³'}];
test('work selector updates only budget reference and confirms persisted result',async()=>{
 const writes=[];
 const db={from(table){let payload;const q={select(){return q;},eq(){return q;},is(){return q;},update(p){payload=p;writes.push({table,payload});return q;},single(){return Promise.resolve({data:{id:2,...payload},error:null});},then(resolve){resolve({data:[{id:1,partida:'Pilas'},{id:2,partida:'Apoyo'}],error:null});}};return q;}};
 await saveWorkProgressReference(db,10,parts[1],parts[0],parts);
 assert.deepEqual(writes,[{table:'presupuestos_items',payload:{avance_depende_de:1}}]);
 const reports=[{id:7,partida_id:11,cantidad:50}];
 const result=dependentProgress([parts[0],{...parts[1],avance_depende_de:11}],reports);
 assert.equal(result.find(r=>r.avance_derivado).cantidad,125);
 assert.deepEqual(reports,[{id:7,partida_id:11,cantidad:50}]);
 await assert.rejects(saveWorkProgressReference(db,10,parts[0],parts[0],parts),/otra partida/);
});
test('ambiguous legacy names cannot be saved to an arbitrary budget item',()=>{
 assert.equal(budgetItemForWorkPart({partida:'Pilas'},[{id:1,partida:'Pilas'},{id:2,partida:'Pilas'}]),null);
});
