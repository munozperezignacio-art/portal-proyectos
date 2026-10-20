import test from 'node:test';import assert from 'node:assert/strict';
import {machineryChargeConflict} from './machineryCharge.js';
test('solo interpreta el conflicto estructurado y nunca errores de permisos',()=>{
 assert.deepEqual(machineryChargeConflict({message:'MAQUINARIA_DESTINO_REQUERIDO',details:'{"obras":["A","B"],"fecha":"2026-10-20"}'}),{obras:['A','B'],fecha:'2026-10-20'});
 assert.equal(machineryChargeConflict({message:'Permiso denegado'}),null);
 assert.equal(machineryChargeConflict({message:'MAQUINARIA_DESTINO_REQUERIDO',details:'Error'}),null);
});
