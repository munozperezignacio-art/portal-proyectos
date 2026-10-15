import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastModel } from './forecastModel.js';
const input={cutoff:'2026-10-15',baselineFinish:'2026-11-10',actualProgress:25,plannedProgress:40,actualCost:200000,costBudget:1000000,holidays:['2026-11-02']};
test('no actual costs or no cost budget means unknown cost, not zero overrun',()=>{
  for(const changes of [{actualCost:0},{costBudget:0},{costError:'Falló carga'}]) {
    const m=forecastModel({...input,...changes});assert.equal(m.baseCost,null);assert.equal(m.overrun,null);assert.equal(m.cpi,null);assert.deepEqual(m.cashflow,[]);
  }
});
test('CPI and EAC use cost budget, cost records and progress; conserve remaining flow',()=>{
  const m=forecastModel(input);assert.equal(m.cpi,1.25);assert.equal(m.baseCost,800000);assert.equal(m.cashflow.reduce((s,r)=>s+r.amount,0),600000);assert.ok(m.cashflow.every(r=>/^2026-\d{2}$/.test(r.month)));assert.equal(m.scenarios.length,1);
});
test('honors holidays and no arbitrary favorable/adverse factors',()=>{
  const m=forecastModel({...input,holidays:['2026-11-20']}), other=forecastModel({...input,holidays:['2026-01-01']});assert.notEqual(m.finish,other.finish);assert.equal(m.spi,0.625);
});
test('missing schedule, expired baseline and unavailable calendar never fabricate a date',()=>{
  assert.equal(forecastModel({...input,plannedProgress:0}).finish,null);
  assert.equal(forecastModel({...input,baselineFinish:'2026-10-01'}).finish,null);
  const m=forecastModel({...input,baselineFinish:'2027-02-01'});assert.equal(m.finish,null);assert.ok(m.calendarWarning);assert.deepEqual(m.cashflow,[]);
});
