import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {can,PERMISSIONS_CATALOG} from './permissionsCatalog.js';
test('earnings permissions are independent from salaries and each other',()=>{
 const user={rol:'Supervisor',empresa:'EMINSG'};
 assert.deepEqual(PERMISSIONS_CATALOG.find(m=>m.id==='obras').menus.find(m=>m.id==='haberes').actions,['crear','editar','descargar']);
 for(const action of ['crear','editar','descargar']){const p={['obras.haberes.'+action]:true,'obras.sueldos.ver':false};for(const other of ['crear','editar','descargar'])assert.equal(can(user,p,'obras.haberes.'+other),action===other);assert.equal(can(user,p,'obras.sueldos.ver'),false);}
});
test('database enforces independent create/edit/download and company/work scope',async()=>{
 const db=new PGlite();try{await db.exec(`create role authenticated;create role anon; create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select $1='TEST' and $2=1$$;
 create table usuarios(empresa text,auth_user_id uuid,rol text,rol_base text,permisos jsonb);
 create table roles(empresa text,nombre text,permisos jsonb);
 insert into usuarios values('TEST',auth.uid(),'Supervisor',null,'{}');
 insert into roles values('TEST','Supervisor','{}');
 create table rrhh_haberes_obra(empresa text,obra_id int,monto int);
 insert into rrhh_haberes_obra values('TEST',1,27000),('OTHER',1,100),('TEST',2,200);
 alter table rrhh_haberes_obra enable row level security;
 create policy lectura on rrhh_haberes_obra for select to authenticated using(false);
 create policy alta on rrhh_haberes_obra for insert to authenticated with check(false);
 create policy cambio on rrhh_haberes_obra for update to authenticated using(false) with check(false);
 grant usage on schema public,private,auth to authenticated;
 grant select on usuarios,roles to authenticated;
 grant select,insert,update on rrhh_haberes_obra to authenticated;`);
 await db.exec(readFileSync(new URL('../../../supabase/schema/obra-haberes-permisos.sql',import.meta.url),'utf8'));
 for(const action of ['crear','descargar','editar']){
 await db.exec(`reset role;update roles set permisos='{"obras.sueldos.ver":false,"obras.haberes.${action}":true}';set role authenticated;`);
 const visible=await db.query('select * from rrhh_haberes_obra');assert.equal(visible.rows.length,action==='crear'?0:2);
 const changed=await db.query('update rrhh_haberes_obra set monto=28000 returning *');assert.equal(changed.rows.length,action==='editar'?2:0);
 if(action==='crear')await db.exec("insert into rrhh_haberes_obra values('TEST',1,30000)");else await assert.rejects(db.exec("insert into rrhh_haberes_obra values('TEST',1,1)"),/row-level security/);
 await assert.rejects(db.exec("insert into rrhh_haberes_obra values('OTHER',1,1)"),/row-level security/);
 }
 await db.exec(`reset role;update usuarios set permisos='{"obras.haberes.editar":false}';set role authenticated;`);assert.equal((await db.query('select * from rrhh_haberes_obra')).rows.length,0);
 }finally{await db.close();}
});
