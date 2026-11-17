import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMovement,planImport,parseEnexCsv,CSV_STATION_HEADER} from '../src/utils/enex.js';
const row={portal:'empresa',document:'100',occurred_local:'2026-11-17 08:00:00',vehicle:'TEST01',kind:'Carga',liters_milli:12345,amount_signed:-18000};
test('station and commune retained without changing core identity',()=>{
 const enriched={...row,station:'Panamericana Sur Km 61,9',station_commune:'Mostazal'};
 assert.deepEqual(validateMovement(enriched),enriched);
 assert.deepEqual(planImport('TEST',[enriched],[row]),{added:[],repeated:1});
 assert.deepEqual(planImport('TEST',[row],[enriched]),{added:[],repeated:1});
});
test('station conflicts rejected, never overwritten',()=>{
 assert.throws(()=>planImport('TEST',[{...row,station:'B'}],[{...row,station:'A'}]),/Conflicto/);
 assert.throws(()=>planImport('TEST',[row,{...row,station:'A'},{...row,station:'B'}]),/Conflicto/);
});
test('station CSV supports quoted commas and old files remain valid',()=>{
 const [r]=parseEnexCsv(CSV_STATION_HEADER+'\nempresa,2026-11-17 08:00:00,TEST01,100,12.345,-18000,"Panamericana Sur Km 61,9",Mostazal');
 assert.equal(r.station,'Panamericana Sur Km 61,9');assert.equal(r.station_commune,'Mostazal');
});
test('station limits and invalid types rejected',()=>{
 for(const station of [5,{},'',' bad','x'.repeat(251),'bad\nvalue'])assert.throws(()=>validateMovement({...row,station}));
});
