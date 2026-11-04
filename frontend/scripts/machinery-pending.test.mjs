import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingMachineryAllocations,applyMachineryAllocations,machineryCostControl} from '../src/utils/costControl.js';
test('charge window includes both endpoints and preserves explicit historical costs',()=>{
 const rows=machineryCostControl({periods:[{id:1,equipo_id:10,obra_id:1,desde:'2026-10-19',tarifa:100}],reports:[{id:1,equipo_id:10,fecha:'2026-10-22',cargo_obra_id:1,tarifa_diaria_aplicada:120}],decisions:[{equipo_id:10,obra_id:1,fecha:'2026-10-23',tipo:'confirmar',monto:150}],chargePeriod:{desde:'2026-10-20',hasta:'2026-10-21'},end:'2026-10-30',cutoff:'2026-10-30',obraId:1});
 assert.deepEqual(rows.map(r=>r.fecha),['2026-10-23','2026-10-22','2026-10-21','2026-10-20']);
 assert.deepEqual(rows.map(r=>r.monto),[150,120,100,100]);
});
import {costDistribution} from '../src/utils/costDistribution.js';
test('allocated machinery reconciles with statistics and recalculated costs',()=>{
 const decisions=[{equipo_id:1,fecha:'2026-11-01',version:1,distribucion:[{partida_id:1,partida:'A',porcentaje:33.33},{partida_id:2,partida:'B',porcentaje:66.67}]}];
 for(const amount of [101,103.27]){
 const rows=applyMachineryAllocations([{equipo_id:1,fecha:'2026-11-01',monto:amount,categoria_proyeccion:'Uso diario de maquinaria'}],decisions);
 assert.ok(Math.abs(rows[0].obra_liquidaciones_partidas.reduce((s,p)=>s+p.monto_imputado,0)-amount)<0.000001);
 const stats=costDistribution(rows,[{partida:'A'},{partida:'B'}],(a,b)=>a===b);
 assert.equal(stats.total,amount);assert.equal(stats.groups.at(-1).total,0);
 assert.equal(pendingMachineryAllocations(rows,'2026-11-04').length,0);
 }
});
test('pending allocations distinguish confirmation, future, missing tariff and partial allocation',()=>{
 const base={fecha:'2026-11-01',monto:100};
 const rows=[{...base,equipo_id:1,estado_costo:'confirmado'},{...base,equipo_id:2,estado_costo:'pendiente'},
 {...base,equipo_id:3,fecha:'2026-12-01'},{...base,equipo_id:4,monto:null},
 {...base,equipo_id:5,imputaciones:[{porcentaje:100}]},{...base,equipo_id:6,imputaciones:[{porcentaje:25}]}];
 const actual=pendingMachineryAllocations(rows,'2026-11-04');
 assert.deepEqual(actual.map(r=>r.equipo_id),[1,2,4,6]);
 assert.deepEqual(actual.map(r=>r.monto_sin_imputar),[100,100,null,75]);
 assert.equal(rows[5].monto,100);
});
