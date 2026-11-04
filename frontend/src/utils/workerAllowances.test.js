import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAllowances,allowanceTotals} from './workerAllowances.js';
import {calculatePayroll} from './payrollChile.js';
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
