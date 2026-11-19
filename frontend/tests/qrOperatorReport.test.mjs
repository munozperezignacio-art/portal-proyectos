import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import * as qr from '../../supabase/functions/_shared/equipmentQr.mjs';
import {PGlite} from '@electric-sql/pglite';
test('resolved operator passes the actual database insert validator and persists the report',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
 create table maquinaria_operadores(id uuid,empresa text,nombre text,activo boolean);
 create table usuarios(auth_user_id uuid,nombre text,usuario text);
 create table maquinaria_uso_diario(id serial,empresa text,operador_id uuid,operador text,reporte_datos jsonb,registrado_por text);
 insert into maquinaria_operadores values('00000000-0000-0000-0000-000000000007','TEST','Operador habilitado',true);`);
 const migration=await readFile(new URL('../../supabase/migrations/20261027200255_maquinaria_operadores_catalogo_reportes.sql',import.meta.url),'utf8');
 await db.exec(migration.match(/create function private\.maquinaria_validar_operador\(\)[\s\S]*?end;\$\$;/)[0]);
 await db.exec('create trigger validar before insert on maquinaria_uso_diario for each row execute function private.maquinaria_validar_operador()');
 await assert.rejects(db.exec(`insert into maquinaria_uso_diario(empresa,reporte_datos) values('TEST','{"operador_id":null}')`),/operador habilitado/);
 await db.exec(`insert into maquinaria_uso_diario(empresa,reporte_datos) values('TEST','{"operador_id":"00000000-0000-0000-0000-000000000007","origen":"qr","autor_declarado":"Persona prueba"}')`);
 const rows=(await db.query('select * from maquinaria_uso_diario')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].operador,'Operador habilitado');assert.equal(rows[0].operador_id,'00000000-0000-0000-0000-000000000007');
 }finally{await db.close();}
});
test('QR resolves active operator by verified personnel and company; rejects missing/inactive/foreign operators',async()=>{
 let handler,saved=null,lookupError=false;
 let operators=[{id:'00000000-0000-0000-0000-000000000007',empresa:'TEST',trabajador_id:42,activo:true}];
 const db={rpc:async(name,args)=>{
  if(name==='equipo_qr_persona')return {data:[{id:42,nombre:'Operador prueba',cargo:'Operador'}],error:null};
  if(name==='registrar_reporte_maquinaria'){saved=args;return {data:{id:99},error:null};}
  return {data:[],error:null};
 },from:table=>{
  const filters={};
  const result=()=>{
   if(table==='maquinaria_operadores')return {data:operators.find(row=>Object.entries(filters).every(([key,value])=>row[key]===value))||null,error:lookupError?{message:'Unavailable'}:null};
   return {count:0,error:null,data:table==='inventario_maquinaria'?{id:7,empresa:'TEST',tipo:'EXCAVADORA',patente:'TEST-01'}:table==='formulario_publico_intentos'?{id:1}:{qr_activo:true}};
  };
  const q={select:()=>q,eq:(key,value)=>{filters[key]=value;return q;},gte:()=>q,insert:()=>q,update:()=>q,single:()=>q,maybeSingle:()=>q,then:(a,b)=>Promise.resolve(result()).then(a,b)};return q;
 }};
 const source=(await readFile(new URL('../../supabase/functions/maquinaria-publica/index.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 new Function('Deno','createClient',...Object.keys(qr),stripTypeScriptTypes(source))({env:{get:()=> 'test'},serve:fn=>{handler=fn;}},()=>db,...Object.values(qr));
 const request=(action='registrar')=>handler(new Request('https://test',{method:'POST',body:JSON.stringify({action,token:'a'.repeat(48),rut:'12.345.678-5',solicitud_id:'00000000-0000-0000-0000-000000000001',operador_id:'forged',operador:'Falso'})}));
 assert.equal((await request()).status,200);
 assert.equal(saved.p_datos.operador_id,operators[0].id);assert.equal(saved.p_datos.operador,'Operador prueba');
 assert.equal(saved.p_solicitud,'00000000-0000-0000-0000-000000000001');assert.equal(saved.p_datos.rut,undefined);
 for(const patch of [{activo:false},{empresa:'OTHER'},{trabajador_id:43}]){
  operators=[{id:'foreign',empresa:'TEST',trabajador_id:42,activo:true,...patch}];saved=null;
  assert.equal((await request()).status,403);assert.equal(saved,null);
 }
 operators=[];assert.equal((await request()).status,403);
 assert.equal((await request('identificar')).status,200);
 lookupError=true;assert.equal((await request()).status,503);assert.equal(saved,null);
});
