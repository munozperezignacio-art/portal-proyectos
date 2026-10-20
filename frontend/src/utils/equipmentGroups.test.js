import test from 'node:test';import assert from 'node:assert/strict';
import {equipmentGroupMembers,equipmentGroupSearch,toggleGroupEquipment,readEquipmentGroups} from './equipmentGroups.js';
test('miembros únicos por ID y empresa; grupos no cambian categorías ni ubicaciones',()=>{
 const equipment=[{id:1,empresa:'A',categoria_id:2,obra_nombre:'Obra A'},{id:2,empresa:'A'},{id:3,empresa:'B'}],links=[{grupo_id:1,empresa:'A',equipo_id:1},{grupo_id:1,empresa:'A',equipo_id:1},{grupo_id:1,empresa:'B',equipo_id:3},{grupo_id:2,empresa:'A',equipo_id:2}];
 const snapshot=JSON.stringify(equipment);assert.deepEqual(equipmentGroupMembers({id:1},links,equipment,'A').map(e=>e.id),[1]);assert.equal(JSON.stringify(equipment),snapshot);
});
test('buscar y seleccionar sucesivamente conserva selección, sin duplicados y con máximo 500',()=>{
 let selected=toggleGroupEquipment([], [{id:1}]);selected=toggleGroupEquipment(selected,[{id:2}]);assert.deepEqual(selected,['1','2']);assert.deepEqual(toggleGroupEquipment(selected,[{id:2}]),['1']);assert.equal(toggleGroupEquipment([],Array.from({length:600},(_,id)=>({id}))).length,500);
 assert.equal(equipmentGroupSearch({tipo:'Perforación',patente:'EXC-01'},'perforacion'),true);
});
test('lectura paginada por empresa y fallos visibles, nunca escritura',async()=>{
 const calls=[];let fail=false;const client={from(table){const q={table,company:null};const chain={select(){return chain;},eq(key,value){q.company=[key,value];return chain;},order(){return chain;},range:async(from)=>{calls.push(q);if(fail)return {error:new Error('Sin acceso')};return {data:table==='maquinaria_grupos'&&from===0?Array.from({length:1000},(_,id)=>({id})):[]};}};return chain;}};
 const result=await readEquipmentGroups(client,'A');assert.equal(result.groups.length,1000);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.company[1]==='A'));fail=true;await assert.rejects(readEquipmentGroups(client,'A'),/Sin acceso/);
});
