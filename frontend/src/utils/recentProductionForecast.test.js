import test from 'node:test';
import assert from 'node:assert/strict';
import {recentProductionForecast} from './recentProductionForecast.js';
import {forecastModel} from './forecastModel.js';
const part={id:1,partida:'A',unidad:'UND',quantity:100,start:'2026-10-01'};
const input={cutoff:'2026-10-09',parts:[part],reports:[{partida_id:1,fecha:'2026-10-05',cantidad:10},{partida_id:1,fecha:'2026-10-09',cantidad:10}]};
test('five working days include zeros; global and activity use the same finish',()=>{
 const r=recentProductionForecast(input);assert.equal(r.rows[0].pace,4);assert.equal(r.rows[0].remaining,80);assert.equal(r.finish,'2026-11-06');
 const global=forecastModel({...input,productionParts:input.parts,actualProgress:20,plannedProgress:50,baselineFinish:'2026-10-16'});assert.equal(global.finish,r.finish);
});
test('weekend reports from another activity do not alter denominator',()=>{
 const r=recentProductionForecast({...input,cutoff:'2026-10-10',reports:[...input.reports,{partida_id:2,fecha:'2026-10-10',cantidad:500}]});assert.equal(r.rows[0].pace,4);
});
test('missing production blocks global finish rather than using SPI',()=>{
 const r=recentProductionForecast({...input,parts:[part,{...part,id:2,partida:'B'}]});assert.equal(r.finish,null);assert.equal(r.unresolved.length,1);
});
test('future activities use explicit daily plan and respect start, FS predecessor and holiday',()=>{
 const r=recentProductionForecast({...input,parts:[part,{id:2,partida:'B',quantity:20,start:'2026-10-12',rendimiento:10,predecesora:'A'}],holidays:['2026-11-09']});
 assert.equal(r.rows[1].basis,'plan');assert.equal(r.rows[1].forecastStart,'2026-11-10');assert.equal(r.finish,'2026-11-11');
});
test('circular and missing dependencies do not produce a global date',()=>{
 for(const predecessor of ['Missing','A']){const r=recentProductionForecast({...input,parts:[{...part,predecesora:predecessor}]});assert.equal(r.finish,null);assert.ok(r.unresolved[0].issue);}
});
test('partial windows expose sample count and exclude future reports',()=>{
 const r=recentProductionForecast({...input,parts:[{...part,start:'2026-10-08'}],reports:[{partida_id:1,fecha:'2026-10-09',cantidad:10},{partida_id:1,fecha:'2026-10-20',cantidad:90}]});assert.equal(r.rows[0].recentDates.length,2);assert.equal(r.rows[0].pace,5);assert.equal(r.rows[0].completed,10);
});
test('SS uses actual predecessor start and invalid quantities block the overall finish',()=>{
 const r=recentProductionForecast({...input,parts:[part,{id:2,partida:'B',quantity:10,start:'2026-10-12',rendimiento:10,predecesora:'A',tipo_relacion:'SS',desfase_dias:2}]});
 assert.equal(r.rows[1].forecastStart,'2026-10-12');
 assert.equal(recentProductionForecast({...input,parts:[{...part,quantity:0}]}).finish,null);
});
