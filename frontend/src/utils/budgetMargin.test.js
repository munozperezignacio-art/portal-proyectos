import test from 'node:test';
import assert from 'node:assert/strict';
import {marginIndicators,validBudgetMargin} from './budgetMargin.js';
import {forecastModel} from './forecastModel.js';
import {targetProjection} from './targetProjection.js';
test('CPI consumes or increases budget margin without adding fictitious costs',()=>{
 for(const cost of [80e6,85e6,75e6]){
  const m=marginIndicators({margin:20,sale:100e6,earnedSale:100e6,actualCost:cost,estimatedCost:cost});
  assert.equal(m.costBudget,80e6);assert.equal(m.cpi,80e6/cost);assert.equal(m.variance,80e6-cost);
  assert.ok(Math.abs(m.projectedMargin-(100-cost/1e6))<1e-10);
 }
 const partial=marginIndicators({margin:20,sale:100e6,earnedSale:50e6,actualCost:40e6});
 assert.equal(partial.cpi,1);assert.equal(partial.earnedCost,40e6);
 for(const margin of [null,undefined,'',-1,100,Infinity,NaN])assert.equal(validBudgetMargin(margin),false);
 assert.equal(marginIndicators({margin:null,sale:100,earnedSale:50,actualCost:30}).cpi,null);
 assert.equal(marginIndicators({margin:0,sale:100,earnedSale:50,actualCost:50}).cpi,1);
 assert.equal(marginIndicators({margin:20,sale:100,earnedSale:50,actualCost:0}).cpi,null);
 assert.equal(marginIndicators({margin:20,sale:100,earnedSale:50,actualCost:30,costError:true}).cpi,null);
});
test('forecast and target use the same margin baseline',()=>{
 const costBudget=marginIndicators({margin:20,sale:1000}).costBudget;
 const forecast=forecastModel({cutoff:'2026-10-05',baselineFinish:'2026-10-30',actualProgress:50,plannedProgress:50,actualCost:400,costBudget});
 assert.equal(forecast.cpi,1);assert.equal(forecast.baseCost,800);
 const input={parts:[{id:1,partida:'A',quantity:100,unitPrice:10,start:'2026-10-01',finish:'2026-10-30'}],cutoff:'2026-10-05',date:'2026-10-30',baselineFinish:'2026-10-30',actualCost:400,futureCosts:[{fecha:'2026-10-06',monto:400}],coverage:true,costBudget,budgetMargin:20};
 const target=targetProjection(input);assert.equal(target.bac,800);assert.equal(target.ev,800);assert.equal(target.cpi,1);assert.equal(target.ac,800);assert.equal(target.margin,20);
 assert.equal(targetProjection({...input,budgetMargin:null,budgets:{1:1000}}).cpi,null);
 assert.equal(targetProjection({...input,coverage:false}).cpi,null);
});
