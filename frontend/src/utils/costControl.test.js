import test from 'node:test';import assert from 'node:assert/strict';
import {machineryCostControl,costState,costTotals} from './costControl.js';
import {forecastModel} from './forecastModel.js';
const period={id:1,equipo_id:1,obra_id:10,desde:'2026-10-09',tarifa:100};
const input={periods:[period],obraId:10,obraName:'A',end:'2026-10-14',cutoff:'2026-10-13',holidays:['2026-10-12']};
test('workdays automatically accrue; weekends and holidays require a report; never duplicate a day',()=>{
 const rows=machineryCostControl({...input,reports:[{id:1,equipo_id:1,fecha:'2026-10-10',obra_nombre:'A',monto:100},{id:2,equipo_id:1,fecha:'2026-10-13',obra_nombre:'A',monto:100}]});
 assert.deepEqual(rows.map(r=>r.fecha),['2026-10-14','2026-10-13','2026-10-10','2026-10-09']);
 assert.equal(costTotals(rows,input.cutoff).incurrido,300);assert.equal(costTotals(rows,input.cutoff).proyectado,100);
});
test('confirmation replaces amount and state, no use removes only selected work, retirement affects its own period',()=>{
 const rows=machineryCostControl({...input,decisions:[{equipo_id:1,obra_id:10,fecha:'2026-10-09',tipo:'confirmar',monto:80},{equipo_id:1,obra_id:10,fecha:'2026-10-13',tipo:'no_uso'},{equipo_id:1,obra_id:10,periodo_id:1,fecha:'2026-10-14',tipo:'retiro'}]});
 assert.equal(rows.length,1);assert.equal(rows[0].monto,80);assert.equal(rows[0].estado_costo,'confirmado');
 const restored=machineryCostControl({...input,decisions:[{equipo_id:1,obra_id:10,periodo_id:1,fecha:'2026-10-14',tipo:'restablecer'}]});assert.equal(restored.length,3);
});
test('report charge in another work replaces the default assignment, not both; report after retirement is evidence',()=>{
 const reports=[{equipo_id:1,fecha:'2026-10-13',obra_nombre:'B',monto:100}];
 assert.equal(machineryCostControl({...input,reports}).some(r=>r.fecha==='2026-10-13'),false);
 const b=machineryCostControl({...input,reports,obraId:20,obraName:'B',decisions:[{equipo_id:1,obra_id:10,fecha:'2026-10-13',tipo:'no_uso'}]});assert.equal(b.length,1);
 const retired=machineryCostControl({...input,reports:[{equipo_id:1,obra_nombre:'A',fecha:'2026-10-13',monto:100}],decisions:[{equipo_id:1,obra_id:10,periodo_id:1,fecha:'2026-10-13',tipo:'retiro'}]});assert.ok(retired.some(r=>r.fecha==='2026-10-13'));
});
test('future cost becomes pending at its date, and confirming never adds a second entry',()=>{
 const c={fecha_costo:'2026-10-14',monto:150,estado_costo:'proyectado'};assert.equal(costState(c,'2026-10-13'),'proyectado');assert.equal(costState(c,'2026-10-14'),'pendiente');
 assert.equal(costTotals([{...c,estado_costo:'confirmado'}],'2026-10-14').incurrido,150);
});
test('a tariff change does not restart retired equipment but a new assignment can restart it',()=>{
 const periods=[{...period,asignacion_id:1,hasta:'2026-10-13'},{...period,id:2,asignacion_id:1,desde:'2026-10-13',tarifa:200},{...period,id:3,asignacion_id:3,desde:'2026-10-14',tarifa:300}];
 const rows=machineryCostControl({...input,periods,decisions:[{equipo_id:1,obra_id:10,periodo_id:1,fecha:'2026-10-13',tipo:'retiro'}]});
 assert.equal(rows.some(r=>r.fecha==='2026-10-13'),false);assert.equal(rows.find(r=>r.fecha==='2026-10-14').monto,300);
});
test('equipment future replaces proportional equipment extrapolation',()=>{
 const r=forecastModel({cutoff:'2026-10-09',baselineFinish:'2026-10-16',actualProgress:50,plannedProgress:50,actualCost:300,machineryActual:100,futureCosts:[{fecha:'2026-10-12',categoria_proyeccion:'Uso diario de maquinaria',monto:50}],productionParts:[{id:1,partida:'A',quantity:100,start:'2026-10-01'}],reports:[{partida_id:1,fecha:'2026-10-09',cantidad:50}]});
 assert.equal(r.baseCost,550); // 300 accrued + 200 other remaining + 50 equipment, not 600+50
});
