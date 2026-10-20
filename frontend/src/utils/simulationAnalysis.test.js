import test from 'node:test';import assert from 'node:assert/strict';
import {simulationAnalysis} from './simulationAnalysis.js';
const input={cutoff:'2026-10-19',start:'2026-10-20',end:'2026-11-30',deadline:'2026-11-30',actualCost:100,parts:[{id:'1',name:'Pilas',remaining:100,pace:10,start:'2026-10-20',overrides:{'2026-10-20':0}}],resources:[{id:'1',name:'Equipo',mode:'workday',rate:100,quantity:1,start:'2026-10-20'}]};
test('sensibilidad reconcilia costos, conserva reales y no muta supuestos',()=>{
 const before=JSON.stringify(input),r=simulationAnalysis(input,{variation:20,costBudget:1200});
 assert.ok(r.scenarios[0].result.finish>r.base.finish);
 assert.ok(r.scenarios[2].result.finish<r.base.finish);
 assert.ok(r.scenarios[0].result.futureCost>r.base.futureCost);
 for(const s of r.scenarios){
  assert.equal(s.result.days[0].production['1'],0);
  assert.equal(s.result.totalAtFinish,100+s.result.futureCost);
  assert.equal(s.variance,s.result.totalAtFinish-1200);
 }
 assert.equal(JSON.stringify(input),before);
});
test('horizonte y costos desconocidos no producen comparación falsa',()=>{
 const r=simulationAnalysis({...input,end:'2026-10-21',deadline:'2026-10-21',costError:'Error'});
 assert.ok(r.scenarios.every(s=>s.result.totalAtFinish==null&&s.variance==null));
 assert.throws(()=>simulationAnalysis(input,{variation:100}),/0 y 50/);
});
