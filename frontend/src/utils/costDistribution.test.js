import {test} from 'node:test';
import assert from 'node:assert/strict';
import {costDistribution,costCategory,filterCostGroups} from './costDistribution.js';
const matches=(a,b)=>a===b;
test('category drilldown filters each part and unassigned without duplicating costs',()=>{
 const model=costDistribution([
  {monto:100,tipo_costo:'Alimentación',imputaciones:[{partida:'A',porcentaje:60}]},
  {monto:-10,tipo_costo:'Alimentación'},
  {monto:50,tipo_costo:'Personal',imputaciones:[{partida:'B',porcentaje:100}]}
 ],[{partida:'A'},{partida:'B'}],matches);
 const filtered=filterCostGroups(model.groups,'Alimentación');
 assert.deepEqual(filtered.map(g=>g.name),['A','Sin imputar a partidas']);
 assert.equal(filtered.reduce((sum,g)=>sum+g.total,0),90);
 assert.ok(filtered.every(g=>g.rows.every(r=>r.category==='Alimentación')));
 assert.equal(filterCostGroups(model.groups,null),model.groups);
 assert.equal(model.groups[1].total,50);
 assert.deepEqual(filterCostGroups(model.groups,'Inexistente'),[]);
});
test('categories and allocations reconcile with all costs including unassigned',()=>{
 const model=costDistribution([
  {monto:100,tipo_costo:'Alimentación',imputaciones:[{partida:'A',porcentaje:60}]},
  {monto:30,categoria_proyeccion:'Mano de obra',obra_liquidaciones_partidas:[{partida:'A',partida_id:1,monto_imputado:20}]},
  {monto:50,categoria_proyeccion:'Uso diario de maquinaria'}
 ],[{partida:'A'},{partida:'B'}],matches);
 assert.equal(model.total,180);
 assert.equal(model.groups[0].total,80);
 assert.equal(model.groups[1].total,0);
 assert.equal(model.groups[2].total,100);
 assert.equal(model.groups.reduce((s,g)=>s+g.total,0),180);
 assert.deepEqual(model.categories.map(c=>c.name),['Alimentación','Equipos y maquinarias','Personal']);
});
test('scoped costs retain original base for percentage without double allocation',()=>{
 const model=costDistribution([{monto:60,monto_base:100,imputaciones:[{partida:'A',porcentaje:60},{partida:'B',porcentaje:40}]}],[{partida:'A'}],matches,false);
 assert.equal(model.total,60);assert.equal(model.groups[0].total,60);assert.equal(model.groups.length,1);
});
test('preserves system categories and negative adjustments',()=>{
 assert.equal(costCategory({tipo_costo:'Traslado de equipos'}),'Traslado de equipos');
 assert.equal(costCategory({tipo_costo:'Reparaciones'}),'Reparaciones');
 assert.equal(costCategory({tipo_costo:'Maquinaria & Equipos'}),'Equipos y maquinarias');
 const model=costDistribution([{monto:-20,tipo_costo:'Materiales'}],[],matches);
 assert.equal(model.total,-20);assert.equal(model.groups[0].total,-20);
});
test('missing reports remain pending approval without losing or duplicating cost',()=>{
 const model=costDistribution([{monto:100,categoria_proyeccion:'Mano de obra',estado_imputacion_partidas:'Pendiente de aprobación: sin reporte de avance'}],[],matches);
 assert.equal(model.total,100);
 assert.equal(model.groups[0].total,0);
 assert.match(model.groups[1].name,/pendiente de aprobación/);
 assert.equal(model.groups[1].total,100);
});
