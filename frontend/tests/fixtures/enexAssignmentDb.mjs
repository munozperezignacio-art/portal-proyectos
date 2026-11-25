import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
export async function createAssignmentDb() {
 const db = new PGlite();
 await db.exec(`
 create schema auth; create schema private; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table usuarios(id int,empresa text,auth_user_id uuid);
 create table enex_movements(id uuid primary key,empresa text,portal text,vehicle text,document text,occurred_local timestamp,amount_signed bigint,station text,station_commune text);
 create table enex_owners(empresa text,portal text,vehicle text,owner_id uuid);
 create table obras(id int primary key,empresa text,centro_gestion_id int);
 create table facturacion_centros_gestion(id int primary key,empresa text,nombre text,codigo text,activo boolean);
 create table enex_assignments(movement_id uuid primary key references enex_movements(id),empresa text,centro_gestion_id int references facturacion_centros_gestion(id),obra_id int references obras(id),note text default '',actor uuid,updated_at timestamptz);
 create table enex_assignment_audit(empresa text,movement_id uuid,previous_assignment jsonb,new_assignment jsonb);
 create view private.enex_pending_owned as select m.*,o.owner_id from enex_movements m join enex_owners o using(empresa,portal,vehicle) join usuarios u on u.empresa=m.empresa and u.auth_user_id=o.owner_id where not exists(select 1 from enex_assignments a where a.movement_id=m.id);
 insert into usuarios values(1,'EMINSG','${uid(1)}'),(2,'EMINSG','${uid(2)}'),(3,'EMINSG','${uid(3)}');
 insert into enex_owners values('EMINSG','transporte','TEST-01','${uid(1)}'),('EMINSG','empresa','TEST-02','${uid(2)}');
 insert into enex_movements values('${uid(101)}','EMINSG','transporte','TEST-01','TEST-DOC-1','2026-11-24 09:00',-10000,'Estación de prueba','Comuna de prueba'),('${uid(102)}','EMINSG','empresa','TEST-02','TEST-DOC-2','2026-11-24 10:00',-20000,null,null);
 insert into facturacion_centros_gestion values(1,'EMINSG','Obra de prueba','001',true),(2,'OTHER','Ajeno','002',true),(3,'EMINSG','Inactivo','003',false);
 `);
 await db.exec(await readFile(new URL('./enex-assignment-rpcs.sql',import.meta.url),'utf8'));
 await db.exec(`
 create trigger enex_assignment_guard before insert or update on enex_assignments for each row execute function private.enex_validate_assignment();
 create trigger enex_assignment_audit after insert or update on enex_assignments for each row execute function private.enex_audit_assignment();
 revoke all on function enex_my_pending(text),enex_charge_center(text,uuid,integer) from public,anon;
 grant execute on function enex_my_pending(text),enex_charge_center(text,uuid,integer) to authenticated;
 `);
 return db;
}
export async function rpc(db, owner, name, args) {
 return db.transaction(async tx => {
  await tx.query("select set_config('test.uid',$1,true)",[uid(owner)]);
  await tx.exec('set local role authenticated');
  if(name==='enex_my_pending')return (await tx.query('select enex_my_pending($1) result',[args.p_company])).rows[0].result;
  if(name==='enex_charge_center'){await tx.query('select enex_charge_center($1,$2,$3)',[args.p_company,args.p_id,args.p_center]);return null;}
  throw new Error('Unexpected test RPC');
 });
}
