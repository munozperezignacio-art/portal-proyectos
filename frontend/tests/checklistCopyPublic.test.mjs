import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import * as fields from '../../supabase/functions/_shared/formFields.mjs';
import * as qr from '../../supabase/functions/_shared/equipmentQr.mjs';
test('public copied checklist loads trusted identity, saves snapshot and rejects another equipment',async()=>{
 const form={id:2,empresa:'TEST',titulo:'Copia',publico_token:'FORM_TEST_COPY',campos:{items:qr.withEquipmentFields([{id:'check',type:'radio',label:'Estado',options:['Bueno','Malo'],required:true}],{meter:true}),control_documental:{equipo_checklist_id:7}}};
 const equipment={id:7,empresa:'TEST',tipo:'MANIPULADOR',patente:'TEST-01',horometro_inicial:8822.4};
 let saved=null,handler;
 const db={rpc:async name=>({data:name==='equipo_qr_persona'?[{nombre:'Persona de prueba',cargo:'Operador'}]:name==='equipo_obra_registro'?null:[],error:null}),from:table=>{
  let payload;
  const result=()=>{if(table==='prevencion_respuestas'){saved=payload;return {data:{id:99},error:null};}
   return {data:table==='prevencion_formularios'?form:table==='inventario_maquinaria'?equipment:table==='maquinaria_reporte_equipo'?{qr_activo:true}:null,count:0,error:null};};
  const q={select:()=>q,eq:()=>q,gte:()=>q,maybeSingle:()=>q,single:()=>q,insert:p=>{payload=p;return q;},then:(a,b)=>Promise.resolve(result()).then(a,b)};return q;
 }};
 const source=(await readFile(new URL('../../supabase/functions/formulario-publico/index.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const Deno={env:{get:()=> 'test'},serve:fn=>{handler=fn;}};
 const names=['Deno','createClient',...Object.keys(fields),...Object.keys(qr)];
 new Function(...names,stripTypeScriptTypes(source)) (Deno,()=>db,...Object.values(fields),...Object.values(qr));
 const context={token:'a'.repeat(48),rut:'12345678-5',fecha:'2026-11-19'};
 const request=body=>handler(new Request('https://test',{method:'POST',body:JSON.stringify({token:form.publico_token,...body})}));
 const loaded=await request({action:'cargar',qrContext:context});assert.equal(loaded.status,200);
 const data=await loaded.json();assert.equal(data.initialAnswers.qr_nombre,'Persona de prueba');assert.equal(data.initialAnswers.qr_horometro,8822.4);
 const response=await request({action:'enviar',qrContext:context,respuestas:{...data.initialAnswers,qr_nombre:'Falsificado',check:'Bueno'}});
 assert.equal(response.status,200);assert.equal(saved.respuestas.qr_nombre,'Persona de prueba');assert.equal(saved.respuestas._qr_identidad.equipo_id,7);assert.deepEqual(saved.respuestas._qr_formulario.campos,form.campos);
 assert.equal((await request({action:'cargar'})).status,403);
 equipment.id=8;assert.equal((await request({action:'cargar',qrContext:context})).status,403);
});
