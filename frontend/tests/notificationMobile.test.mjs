import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../mobile/package.json',import.meta.url));const ts=require('typescript');
const source=readFileSync(new URL('../../mobile/src/app/notificacion/[id].tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function open(value,record=null){
 const effects=[],routes=[],states=[],calls=[];const module={exports:{}};
 const deps={react:{useState:initial=>[initial,next=>states.push(next)],useEffect:fn=>effects.push(fn)},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'expo-router':{router:{replace:route=>routes.push(route),push:route=>routes.push(route)},useLocalSearchParams:()=>({id:'101'})},'react-native':{},'@/auth/AuthProvider':{useAuth:()=>({profile:{id:1}})},'@/theme/ThemeProvider':{useTheme:()=>({colors:{}})},'@/components/ui':{},'@/lib/notifications':{fetchNotificationDetail:async()=>value,fetchNotificationRecord:async(...args)=>{calls.push(args);return record;},markNotificationRead:async()=>{}}};
 new Function('require','module','exports',compiled)(name=>{if(!(name in deps))throw Error(name);return deps[name];},module,module.exports);
 module.exports.default();effects.forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,0));return {routes,states,calls};
}
test('mobile tap retrieves exact record directly, without routing to inbox',async()=>{
 const record={type:'maquinaria_uso_diario',records:[{id:41,fields:[]}]};const result=await open({id:101,evento_codigo:'obra_reporte_maquinaria',payload:{has_record:true}},record);
 assert.deepEqual(result.calls,[[1,101]]);assert.ok(result.states.includes(record));assert.deepEqual(result.routes,[]);
 const form=await open({id:101,payload:{has_record:true}},{type:'prevencion_respuestas',records:[{id:22,fields:[]}]});assert.deepEqual(form.routes,[{pathname:'/registro/[id]',params:{id:'22'}}]);
});
test('mobile pending notifications route to the right module and work section',async()=>{
 assert.deepEqual((await open({id:101,evento_codigo:'enex_pendiente',payload:{}})).routes,['/combustibles']);
 const work=await open({id:101,evento_codigo:'maquinaria_reporte_pendiente',obra_nombre:'Lonco',payload:{obra_id:5}});assert.equal(work.routes[0].params.id,'5');assert.equal(work.routes[0].params.seccion,'equipos');
 const form=await open({id:101,evento_codigo:'prevencion_cumplimiento_pendiente',payload:{obra_id:5,formulario_id:22}});assert.equal(form.routes[0].pathname,'/formulario/[id]');
 const request=await open({id:101,evento_codigo:'solicitudes_actualizacion',payload:{solicitud_id:9}});assert.equal(request.routes[0].params.id,'9');
});
