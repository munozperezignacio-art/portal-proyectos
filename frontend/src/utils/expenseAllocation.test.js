import {test} from 'node:test';import assert from 'node:assert/strict';import {weightedExpenseParts} from './expenseAllocation.js';
test('budget weighting totals 100 and excludes invalid budgets',()=>{
 const p=[{id:1,partida:'A',cantidad:3,pu:100},{id:2,partida:'B',cantidad:1,pu:100}];
 assert.deepEqual(weightedExpenseParts(p,[1,2]).map(r=>r.porcentaje),[75,25]);
 assert.equal(weightedExpenseParts(p,[2])[0].porcentaje,100);
 assert.throws(()=>weightedExpenseParts(p,[3]));
 assert.throws(()=>weightedExpenseParts([{id:1,cantidad:0,pu:10}],[1]));
 assert.equal(weightedExpenseParts([1,2,3].map(id=>({id,cantidad:1,pu:1})),[1,2,3]).reduce((s,r)=>s+r.porcentaje,0),100);
});
