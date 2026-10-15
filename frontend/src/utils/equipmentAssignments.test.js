import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAssignedWork, operationalStatus, filterAssignments, assignmentConflicts } from './equipmentAssignments.js';
test('bodega placeholders are never assigned work',()=>{
 for(const value of [null,'',' Bodega Central / Libre ','Bodega central','Sin asignar']) assert.equal(hasAssignedWork(value),false);
 assert.equal(hasAssignedWork('Edificio Lonco'),true);
});
test('filters find names and codes and exclude inactive or rented stock from availability',()=>{
 const equipment=[{id:1,patente:'EXC-01',tipo:'Excavadora',marca:'LINKBELT 460',obra_nombre:'Bodega Central / Libre'}, {id:2,obra_nombre:'Lonco',estado_equipo:'Operativo'}, {id:3,estado_equipo:'En Mantención'}, {id:4}, {id:5,estado_equipo:'Paralizado'}];
 assert.deepEqual(filterAssignments(equipment,{availability:'disponible'},['4']).map(e=>e.id),[1]);
 assert.equal(filterAssignments(equipment,{search:'linkbelt'}).length,1);
 assert.deepEqual(filterAssignments(equipment,{work:'Lonco'}).map(e=>e.id),[2]);
 assert.equal(operationalStatus(equipment[2]),'Mantención');
 assert.deepEqual(filterAssignments(equipment,{operational:'Paralizado'}).map(e=>e.id),[5]);
});
test('booking overlap is inclusive and excludes past or cancelled reservations',()=>{
 const bookings=[{equipo_id:1,fecha_inicio:'2026-10-20',fecha_fin:'2026-10-22'}, {equipo_id:1,fecha_inicio:'2026-10-01',fecha_fin:'2026-10-05'}, {equipo_id:2,fecha_inicio:'2026-10-20',fecha_fin:'2026-10-22'}, {equipo_id:1,fecha_inicio:'2026-10-20',estado:'Cancelada'}];
 assert.equal(assignmentConflicts([1],bookings,'2026-10-15','2026-10-19').length,0);
 assert.equal(assignmentConflicts([1],bookings,'2026-10-15','2026-10-20').length,1);
 assert.equal(assignmentConflicts([1],bookings,'2026-10-15','').length,1);
});
