import test from 'node:test';
import assert from 'node:assert/strict';
import { laborCostPreview } from './laborCostPreview.js';
test('preview agrees with SQL fixture including approved extra hours and allowances',()=>{
 const p=laborCostPreview({listo:true,base:20000,gratificacion:3333.33,colacion:0,movilizacion:0,horas_extra:2},{taxable:5000,nonTaxable:2000},{sueldo_base:600000},{horas_semanales:42,factor_hora_extra:1.5,cargas_empleador_pct:10});
 assert.equal(p.total,44167);assert.equal(p.monto_horas_extra,10000);assert.equal(p.cargas_empleador,3833.33);
});
