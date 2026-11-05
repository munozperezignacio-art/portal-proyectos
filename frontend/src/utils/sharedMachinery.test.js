import test from 'node:test';import assert from 'node:assert/strict';
import {machineryCostControl} from './costControl.js';
const periods=[1,2].map(id=>({id,obra_id:id,equipo_id:7,desde:'2026-10-19',hasta:'infinity',tarifa:100}));
const run=(obraId,extras={})=>machineryCostControl({periods,obraId,end:'2026-10-19',cutoff:'2026-10-19',...extras});
test('día compartido visible en ambas sin costo; reporte único elige solo una',()=>{
 for(const w of [1,2]){assert.equal(run(w)[0].pendiente_obra,true);assert.equal(run(w)[0].monto,0);}
 const reports=[{id:1,equipo_id:7,cargo_obra_id:2,fecha:'2026-10-19',tarifa_diaria_aplicada:100}];
 assert.equal(run(1,{reports}).length,0);assert.equal(run(2,{reports})[0].monto,100);
});
test('confirmación prevalece y sobrevive a una baja',()=>{
 const decisions=[{tipo:'confirmar',fecha:'2026-10-19',equipo_id:7,obra_id:1,periodo_id:1,monto:90}];
 assert.equal(run(2,{decisions}).length,0);assert.equal(run(1,{decisions})[0].monto,90);
 assert.equal(run(1,{decisions,periods:[]})[0].monto,90);
 const ended=periods.map(p=>p.id===1?{...p,hasta:'2026-10-19'}:p);
 assert.equal(run(1,{periods:ended}).length,0);assert.equal(run(2,{periods:ended})[0].monto,100);
});
