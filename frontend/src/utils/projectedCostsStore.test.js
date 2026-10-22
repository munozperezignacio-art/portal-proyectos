import test from 'node:test';import assert from 'node:assert/strict';
import {loadProjectedCosts,saveProjectedCosts,deleteProjectedCost} from './projectedCostsStore.js';
function fake(){const rows=[];return {rows,from(table){assert.equal(table,'obra_costos_proyectados');let filters=[],mode='read',payload;const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(){return q;},insert(v){mode='insert';payload=v;return q;},update(v){mode='update';payload=v;return q;},delete(){mode='delete';return q;},then(resolve){const matches=r=>filters.every(([k,v])=>r[k]===v);let data;if(mode==='insert'){rows.push(...payload);data=payload;}else if(mode==='update'){data=rows.filter(matches);data.forEach(r=>Object.assign(r,payload));}else if(mode==='delete'){data=rows.filter(matches);for(const r of data)rows.splice(rows.indexOf(r),1);}else data=rows.filter(matches);return Promise.resolve({data,error:null}).then(resolve);}};return q;}};}
test('projected costs save, reload, edit and delete scoped rows; all-parts create is one insert',async()=>{
 const db=fake(),parts=[{id:1,partida:'A'},{id:2,partida:'B'}];
 const saved=await saveProjectedCosts(db,'TEST',10,{partida:'__todas__',nombre_item:'Operativo',tipo_proyeccion:'TIEMPO',tarifa_tiempo_dia:20000},parts);
 assert.equal(saved.length,2);assert.notEqual(saved[0].id,saved[1].id);
 assert.equal((await loadProjectedCosts(db,'TEST',10)).length,2);assert.equal((await loadProjectedCosts(db,'OTHER',10)).length,0);
 await saveProjectedCosts(db,'TEST',10,{...saved[0],tarifa_tiempo_dia:25000},parts);
 assert.equal((await loadProjectedCosts(db,'TEST',10))[0].tarifa_tiempo_dia,25000);
 await assert.rejects(deleteProjectedCost(db,'OTHER',10,saved[0].id),/No se eliminó/);
 await deleteProjectedCost(db,'TEST',10,saved[0].id);assert.equal(db.rows.length,1);
});
test('write failures are propagated rather than claiming a successful save',async()=>{
 const q={insert(){return q;},select(){return Promise.resolve({error:Error('Sin permiso')});}};
 await assert.rejects(saveProjectedCosts({from:()=>q},'TEST',10,{partida:'A',tipo_proyeccion:'TIEMPO'},[{id:1,partida:'A'}]),/Sin permiso/);
});
