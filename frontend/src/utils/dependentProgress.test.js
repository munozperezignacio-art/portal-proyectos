import test from 'node:test';
import assert from 'node:assert/strict';
import {dependentProgress,resolveWorkDependencies,inheritProgressPlan} from './dependentProgress.js';
const parts=[{id:1,partida:'Pilas',unidad:'UND',cantidad:100},{id:2,partida:'Apoyo',unidad:'m³',cantidad:250,avance_depende_de:1},{id:3,partida:'Control',unidad:'GL',cantidad:1,avance_depende_de:2}];
test('different units, chained proportional quantities, dates and unchanged history',()=>{
 const reports=[{id:1,partida_id:1,cantidad:40,created_at:'2026-11-01'},{id:2,partida_id:1,cantidad:10,created_at:'2026-11-02'}];
 const before=JSON.stringify(reports);const result=dependentProgress(parts,reports);
 assert.equal(result.filter(r=>r.partida_id===2).reduce((s,r)=>s+r.cantidad,0),125);
 assert.equal(result.filter(r=>r.partida_id===3).reduce((s,r)=>s+r.cantidad,0),0.5);
 assert.equal(result.find(r=>r.partida_id===2).created_at,'2026-11-01');
 assert.equal(JSON.stringify(reports),before);
 assert.equal(dependentProgress(parts,[]).length,0);
});
test('reject cycles and zero source; corrections propagate without rounding',()=>{
 assert.throws(()=>dependentProgress([{...parts[0],avance_depende_de:2},parts[1]],[]),/circular/);
 assert.throws(()=>dependentProgress([{...parts[0],cantidad:0},parts[1]],[]),/positiva/);
 const r=dependentProgress(parts,[{id:1,partida_id:1,cantidad:-2}]);assert.equal(r.find(x=>x.partida_id===2).cantidad,-5);
});
test('legacy work items resolve only unique exact names and inherit source schedule',()=>{
 const work=[{id:10,partida:'Pilas',cantidad:100,rendimiento_meta:20,fecha_inicio:'2026-11-01',fecha_termino:'2026-11-05'},{id:20,partida:'Apoyo',cantidad:250}];
 const budget=[parts[0],parts[1]];
 const resolved=resolveWorkDependencies(work,budget);
 assert.equal(resolved[1].avance_depende_de,10);
 const planned=inheritProgressPlan(resolved);
 assert.equal(planned[1].rendimiento_meta,50);
 assert.equal(planned[1].fecha_termino,'2026-11-05');
 assert.throws(()=>resolveWorkDependencies([work[1]],budget),/referencia/);
 assert.throws(()=>resolveWorkDependencies(work,[...budget,{...parts[1],id:9}]),/coincidencia/);
});
