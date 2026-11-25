import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyCashForecast} from './monthlyCashForecast.js';
const business = d => ![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay());
const part = {id:1,partida:'Pilas',cantidad:100,pu:10,scheduledStart:'2026-11-02',duracion_programada:10};
const run = extra => monthlyCashForecast({parts:[part],reports:[],cutoff:'2026-11-20',marginRatio:0.2,isBusinessDay:business,...extra});
test('no reports: programme, month-end, finite quantity, costs = sales minus margin',()=>{
 const result=run({});
 assert.equal(result.rows.reduce((s,r)=>s+r.ingreso,0),1000);
 assert.equal(result.rows.reduce((s,r)=>s+r.egreso,0),800);
 assert.equal(result.rows[0].close,'2026-11-30');
 assert.equal(result.rows[1].close,'2026-12-31');
});
test('five closed business days include missing reports; today is not in the trend',()=>{
 const reports=[{partida_id:1,cantidad:10,fecha:'2026-11-19'},{partida_id:1,cantidad:20,fecha:'2026-11-20'}];
 const before=structuredClone(reports);
 const result=run({reports});
 assert.deepEqual(result.recent,['2026-11-19','2026-11-18','2026-11-17','2026-11-16','2026-11-13']);
 assert.equal(result.rows[0].ingreso,420); // 30 done + six future working days * 2
 assert.equal(result.rows.reduce((s,r)=>s+r.ingreso,0),1000);
 assert.deepEqual(reports,before);
});
test('no recent production does not manufacture completion; unknown margin stays unknown',()=>{
 const result=run({reports:[{partida_id:1,cantidad:10,fecha:'2026-11-02'}],marginRatio:null});
 assert.equal(result.rows[0].ingreso,100);
 assert.equal(result.rows[0].egreso,null);
 assert.equal(result.warnings.length,1);
});
test('overproduction and future reports never exceed quantity; negative margin preserved',()=>{
 const result=run({reports:[{partida_id:1,cantidad:150,fecha:'2026-11-19'},{partida_id:1,cantidad:80,fecha:'2026-12-01'}],marginRatio:-0.1});
 assert.equal(result.rows.reduce((s,r)=>s+r.ingreso,0),1000);
 assert.equal(result.rows[0].egreso,1100);
});
