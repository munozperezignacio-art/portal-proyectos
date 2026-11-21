import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAllowances,allowanceTotals} from './workerAllowances.js';
import {calculatePayroll,attendanceSummary} from './payrollChile.js';
import {laborCostPreview} from './laborCostPreview.js';
const rows=[{nombre:'Responsabilidad',monto:90000,tipo:'imponible',desde:'2026-11',hasta:null},{nombre:'Viático',monto:60000,tipo:'no_imponible',desde:'2026-11',hasta:'2026-12'}];
test('validates explicit type, positive integer amounts and validity',()=>{
 assert.deepEqual(validateAllowances(rows),rows);
 for(const change of [{monto:-1},{monto:''},{tipo:''},{nombre:' '},{hasta:'2026-10'},{desde:'2026-13'},{monto:1.5}])assert.throws(()=>validateAllowances([{...rows[0],...change}]));
});
test('prorates and respects first and final month',()=>{
 const worker={otras_asignaciones:rows};
 assert.equal(allowanceTotals(worker,'2026-10').taxable,0);
 assert.equal(allowanceTotals(worker,'2026-11',15).taxable,45000);
 assert.equal(allowanceTotals(worker,'2026-12').nonTaxable,60000);
 assert.equal(allowanceTotals(worker,'2027-01').nonTaxable,0);
});
test('payroll includes monthly allowances once, separate from discretionary bonuses',()=>{
 const worker={sueldo_base:600000,gratificacion:'Sin Gratificación',otras_asignaciones:rows};
 const parameters={periodo:'2026-11',cargasEmpleadorPct:10};
 const attendance={records:1,absent:0,bonus:1000,nonTaxable:2000,overtime:0};
 const result=calculatePayroll(worker,attendance,parameters);
 assert.equal(result.bonus,1000);assert.equal(result.taxableGross,691000);
 assert.equal(result.totalAssets,753000);assert.equal(result.employerCost,822100);
 assert.equal(calculatePayroll(worker,attendance,parameters).employerCost,result.employerCost);
 assert.equal(calculatePayroll(worker,attendance,{...parameters,periodo:'2026-10'}).totalAssets,603000);
});
test('daily preview keeps recurring and discretionary inputs separate',()=>{
 const result=laborCostPreview({listo:true,base:20000,gratificacion:0,colacion:0,movilizacion:0,asignaciones_imponibles:3000,asignaciones_no_imponibles:2000},{taxable:100,nonTaxable:200},{sueldo_base:600000},{horas_semanales:42,factor_hora_extra:1.5,cargas_empleador_pct:10});
 assert.equal(result.total,27610);assert.equal(result.haber_imponible,100);
});
test('each allocation saves its mode; worked days are unique marks, not paid days',()=>{
 const selected=validateAllowances(rows.map((r,i)=>({...r,calculo:i?'completo':'marcajes'})));
 assert.deepEqual(validateAllowances(JSON.parse(JSON.stringify(selected))),selected);
 assert.throws(()=>validateAllowances([{...rows[0],calculo:'other'}]));
 const worker={id:1,rut:'1-9',sueldo_base:600000,gratificacion:'Sin Gratificación',otras_asignaciones:selected};
 const marks=['2026-11-01','2026-11-02','2026-11-02'].map(fecha_marcacion=>({rut:'19',fecha_marcacion,asistencia:'PRESENTE'}));
 marks.push({rut:'19',fecha_marcacion:'2026-11-03',asistencia:'AUSENTE'},{rut:'29',fecha_marcacion:'2026-11-04',asistencia:'PRESENTE'});
 const attendance=attendanceSummary(worker,marks,'2026-11');assert.equal(attendance.present,2);
 const payroll=calculatePayroll(worker,attendance,{periodo:'2026-11'},{dias_pagados:30});
 assert.deepEqual(payroll.allowances.map(r=>r.amount),[6000,60000]);
 assert.deepEqual(allowanceTotals(worker,'2026-11',0,0).details.map(r=>r.amount),[0,60000]);
 assert.deepEqual(allowanceTotals(worker,'2026-11',30,31).details.map(r=>r.amount),[90000,60000]);
 assert.equal(allowanceTotals(worker,'2027-01',30,30).nonTaxable,0);
});
