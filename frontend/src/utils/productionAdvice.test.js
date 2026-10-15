import test from 'node:test';
import assert from 'node:assert/strict';
import {productionAdvice} from './productionAdvice.js';
const input={cutoff:'2026-10-09',baselineFinish:'2026-10-16',parts:[{id:1,partida:'Pilotes',unidad:'UND',quantity:100,start:'2026-10-01',finish:'2026-10-16',actualCost:1000}],reports:[{partida_id:1,partida:'Pilotes',fecha:'2026-10-05',cantidad:10},{partida_id:1,fecha:'2026-10-09',cantidad:10}],costs:[{fecha:'2026-10-09',tipo_costo:'Equipos',monto:1000}]};
test('actionable daily target uses quantities and working days, not mixed units',()=>{
 const a=productionAdvice(input),r=a.rows[0];assert.equal(r.remaining,80);assert.equal(r.pace,4);assert.equal(r.required,16);assert.equal(r.increase,300);assert.equal(r.unitCost,50);assert.equal(r.status,'accelerate');assert.equal(a.availableDays,5);assert.equal(a.costDrivers[0].amount,1000);
});
test('future reports excluded, holiday reduces available days, missing production never invents finish',()=>{
 const a=productionAdvice({...input,holidays:['2026-10-12'],reports:[{partida_id:1,fecha:'2026-10-20',cantidad:100}]});
 assert.equal(a.rows[0].remaining,100);assert.equal(a.rows[0].pace,0);assert.equal(a.rows[0].required,25);assert.equal(a.rows[0].finishAtPace,null);assert.equal(a.rows[0].status,'no-production');
});
test('cost loading failures suppress both unit costs and cost rankings',()=>{
 const a=productionAdvice({...input,costError:'missing ledger'});assert.deepEqual(a.costDrivers,[]);assert.equal(a.rows[0].unitCost,null);
});
test('own deadline is honored and reporting on non-working days counts',()=>{
 const a=productionAdvice({...input,cutoff:'2026-10-10',parts:[{...input.parts[0],finish:'2026-10-09'}],reports:[...input.reports,{partida_id:1,fecha:'2026-10-10',cantidad:5}]});
 assert.equal(a.rows[0].completed,25);assert.equal(a.rows[0].days,0);assert.equal(a.rows[0].status,'deadline');assert.ok(a.recentDates.includes('2026-10-10'));
});
