import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceSummary, calculatePayroll } from './payrollChile.js';
const worker={id:1,nombre:'Prueba',rut:'1-9',sueldo_base:600000,gratificacion:'Sin Gratificación',colacion:30000,movilizacion:30000};
const records=[{fecha_marcacion:'2026-10-01',created_at:'2026-11-01',rut:'1-9',asistencia:'PRESENTE',horas_extras_auto:2,horas_extras_manual:0}];
test('uses attendance date, not creation month; automatic overtime is not erased by default zero',()=>{
 const s=attendanceSummary(worker,records,'2026-10');assert.equal(s.overtime,2);assert.equal(s.present,1);assert.equal(attendanceSummary(worker,records,'2026-11').records,0);
});
test('approved overtime replaces detected hours, and daily additional pay appears once in payroll',()=>{
 const approved=[{trabajador_id:1,fecha:'2026-10-01',estado:'Aprobada',horas_extra_aprobadas:1,haber_imponible:5000,haber_no_imponible:2000}];
 const s=attendanceSummary(worker,records,'2026-10',approved);assert.equal(s.overtime,1);
 const p=calculatePayroll(worker,s,{horasSemanales:42,cargasEmpleadorPct:10});assert.equal(p.overtime,5000);assert.equal(p.bonus,5000);assert.equal(p.otherNonTaxable,2000);assert.equal(p.employerCost,p.totalAssets+p.employerCharges);assert.equal(p.employerCharges,61000);
});
