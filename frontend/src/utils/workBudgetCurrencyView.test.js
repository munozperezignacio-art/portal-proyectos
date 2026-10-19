import test from 'node:test';import assert from 'node:assert/strict';
import {budgetPriceView,budgetViewTotals,formatBudgetViewAmount}from'./workBudgetCurrencyView.js';
const uf={partida:'Hidrosembrado',moneda_pu:'UF',pu_original:0.041,cambio_pu_clp:41183.94,pu:1688.54154,cantidad:26350};
test('switches saved prices without revaluing or modifying the work item',()=>{
  const original=structuredClone(uf);
  assert.equal(budgetPriceView(uf,{mode:'original'}).unitPrice,0.041);
  assert.equal(budgetPriceView(uf,{mode:'clp',quotes:{UF:{value:99999}}}).unitPrice,1688.54154);
  assert.deepEqual(uf,original);
  assert.equal(formatBudgetViewAmount(0.041,'UF',{unit:true}),'UF 0,04');
  assert.equal(formatBudgetViewAmount(1688.54154,'CLP',{unit:true}),'$1.688,54');
  assert.equal(formatBudgetViewAmount(1,'USD',{unit:true}),'USD 1,00');
});
test('subtotals keep mixed currencies separate and exclude heading rows',()=>{
  const parts=[{es_titulo:true,pu:99999,cantidad:100},uf,{partida:'USD',moneda_pu:'USD',pu_original:1,cambio_pu_clp:1000,pu:1000,cantidad:2},{partida:'CLP',moneda_pu:'CLP',pu:500,cantidad:1}];
  assert.deepEqual(budgetViewTotals(parts,{mode:'original'}),[{currency:'CLP',amount:500},{currency:'UF',amount:1080.3500000000001},{currency:'USD',amount:2}]);
  assert.equal(budgetViewTotals(parts,{mode:'clp'})[0].amount,26350*1688.54154+2500);
});
test('price overrides respect zero and use the saved rate instead of today’s indicator',()=>{
  assert.equal(budgetPriceView(uf,{mode:'original',overrides:{Hidrosembrado:0}}).unitPrice,0);
  assert.equal(budgetPriceView(uf,{mode:'original',overrides:{Hidrosembrado:41183.94},quotes:{UF:{value:99999}}}).unitPrice,1);
});
test('legacy imported items use project currency and a known indicator, never relabel UF as pesos',()=>{
  const imported={partida:'Importada',presupuesto_item_id:1,moneda_pu:'CLP',pu:0.041,cantidad:10};
  assert.deepEqual(budgetPriceView(imported,{mode:'original',projectCurrency:'UF'}),{currency:'UF',unitPrice:0.041});
  assert.equal(budgetPriceView(imported,{mode:'clp',projectCurrency:'UF'}).unitPrice,null);
  assert.equal(budgetPriceView(imported,{mode:'clp',projectCurrency:'UF',quotes:{UF:{value:40000}}}).unitPrice,1640);
  assert.equal(budgetViewTotals([imported],{mode:'clp',projectCurrency:'UF'})[0].amount,null);
  assert.equal(formatBudgetViewAmount(null,'CLP'),'N/D');
});
