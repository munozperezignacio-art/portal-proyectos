import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {draftWeeklySchedule} from '../src/utils/weeklyWorkSchedule.js';
test('date versions recalculate only their interval, audit changes and override stale QR/app values',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function private.obraxis_actor_can_access_company(text) returns boolean language sql as $$select $1='TEST'$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select $1='TEST' and current_setting('test.allowed',true)='yes'$$;
 set test.allowed='yes';
 create table obras(id integer primary key,empresa text,jornada_semanal jsonb,jornada_ordinaria_horas numeric);
 create table usuarios(auth_user_id uuid,empresa text,nombre text,usuario text);
 create table asistencia_personal(id serial primary key,obra_id integer,empresa text,fecha_marcacion date,asistencia text,ingreso text,salida text,colacion text,jornada_aplicada jsonb,jornada_ordinaria_horas numeric,horas_ordinarias numeric,horas_extras_auto numeric,horas_extras_manual numeric,otras_horas numeric);
 insert into obras values(1,'TEST',null,9),(2,'OTHER',null,9);`);
 await db.exec(await readFile(new URL('../../supabase/schema_jornada_semanal.sql',import.meta.url),'utf8'));
 const base=draftWeeklySchedule({}),changed=structuredClone(base);changed[1].end='17:00';
 await db.query('update obras set jornada_semanal=$1 where id=1',[JSON.stringify(base)]);
 await db.exec(`insert into asistencia_personal(obra_id,empresa,fecha_marcacion,asistencia,ingreso,salida,colacion,horas_extras_manual,otras_horas) values(1,'TEST','2026-10-12','PRESENTE','08:00','19:00','SI',3,0.5),(1,'TEST','2026-10-19','PRESENTE','08:00','19:00','SI',3,0.5),(1,'TEST','2026-11-02','PRESENTE','08:00','19:00','SI',3,0.5);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261119155328_work_schedule_effective_history.sql',import.meta.url),'utf8'));
 const save=(date,schedule,revision=0,work=1)=>db.query("select public.guardar_jornada_obra($1,$2,$3,'Cambio de prueba',$4) result",[work,date,JSON.stringify(schedule),revision]);
 let result=(await save('2026-10-19',changed)).rows[0].result;assert.equal(result.recalculados,2);
 let rows=(await db.query('select * from asistencia_personal order by id')).rows;
 assert.deepEqual(rows.map(r=>Number(r.horas_extras_auto)),[1,2,2]);assert.ok(rows.every(r=>Number(r.horas_extras_manual)===3&&Number(r.otras_horas)===0.5));
 assert.equal((await db.query('select count(*)::int n from obra_jornada_recalculos')).rows[0].n,2);
 await assert.rejects(save('2026-10-19',base),/cambió/);
 await assert.rejects(save('2026-10-19',base,0,2),/permiso/);
 const first=result.jornadas_historial[0].id;
 result=(await save('2026-11-02',base,first)).rows[0].result;assert.equal(result.recalculados,1);
 const second=Math.max(...result.jornadas_historial.map(r=>Number(r.id)));
 result=(await save('2026-10-19',changed,second)).rows[0].result;assert.equal(result.recalculados,1);
 rows=(await db.query('select * from asistencia_personal order by id')).rows;assert.deepEqual(rows.map(r=>Number(r.horas_extras_auto)),[1,2,1]);
 await db.query(`insert into asistencia_personal(obra_id,empresa,fecha_marcacion,asistencia,ingreso,salida,colacion,jornada_aplicada,horas_extras_auto) values(1,'TEST','2026-10-26','PRESENTE','08:00','19:00','SI',$1,99)`,[JSON.stringify(base[1])]);
 assert.equal(Number((await db.query('select horas_extras_auto from asistencia_personal order by id desc limit 1')).rows[0].horas_extras_auto),2);
 await assert.rejects(db.exec(`update obras set jornadas_historial='[]' where id=1`),/historial/);
 await assert.rejects(db.query('update obras set jornada_semanal=$1 where id=1',[JSON.stringify(changed)]),/vigencia/);
 await db.exec(`set test.allowed='no'`);await assert.rejects(save('2026-11-02',base,second),/permiso/);
 }finally{await db.close();}
});
