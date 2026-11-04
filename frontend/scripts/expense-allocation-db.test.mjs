import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('allocation is atomic, permission checked and preserves original costs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema private;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.rrhh_partidas_permiso(c text,w integer,a text) returns boolean language sql as $$select c='A' and w=1 and auth.uid()='10000000-0000-0000-0000-000000000001'::uuid$$;
 create table obras(id integer,empresa text,nombre text);insert into obras values(1,'A','Obra');
 create table partidas_obra(id integer,empresa text,obra_id integer,es_titulo boolean,unidad text,tipo_item text,partida text,cantidad_presupuestada numeric,costo_por_dia numeric);
 insert into partidas_obra values(1,'A',1,false,'UND','PARTIDA','Uno',3,100),(2,'A',1,false,'UND','PARTIDA','Dos',1,100);
 create table costos_reales_obra(id bigint primary key,empresa text,obra_nombre text,origen text,monto numeric,monto_iva numeric,imputaciones jsonb);
 insert into costos_reales_obra values(1,'A','Obra','iconstruye_rendicion',1000,190,'[]'),(2,'A','Obra','iconstruye_oc',2000,380,'[]');
 grant usage on schema auth,private to authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261104182000_imputar_gastos_importados.sql',import.meta.url),'utf8'));
 const parts=JSON.stringify([{partida_id:1,presupuesto:300},{partida_id:2,presupuesto:100}]);
 const run=(costs,who='10000000-0000-0000-0000-000000000001',p=parts)=>db.transaction(async tx=>{await tx.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${who}',true)`);return tx.query('select public.imputar_gastos_importados($1,$2,$3,$4) result',['A',1,JSON.stringify(costs),p]);});
 await assert.rejects(run([{id:1,monto:1000}],'10000000-0000-0000-0000-000000000002'),{code:'42501'});
 await assert.rejects(run([{id:1,monto:1000},{id:2,monto:99}]));
 assert.deepEqual((await db.query('select imputaciones from costos_reales_obra where id=1')).rows[0].imputaciones,[]);
 await assert.rejects(run([{id:1,monto:1000}],undefined,JSON.stringify([{partida_id:1,presupuesto:299}])));
 const result=await run([{id:1,monto:1000},{id:2,monto:2000}]);
 assert.equal(result.rows[0].result.length,2);
 assert.deepEqual(result.rows[0].result[0].imputaciones.map(p=>Number(p.porcentaje)),[75,25]);
 assert.equal(result.rows[0].result[0].monto_iva,190);
 assert.equal((await db.query('select count(*)::int n from costos_reales_obra')).rows[0].n,2);
 await assert.rejects(run([{id:1,monto:1000}]));
 }finally{await db.close();}
});
