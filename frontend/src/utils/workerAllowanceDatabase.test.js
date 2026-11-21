import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('saved modes roundtrip, reject invalid modes; cost respects attendance and tenant',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;
 create table maestro_personal(id integer,empresa text,rut text,otras_asignaciones jsonb);
 create table rrhh_imputaciones_diarias(id bigint,empresa text,trabajador_id integer,fecha date);
 create table asistencia_personal(empresa text,rut text,fecha_marcacion date,asistencia text);
 create function private.rrhh_calcular_costo_dia_sin_asignaciones(bigint,numeric,numeric,numeric) returns jsonb language sql as $$select '{}'::jsonb$$;`);
 await db.exec(readFileSync(new URL('../../../supabase/schema/worker-allowance-calculation.sql',import.meta.url),'utf8'));
 await db.exec('alter table maestro_personal add check(private.rrhh_asignaciones_validas(otras_asignaciones))');
 const rows=[{nombre:'Variable',monto:90000,tipo:'imponible',desde:'2026-11',calculo:'marcajes'},{nombre:'Fijo',monto:60000,tipo:'no_imponible',desde:'2026-11',calculo:'completo'}];
 await db.query('insert into maestro_personal values(1,$1,$2,$3)', ['EMINSG','1-9',JSON.stringify(rows)]);
 assert.deepEqual((await db.query('select otras_asignaciones from maestro_personal')).rows[0].otras_asignaciones,rows);
 await assert.rejects(db.query('update maestro_personal set otras_asignaciones=$1',[JSON.stringify([{...rows[0],calculo:'bad'}])]),/check/);
 await db.exec(`insert into rrhh_imputaciones_diarias values(1,'EMINSG',1,'2026-11-01');insert into asistencia_personal values('OTHER','19','2026-11-01','PRESENTE');`);
 const calc=async()=>(await db.query('select private.rrhh_calcular_costo_dia(1,0,0) d')).rows[0].d;
 assert.equal((await calc()).asignaciones_imponibles,0);assert.equal((await calc()).asignaciones_no_imponibles,2000);
 await db.exec(`insert into asistencia_personal values('EMINSG','19','2026-11-01','PRESENTE'),('EMINSG','19','2026-11-01','PRESENTE');`);
 assert.equal((await calc()).asignaciones_imponibles,3000);
 const legacy=rows.map(({calculo:_calculo,...row})=>row);await db.query('update maestro_personal set otras_asignaciones=$1',[JSON.stringify(legacy)]);
 assert.equal((await calc()).asignaciones_imponibles,3000);
 assert.equal((await db.query("select has_function_privilege('anon','private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric)','execute') ok")).rows[0].ok,false);
 }finally{await db.close();}
});
