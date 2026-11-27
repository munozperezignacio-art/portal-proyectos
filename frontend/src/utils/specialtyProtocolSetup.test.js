import {test} from 'node:test';
import assert from 'node:assert/strict';
import {protocolDayNumber,protocolDefaults} from './specialtyProtocolSetup.js';
test('calendar order independent of input order, excluding open days',()=>{
 const sessions=[{id:'b',fecha:'2026-11-24',estado:'cerrada'},{id:'a',fecha:'2026-11-16',estado:'cerrada'},{id:'c',fecha:'2026-11-01',estado:'abierta'}];
 assert.equal(protocolDayNumber(sessions,'a'),'1');
 assert.equal(protocolDayNumber(sessions,'b'),'2');
 assert.equal(protocolDayNumber(sessions,'c'),'');
 assert.equal(protocolDayNumber(sessions,''),'');
});
test('editable defaults preserve existing saved values',()=>{
 const existing={finos:'< 3%',diametro:'0.66'};
 const value=protocolDefaults(existing);
 assert.equal(value.finos,'< 3%');
 assert.equal(value.graduacion,'3/8" a 1 1/2"');
 assert.equal(value.criterio_control,'< 5 mm');
 assert.deepEqual(existing,{finos:'< 3%',diametro:'0.66'});
});
