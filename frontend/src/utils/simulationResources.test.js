import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationResourceTemplates} from './simulationResources.js';
const daily=(id,date,amount,extra={})=>({id,empresa:'TEST',trabajador_id:10,trabajador:'Franco',categoria_proyeccion:'Mano de obra',fuente:'Provisión aprobada',fecha:date,monto:amount,...extra});
test('un recurso por trabajador, promedio de últimas cinco fechas y detalle íntegro',()=>{
  const rows=[daily('D-1','2026-10-09',9999),...Array.from({length:5},(_,i)=>daily(`D-${i+2}`,`2026-10-${12+i}`,100*(i+1)))];
  const before=JSON.stringify(rows),t=simulationResourceTemplates(rows,[],'2026-10-19');
  assert.equal(t.length,1);assert.equal(t[0].rate,300);assert.equal(t[0].mode,'workday');assert.equal(t[0].history.length,6);assert.equal(t[0].referenceDates.length,5);assert.ok(!t[0].referenceDates.includes('2026-10-09'));assert.equal(JSON.stringify(rows),before);
});
test('suma cargos distintos del mismo día antes del promedio, no divide por número de filas',()=>{
  const rows=[daily('D-1','2026-10-14',100),daily('D-2','2026-10-14',50,{centro_gestion_id:2}),daily('D-3','2026-10-15',250)];
  const [t]=simulationResourceTemplates(rows);assert.equal(t.rate,200);assert.equal(t.referenceDates.length,2);assert.equal(t.history.length,3);
});
test('filas duplicadas del mismo ID no duplican tarifa; excluye cargos posteriores al corte',()=>{
  const row=daily('D-1','2026-10-15',100);
  const [t]=simulationResourceTemplates([row,{...row},daily('D-2','2026-10-20',999)],[],'2026-10-19');
  assert.equal(t.rate,100);assert.equal(t.history.length,1);
});
test('identidad fuerte: homónimos y empresas distintas no se mezclan; cambio de nombre no duplica',()=>{
  const rows=[daily('D-1','2026-10-14',100),daily('D-2','2026-10-15',200,{trabajador:'Franco actualizado'}),daily('D-3','2026-10-15',900,{trabajador_id:11}),daily('D-1','2026-10-14',500,{empresa:'OTRA'})];
  const t=simulationResourceTemplates(rows);assert.equal(t.length,3);assert.equal(t.find(t=>t.workerId==='10'&&t.name==='Franco actualizado').rate,150);
});
test('RUT normalizado agrupa sin ID y enlaza a ficha solo si la identidad es inequívoca',()=>{
  const rows=[daily('D-1','2026-10-14',100,{rut:'12.345.678-5'}),daily('D-2','2026-10-15',200,{trabajador_id:null,rut:'123456785'})];
  assert.equal(simulationResourceTemplates(rows).length,1);
  assert.equal(simulationResourceTemplates(rows.map(r=>({...r,trabajador_id:null}))).length,1);
  const namesOnly=rows.map(r=>({...r,trabajador_id:null,rut:null}));assert.equal(simulationResourceTemplates(namesOnly).length,2);
});
test('total mensual no se disfraza como tarifa diaria y no se suma al promedio',()=>{
  const monthly={id:7,empresa:'TEST',categoria_proyeccion:'Mano de obra',trabajador_id:10,trabajador:'Franco',periodo:'2026-10',created_at:'2026-10-15',monto:2000000};
  const [t]=simulationResourceTemplates([monthly]);assert.equal(t.rate,'');assert.equal(t.mode,'workday');assert.match(t.source,/total mensual/);
  const [withDaily]=simulationResourceTemplates([monthly,daily('D-1','2026-10-16',50000)]);assert.equal(withDaily.rate,50000);assert.equal(withDaily.history.length,2);
});
test('identificadores estables al reordenar; costos con facturas diferentes siguen separados',()=>{
  const rows=[daily('D-1','2026-10-14',100),{id:1,empresa:'TEST',nombre:'Arriendo',monto:800000},{id:2,empresa:'TEST',nombre:'Arriendo',monto:900000}];
  const equipment=[{id:1,tipo:'Excavadora',simulationSource:'inventario'},{id:1,tipo:'Excavadora arrendada',simulationSource:'arriendo'}];
  const a=simulationResourceTemplates(rows,equipment),b=simulationResourceTemplates([...rows].reverse(),[...equipment].reverse());
  assert.deepEqual(a,b);assert.equal(a.length,5);assert.equal(simulationResourceTemplates([], [equipment[0],equipment[0]]).length,1);
});
