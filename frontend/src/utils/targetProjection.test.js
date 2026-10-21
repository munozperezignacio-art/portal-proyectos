import test from 'node:test';import assert from 'node:assert/strict';
import {targetProjection} from './targetProjection.js';
const input={cutoff:'2026-10-09',date:'2026-10-16',baselineFinish:'2026-10-30',parts:[{id:1,partida:'A',unidad:'UND',quantity:100,start:'2026-10-05',finish:'2026-10-30'}],reports:[{partida_id:1,fecha:'2026-10-09',cantidad:20}],targets:{1:60},budgets:{1:1000},actualCost:200,futureCosts:[{fecha:'2026-10-12',monto:200},{fecha:'2026-10-20',monto:999}],extraCost:100,coverage:true};
test('target quantities and EVM share cost budget, dates and cumulative target',()=>{
 const r=targetProjection(input);assert.equal(r.rows[0].pending,40);assert.equal(r.rows[0].required,8);assert.equal(r.rows[0].pace,4);assert.equal(r.rows[0].increase,100);
 assert.equal(r.ev,600);assert.equal(r.pv,500);assert.equal(r.ac,500);assert.equal(r.spi,1.2);assert.equal(r.cpi,1.2);assert.equal(r.cv,100);assert.equal(r.sv,100);assert.equal(r.globalPercent,60);assert.equal(r.complete,false);
});
test('holidays change available days, not target units; targets cannot undo executed production',()=>{
 const r=targetProjection({...input,holidays:['2026-10-12']});assert.equal(r.rows[0].required,10);
 assert.throws(()=>targetProjection({...input,targets:{1:19}}),/menor/);assert.throws(()=>targetProjection({...input,targets:{1:101}}),/mayor/);
});
test('no sales substitution, no fake CPI when budget or cost coverage is missing',()=>{
 const noBudget=targetProjection({...input,budgets:{}});assert.equal(noBudget.ev,null);assert.equal(noBudget.cpi,null);
 assert.equal(targetProjection({...input,coverage:false}).cpi,null);
 const mismatch=targetProjection({...input,costBudget:2000});assert.equal(mismatch.budgetMatch,false);assert.equal(mismatch.spi,null);
 assert.equal(targetProjection({...input,costError:'failed'}).ac,null);
});
test('complete target has EAC equal to target-date cost; future reports cannot change actuals',()=>{
 const r=targetProjection({...input,targets:{1:100},reports:[...input.reports,{partida_id:1,fecha:'2026-10-15',cantidad:80}]});assert.equal(r.rows[0].completed,20);assert.equal(r.complete,true);assert.equal(r.eac,r.ac);
});
test('bad dates and negative or empty percentages are rejected',()=>{
 assert.throws(()=>targetProjection({...input,date:'2026-02-30'}));assert.throws(()=>targetProjection({...input,date:'2036-10-16'}));assert.throws(()=>targetProjection({...input,targets:{1:''}}));assert.throws(()=>targetProjection({...input,extraCost:-1}));
});
