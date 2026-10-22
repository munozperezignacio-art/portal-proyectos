import test from 'node:test';
import assert from 'node:assert/strict';
import {projectedCostResources,scheduledProjectedCosts} from './projectedWorkCosts.js';
import {simulateProject} from './projectSimulator.js';
const p={id:1,partida:'Pilas',name:'Pilas',unidad:'UND',quantity:50,remaining:50,pace:10,start:'2026-10-20',finish:'2026-10-26'};
const item={id:'a',partida:'Pilas',nombre_item:'Gasto diario',tipo_proyeccion:'TIEMPO',tarifa_tiempo_dia:20000};
test('20,000 per day reaches calendar on working days, stops at completion, does not duplicate fallback',()=>{
 const input={cutoff:'2026-10-19',start:p.start,end:'2026-10-31',parts:[{...p,id:'1'}],actualCost:1000};
 const result=simulateProject({...input,resources:projectedCostResources([item],[p],p.start)});
 assert.equal(result.futureCost,100000);assert.equal(result.days.find(d=>d.date==='2026-10-20').cost,20000);assert.equal(result.days.find(d=>d.date==='2026-10-24').cost,0);
 assert.equal(result.days.find(d=>d.date==='2026-10-27').cost,0);
 assert.equal(projectedCostResources([item],[p],p.start).length,1);
 assert.match(projectedCostResources([],[p],p.start)[0].source,/predeterminada/);
});
test('monthly and consumption costs are combined; zero stays zero; saved items replace only their own part default',()=>{
 const items=[{...item,periodicidad:'Mes',tarifa_tiempo_dia:300000},{...item,id:'b',tipo_proyeccion:'INSUMO',precio_unitario_insumo:100,tasa_rendimiento_insumo:2}];
 const rows=scheduledProjectedCosts({items,parts:[p],cutoff:'2026-10-19'});
 assert.equal(rows.reduce((s,c)=>s+c.monto,0),60000);
 assert.equal(rows.filter(c=>c.fecha==='2026-10-20').reduce((s,c)=>s+c.monto,0),12000);
 const zero=projectedCostResources([{...item,tarifa_tiempo_dia:0}],[p],p.start);assert.equal(zero[0].rate,0);
 assert.equal(scheduledProjectedCosts({items:null,parts:[p],cutoff:'2026-10-19'}).length,0);
});
