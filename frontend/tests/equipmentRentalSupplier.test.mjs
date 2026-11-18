import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {inventoryRows,equipmentOwnership} from '../src/utils/equipmentInventory.js';
test('ownership filter works independently of equipment status and location',()=>{
 const rows=[{id:1,tipo_activo:'Propio'},{id:2,tipo_activo:'Arrendado',obra_nombre:'Obra A'},{id:3,tipo_activo:'Arrendado',estado_equipo:'En mantención'},{id:4}];
 const filter=f=>inventoryRows(rows,f,[],[],[],'2026-11-18').map(r=>r.id);
 assert.deepEqual(filter({ownership:'Propio'}),[1,4]);
 assert.deepEqual(filter({ownership:'Arrendado'}),[2,3]);
 assert.deepEqual(filter({ownership:'Arrendado',state:'mantencion'}),[3]);
 assert.deepEqual(filter({ownership:'Arrendado',work:'Obra A'}),[2]);
 assert.equal(equipmentOwnership({tipo_activo:' arrendado '}),'Arrendado');
});
test('supplier persists, is required for rental changes, legacy rows remain untouched',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;create table inventario_maquinaria(id int primary key,tipo_activo text,costo_interno numeric,obra_nombre text);insert into inventario_maquinaria values(1,'Arrendado',500,'Obra A');`);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261118164406_equipment_rental_supplier.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select proveedor_nombre from inventario_maquinaria where id=1')).rows[0].proveedor_nombre,null);
 await db.exec(`update inventario_maquinaria set costo_interno=600 where id=1;`);
 await assert.rejects(db.exec(`insert into inventario_maquinaria values(2,'Arrendado',100,'Obra B','   ');`),/proveedor/);
 await db.exec(`insert into inventario_maquinaria values(2,'Arrendado',100,'Obra B','  Proveedor prueba  ');`);
 assert.equal((await db.query('select proveedor_nombre from inventario_maquinaria where id=2')).rows[0].proveedor_nombre,'Proveedor prueba');
 await assert.rejects(db.exec(`update inventario_maquinaria set proveedor_nombre='' where id=2;`),/proveedor/);
 await db.exec(`insert into inventario_maquinaria values(3,'Propio',300,'Obra C',null);`);
 await assert.rejects(db.exec(`update inventario_maquinaria set tipo_activo='Arrendado' where id=3;`),/proveedor/);
 assert.deepEqual((await db.query('select costo_interno::int,obra_nombre from inventario_maquinaria where id=2')).rows[0],{costo_interno:100,obra_nombre:'Obra B'});
 }finally{await db.close();}
});
