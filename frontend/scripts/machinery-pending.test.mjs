import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingMachineryAllocations} from '../src/utils/costControl.js';
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
