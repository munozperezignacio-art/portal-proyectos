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
const commercial={...input,parts:input.parts.map(p=>({...p,unitPrice:10})),budgets:{},targets:{1:100},coverage:false};
test('full sale, cost and margin work without cost budget or confirmation',()=>{
 const r=targetProjection(commercial);
 assert.equal(r.targetSale,1000);assert.equal(r.ac,500);assert.equal(r.profit,500);assert.equal(r.margin,50);assert.equal(r.salePercent,100);assert.equal(r.cpi,null);assert.equal(r.ev,null);
 const partial=targetProjection({...commercial,targets:{1:60}});assert.equal(partial.targetSale,600);assert.equal(partial.saleSpi,1.2);
});
test('non-machinery residual estimate offsets registered forecasts without double charging',()=>{
 const r=targetProjection({...commercial,estimateRemaining:true,machineryActual:50,futureCosts:[{fecha:'2026-10-12',monto:200},{fecha:'2026-10-13',monto:300,categoria_proyeccion:'Uso diario de maquinaria'}]});
 // Other actual 150 / 20% * 80% = 600; 200 already registered; residual 400.
 assert.equal(r.residualEstimate,400);assert.equal(r.ac,1200);assert.equal(r.profit,-200);assert.equal(r.margin,-20);
 assert.equal(targetProjection({...commercial,estimateRemaining:true,machineryActual:200}).residualEstimate,0);
});
test('no invented sale, no margin with cost errors, no NaN totals',()=>{
 assert.equal(targetProjection({...commercial,parts:input.parts}).targetSale,null);
 assert.equal(targetProjection({...commercial,costError:'failed'}).profit,null);
 assert.equal(targetProjection({...commercial,futureCosts:[{fecha:'2026-10-12',monto:'bad'}]}).ac,null);
 assert.equal(targetProjection({...commercial,actualCost:NaN}).ac,null);
 const noHistory=targetProjection({...commercial,reports:[],estimateRemaining:true});assert.equal(noHistory.estimateAvailable,false);assert.equal(noHistory.residualEstimate,0);
});
