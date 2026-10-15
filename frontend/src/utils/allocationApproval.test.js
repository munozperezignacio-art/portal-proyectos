import test from 'node:test';
import assert from 'node:assert/strict';
import {allocationApprovalDecisions,selectableAllocationRows} from './allocationApproval.js';
const rows=[{id:1,fecha:'2026-10-01',centro_propuesto_id:10,costo_detalle:{horas_extra:1},evidencia:{marcas:[1]},costo_evidencia:{version:1}},{id:2,fecha:'2026-10-02',centro_propuesto_id:20,haber_imponible:5000,costo_detalle:{horas_extra:2},evidencia:{marcas:[2]}}];
const options={today:'2026-10-15',commonReason:'  Revisado con supervisión  '};
test('shared reason is copied to every selected day without flattening individual destinations, hours or earnings',()=>{
 const d=allocationApprovalDecisions(rows,{1:{center:30,hours:0,comment:'individual'},2:{nonTaxable:2500}},[1,2],options);
 assert.deepEqual(d.map(r=>r.comentario),['Revisado con supervisión','Revisado con supervisión']);
 assert.deepEqual(d.map(r=>r.centro_id),[30,20]);assert.deepEqual(d.map(r=>r.horas_extra),[0,2]);assert.equal(d[1].haber_imponible,5000);assert.equal(d[1].haber_no_imponible,2500);
 assert.equal(d[0].evidencia,rows[0].evidencia);assert.equal(d[0].costo_evidencia,rows[0].costo_evidencia);
});
test('single approval keeps its own reason and does not approve unselected days',()=>{
 const d=allocationApprovalDecisions(rows,{2:{comment:'Cambio aprobado'}},[2],{today:options.today});assert.equal(d.length,1);assert.equal(d[0].comentario,'Cambio aprobado');assert.equal(d[0].id,2);
});
test('empty reason, missing destinations, future dates and stale selections block the batch',()=>{
 assert.throws(()=>allocationApprovalDecisions(rows,{},[1],{...options,commonReason:' '}));
 assert.throws(()=>allocationApprovalDecisions(rows,{1:{center:''}},[1],options));
 assert.throws(()=>allocationApprovalDecisions(rows,{},[1,2],{...options,today:'2026-10-01'}));
 assert.throws(()=>allocationApprovalDecisions(rows,{},[99],options));
 assert.throws(()=>allocationApprovalDecisions(rows,{1:{hours:-1}},[1],options));
 assert.equal(allocationApprovalDecisions(rows,{},[1,1],options).length,1);
});
test('select all excludes future and already approved days',()=>{
 assert.deepEqual(selectableAllocationRows([{id:1,fecha:'2026-10-15',estado:'Pendiente'},{id:2,fecha:'2026-10-16',estado:'Pendiente'},{id:3,fecha:'2026-10-14',estado:'Aprobada'}],options.today).map(r=>r.id),[1]);
});
test('incomplete cost setup blocks the entire batch with actionable feedback',()=>{
 const incomplete=[rows[0],{...rows[1],costo_detalle:{listo:false,motivo:'Configure parámetros de costeo del mes y sueldo del trabajador'}}];
 assert.throws(()=>allocationApprovalDecisions(incomplete,{},[1,2],options),/2026-10-02: Configure parámetros.*Actualice las propuestas|2026-10-02: Configure parámetros.*actualice las propuestas/);
});
