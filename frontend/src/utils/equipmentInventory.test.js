import {test} from 'node:test';import assert from 'node:assert/strict';
import {inventoryState,inventoryRows,inventoryTariff} from './equipmentInventory.js';
const today='2026-10-18';
test('warehouse is available, operational state takes priority, and expired or cancelled bookings do not reserve',()=>{
  const equipment={id:1,obra_nombre:'Bodega Central / Libre',estado_equipo:'Operativo'};
  assert.equal(inventoryState(equipment,[],[],today).code,'libre');
  assert.equal(inventoryState({...equipment,obra_nombre:'Lonco'},[],[],today).code,'en_uso');
  assert.equal(inventoryState({...equipment,obra_nombre:'Lonco',estado_equipo:'En Mantención'},[],[],today).code,'mantencion');
  assert.equal(inventoryState({...equipment,estado_equipo:'Fuera de Servicio'},[],[],today).code,'fuera_servicio');
  assert.equal(inventoryState(equipment,[{equipo_id:1,fecha_inicio:'2026-10-20',fecha_fin:'2026-10-22',estado:'Cancelada'}],[],today).code,'libre');
  assert.equal(inventoryState(equipment,[{equipo_id:1,fecha_inicio:'2026-10-01',fecha_fin:'2026-10-17'}],[],today).code,'libre');
  assert.equal(inventoryState(equipment,[{equipo_id:1,fecha_inicio:'2026-10-20',fecha_fin:'2026-10-22'}],[],today).code,'reservado');
  assert.equal(inventoryState(equipment,[],[{equipo_id:1,estado:'Activo',fecha_fin:'2026-10-17'}],today).code,'libre');
});
test('filters and natural sort include imported names, categories, brands and unclassified equipment',()=>{
  const equipment=[{id:1,patente:'EXC-10',tipo:'Excavadora',marca:'CAT 318',categoria_id:1},{id:2,patente:'EXC-2',tipo:'Otra excavadora',marca:'LINKBELT'},{id:3,patente:'COM-1',tipo:'Compresor',categoria_id:2}];
  const categories=[{id:1,nombre:'Movimiento de tierra'},{id:2,nombre:'Apoyo'}];
  assert.deepEqual(inventoryRows(equipment,{},categories,[],[],today).map(item=>item.patente),['COM-1','EXC-2','EXC-10']);
  assert.equal(inventoryRows(equipment,{search:'318'},categories,[],[],today)[0].id,1);
  assert.equal(inventoryRows(equipment,{search:'tierra'},categories,[],[],today).length,1);
  assert.equal(inventoryRows(equipment,{category:'__none'},categories,[],[],today)[0].id,2);
  assert.equal(inventoryRows(equipment,{category:'2'},categories,[],[],today)[0].id,3);
  assert.equal(equipment[0].patente,'EXC-10');
});
test('tariffs keep their real unit and missing values are never reported as zero',()=>{
  assert.equal(inventoryTariff({}),'Sin tarifa');
  assert.match(inventoryTariff({costo_interno:12000,unidad_costo_interno:'$/mes'}),/12[.]000 \/ mes/);
  assert.match(inventoryTariff({costo_interno:0,unidad_costo_interno:'$/día'}),/\$0 \/ día/);
});
