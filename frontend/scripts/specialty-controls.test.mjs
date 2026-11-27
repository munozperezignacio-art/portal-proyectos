import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('protocol settings and pile controls persist without changing saved snapshots',async()=>{
 const db=new PGlite();
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid')::uuid$$;
 create table obras(id integer primary key,empresa text,nombre text);
 create table usuarios(id integer,auth_user_id uuid,empresa text,nombre text,usuario text,rol text,rol_base text,obras text);
 create table partidas_obra(id integer primary key,obra_id integer,empresa text,partida text,unidad text,es_titulo boolean);
 create table notificaciones_reglas(id uuid,empresa text,activa boolean,evento_codigo text,hora_envio time,canal_push boolean,condiciones jsonb,obra_nombre text);
 create table avances_produccion_partidas(id serial primary key,empresa text,obra_id integer,obra_nombre text,supervisor text,partida_id integer,partida text,unidad text,cantidad numeric,observaciones text,created_at timestamptz);
 create function private.rrhh_partidas_permiso(text,integer,text) returns boolean language sql as $$select exists(select 1 from public.usuarios u join public.obras o on o.id=$2 where u.auth_user_id=auth.uid() and u.empresa=$1 and o.empresa=$1)$$;
 create function private.obraxis_permission(text,text) returns boolean language sql as $$select case when $2 like 'obras.calidad.%' then current_setting('test.quality_permission',true)=$2 else current_setting('test.can_create',true)='yes' end$$;
 insert into obras values(1,'A','Obra A'),(2,'B','Obra B');
 insert into partidas_obra values(1,1,'A','Pilas','UND',false),(2,2,'B','Pilas','UND',false);
 insert into usuarios values(1,'00000000-0000-4000-8000-000000000001','A','Admin','a','Administrador de Empresa',null,'Todas'),(2,'00000000-0000-4000-8000-000000000002','A','Ejecutor','e','Supervisor',null,'Todas');
 set test.uid='00000000-0000-4000-8000-000000000001';`);
 await db.exec(await readFile(new URL('../../supabase/schema/specialty-reporting.sql',import.meta.url),'utf8'));
 const call=async(action,data,work=1)=>(await db.query('select public.specialty_api($1,$2,$3) as r',[work,action,JSON.stringify(data)])).rows[0].r;
 await call('configure',{partida_id:1,ejecucion:'00000000-0000-4000-8000-000000000002',activa_desde:'2026-01-01'});

 try{
 const actor='00000000-0000-4000-8000-000000000001';
 await call('configure',{partida_id:1,revision:1,ejecucion:actor,topografia:actor,calidad:actor,activa_desde:'2026-01-01'});
 const fixed={volumen_cuchara:0.3,diametro:0.66,plataforma_proyecto:99.48,usar_cota_plataforma:true,puntos_referencia:[{referencia:'PR-1',norte:100,este:200,elevacion:99.48}],autocontrol:{pilas_grava:'si'}};
 await call('protocol_defaults',{partida_id:1,datos_fijos:fixed});
 await call('catalog',{partida_id:1,rows:[{etapa:'1',numero:'1',norte:1,este:2,longitud_diseno:6}]});
 const element_id=(await call('state',{})).elements[0].id;
 const data={cota_inicial:10,cota_final:4,norte_real:1,este_real:2,cota_diseno:88,tipo_control:'BST',deformacion:0.2,profundidad_control:1.5,observaciones:'Comentario solo pila 1',referencia:'Dato histórico'};
 await call('topography',{partida_id:1,element_id,revision:0,datos:data});
 assert.deepEqual((await call('state',{})).elements[0].topografia,data);
 await db.exec("set test.can_create='yes'");
 const session={id:'10000000-0000-4000-8000-000000000001',partida_id:1,fecha:'2026-01-01',revision:0,datos:{pilas:[{element_id,terminada:true,equipo:'Equipo',paladas:4,volumen:1.2,longitud:6}]}};
 await call('close',session);
 const protocol={id:session.id,protocol_id:'30000000-0000-4000-8000-000000000001',tipo:'ejecucion',correlativo:'1',estado:'borrador',element_ids:[element_id],fijos:fixed};
 await call('protocol',protocol);
 const before=(await call('state',{})).protocols[0].snapshot;
 assert.deepEqual(before.pilas[0].topografia,data);
 assert.equal(before.fijos.plataforma_proyecto,99.48);
 assert.equal(before.fijos.puntos_referencia[0].referencia,'PR-1');
 await call('protocol_defaults',{partida_id:1,datos_fijos:{...fixed,plataforma_proyecto:101}});
 await call('topography',{partida_id:1,element_id,revision:1,datos:{...data,observaciones:'Nuevo comentario'}});
 assert.deepEqual((await call('state',{})).protocols[0].snapshot,before,'Existing snapshot must stay unchanged');
 }finally{await db.close();}
});
