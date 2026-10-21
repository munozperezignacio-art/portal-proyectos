import test from 'node:test';
import assert from 'node:assert/strict';
import {materialMovement, MATERIAL_UNITS} from './materialMovement.js';
test('material movement preserves quantity and selected unit',()=>{
 for(const unidad of MATERIAL_UNITS) assert.deepEqual(materialMovement({material:' Arena ',cantidad:'1.25',unidad}),{material:'Arena',cantidad:1.25,unidad});
});
test('material movement requires a unit and positive finite quantity',()=>{
 for(const cantidad of ['',0,-1,'abc',Infinity]) assert.throws(()=>materialMovement({material:'Arena',cantidad,unidad:'M3'}));
 for(const unidad of ['',undefined,'INVALID']) assert.throws(()=>materialMovement({material:'Arena',cantidad:1,unidad}));
});
