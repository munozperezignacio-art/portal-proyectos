import test from 'node:test';
import assert from 'node:assert/strict';
import {laborCostParameters} from './laborCostParameters.js';
import {laborCostPreview} from './laborCostPreview.js';
import {calculatePayroll} from './payrollChile.js';
const config={origen:'Automático',horas_semanales:42,reglas:{aporte_previsional_pct:3.5,accidentes_basica_pct:.9,sanna_pct:.03,afc_indefinido_pct:2.4,afc_plazo_pct:3}};
test('uses dated server rules, contract-specific AFC and worker hours without adding SIS twice',()=>{
 assert.equal(laborCostParameters({tipo_contrato:'Indefinido'},config).cargas_empleador_pct,6.83);
 assert.equal(laborCostParameters({tipo_contrato:'Plazo Fijo'},config).cargas_empleador_pct,7.43);
 assert.equal(laborCostParameters({tipo_contrato:'Por Obra o Faena',horas_semanales:30},config).horas_semanales,30);
 const manual={horas_semanales:40,cargas_empleador_pct:12};assert.equal(laborCostParameters({},manual),manual);
});
test('automatic payroll includes approved variable taxable pay in gratification while preserving manual mode',()=>{
 const worker={sueldo_base:600000,gratificacion:'Art. 50 (25% tope)'};
 const attendance={records:1,absent:0,overtime:1,bonus:5000,nonTaxable:2000};
 const parameters={horasSemanales:42,topeGratificacionMensual:219114.73,factorHoraExtra:1.5,cargasEmpleadorPct:6.83};
 assert.equal(calculatePayroll(worker,attendance,{...parameters,gratificarHaberesVariables:true}).gratification,152500);
 assert.equal(calculatePayroll(worker,attendance,parameters).gratification,150000);
});
test('automatic preview uses the frozen per-worker parameters, not the generic monthly rate',()=>{
 const detail={listo:true,base:20000,gratificacion:0,colacion:0,movilizacion:0,horas_extra:1,provision_referencial:true,parametros_aplicados:{horas_semanales:30,factor_hora_extra:1.5,cargas_empleador_pct:7.43,tope_gratificacion_mensual:219114.73}};
 const p=laborCostPreview(detail,{taxable:5000,nonTaxable:2000},{sueldo_base:600000,gratificacion:'Sin Gratificación'},{horas_semanales:42,cargas_empleador_pct:6.83});
 assert.equal(p.monto_horas_extra,7000);assert.equal(p.cargas_empleador,2377.6);assert.equal(p.total,36378);
});
