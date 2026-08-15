import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const norm=(value:unknown)=>String(value||"").trim().toLocaleLowerCase("es-CL");
const modules:Record<string,{label:string,permission:string,tables:string[]}>= {
 dashboard:{label:"Inicio",permission:"",tables:["obras"]},
 obras:{label:"Proyectos y Obras",permission:"obras",tables:["obras","partidas_obra","avances_produccion_partidas","estados_pago_obra"]},
 admin:{label:"Panel de Control",permission:"admin",tables:["usuarios","roles"]},
 rrhh:{label:"Recursos Humanos",permission:"rrhh",tables:["maestro_personal","rrhh_asignaciones_personal"]},
 maquinaria:{label:"Maquinaria y Equipos",permission:"maquinaria",tables:["inventario_maquinaria","maquinaria_mantenciones","maquinaria_fallas","maquinaria_uso_diario"]},
 bodega:{label:"Bodega e Inventario",permission:"bodega",tables:["bodega_bodegas","bodega_productos","bodega_movimientos"]},
 prevencion:{label:"Prevención de Riesgos",permission:"prevencion",tables:["prevencion_formularios","prevencion_respuestas","prevencion_cumplimiento_registros"]},
 formularios:{label:"Formularios y Capacitación",permission:"formularios",tables:["prevencion_formularios","prevencion_respuestas","prevencion_capacitaciones","prevencion_capacitaciones_intentos"]},
 acreditaciones:{label:"Acreditaciones",permission:"acreditaciones",tables:["acreditaciones_subcontratos","acreditaciones_proveedores","acreditaciones_internas"]},
 calidad:{label:"Calidad",permission:"obras",tables:["calidad_pac","calidad_rdi","calidad_no_conformidades","calidad_recepciones_partidas"]},
 presupuestos:{label:"Presupuestos",permission:"presupuestos",tables:["presupuestos_proyectos","presupuestos_items","planificacion_cronogramas"]},
 clientes:{label:"Clientes",permission:"clientes",tables:["clientes_portales","clientes_portal_obras","clientes_portal_eventos"]},
 mandante:{label:"Gestion del Mandante",permission:"mandante",tables:["mandante_contratos","mandante_entregas","mandante_obligaciones","mandante_acreditaciones"]},
 facturacion:{label:"Facturación",permission:"facturacion",tables:["dte_documentos_operacion","facturacion_centros_gestion"]},
 gastos:{label:"Rendición de Gastos",permission:"gastos",tables:["gastos_rendiciones","gastos_rendicion_items"]}
};
const schema={type:"object",additionalProperties:false,properties:{respuesta_breve:{type:"string"},hechos:{type:"array",items:{type:"object",additionalProperties:false,properties:{texto:{type:"string"},fuente_id:{type:"string"}},required:["texto","fuente_id"]}},calculos:{type:"array",items:{type:"object",additionalProperties:false,properties:{nombre:{type:"string"},valor:{type:"string"},base:{type:"string"}},required:["nombre","valor","base"]}},sugerencias:{type:"array",items:{type:"object",additionalProperties:false,properties:{accion:{type:"string"},prioridad:{type:"string",enum:["Alta","Media","Baja"]},motivo:{type:"string"}},required:["accion","prioridad","motivo"]}},limitaciones:{type:"array",items:{type:"string"}}},required:["respuesta_breve","hechos","calculos","sugerencias","limitaciones"]};
const isSuper=(p:any)=>norm(p?.rol_base||p?.rol).includes("superusuario")||(norm(p?.empresa)==="obraxis"&&norm(p?.rol).includes("admin"));
const moduleList=(raw:unknown)=>String(raw||"").split(",").map(norm).filter(Boolean);
const roleDefaultCanView=(profile:any)=>Boolean(profile?.rol||profile?.rol_base);

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const started=Date.now();let reservationId:string|undefined;let db:any;
 try{
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),url=Deno.env.get("SUPABASE_URL");
  if(!serviceKey||!url)return json({error:"OX no está configurado en el servidor."},503);
  db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const{data:authData,error:authError}=await db.auth.getUser(token);
  if(authError||!authData?.user)return json({error:"Debes iniciar sesión."},401);
  const body=await req.json(),empresa=String(body?.empresa||"").trim(),modulo=norm(body?.modulo),pregunta=String(body?.pregunta||"").trim();
  if(!empresa||!modules[modulo]||pregunta.length<4||pregunta.length>1000)return json({error:"Módulo o consulta no válida."},400);
  const{data:profile}=await db.from("usuarios").select("id,usuario,nombre,correo,empresa,rol,rol_base,modulos,permisos").eq("auth_user_id",authData.user.id).maybeSingle();
  if(!profile||(!isSuper(profile)&&norm(profile.empresa)!==norm(empresa)))return json({error:"Cuenta no autorizada para esta empresa."},403);
  const{data:role}=await db.from("roles").select("permisos").eq("empresa",profile.empresa).eq("nombre",profile.rol||profile.rol_base||"").maybeSingle();
  const effective={...(role?.permisos||{}),...(profile.permisos||{})},required=modules[modulo].permission;
  const explicit=required?Object.entries(effective).filter(([key])=>key.startsWith(`${required}.`)&&key.endsWith(".ver")):[];
  const contracted=moduleList(profile.modulos);
  const allowed=isSuper(profile)||modulo==="dashboard"||((contracted.includes(required)||contracted.includes(modulo))&&(explicit.length?explicit.some(([,value])=>value===true):roleDefaultCanView(profile)));
  if(!allowed)return json({error:"No tienes permiso para consultar este módulo con OX."},403);

  const context:any={modulo:{id:modulo,nombre:modules[modulo].label},indicadores:[],fuentes:[]};
  for(const table of modules[modulo].tables){
   let query=db.from(table).select("*",{count:"exact",head:true});
   if(modulo!=="dashboard")query=query.eq("empresa",empresa);
   else query=query.eq("empresa",empresa);
   const{count,error}=await query;
   if(!error){const sourceId=`${modulo}:${table}`;context.indicadores.push({nombre:table,total:count||0,fuente_id:sourceId});context.fuentes.push({id:sourceId,modulo:modules[modulo].label,referencia:table,destino:modulo});}
  }
  if(!context.indicadores.length)return json({error:"No existen fuentes autorizadas disponibles para este módulo."},422);
  const[{data:globalConfig},{data:companyConfig}]=await Promise.all([db.from("config_global_obraxis").select("ia_habilitada,ia_modelo").eq("id",1).maybeSingle(),db.from("ia_config_empresas").select("*").eq("empresa",empresa).maybeSingle()]);
  if(globalConfig?.ia_habilitada===false||companyConfig?.habilitada!==true||companyConfig?.funciones?.copiloto!==true)return json({error:"OX no está habilitado para esta empresa."},403);
  const allowedRoles=companyConfig?.limites_funcion?.copiloto?.roles_autorizados||[];
  if(allowedRoles.length&&!allowedRoles.some((item:string)=>norm(item)===norm(profile.rol)))return json({error:"Tu rol no está autorizado para utilizar OX."},403);
  const openAIKey=Deno.env.get("OPENAI_API_KEY");if(!openAIKey)return json({error:"OX no tiene proveedor de IA configurado."},503);
  const model=companyConfig?.modelo||globalConfig?.ia_modelo||"gpt-4.1-mini";
  const{data:reserved,error:reserveError}=await db.rpc("ia_reservar_consumo",{p_empresa:empresa,p_obra_nombre:null,p_auth_user_id:authData.user.id,p_usuario:profile.nombre||profile.usuario||profile.correo,p_funcion:"copiloto",p_modelo:model,p_reserva_usd:.015});
  if(reserveError)return json({error:reserveError.message},429);reservationId=reserved;
  const prompt=`Eres OX, asistente transversal de Obraxis. Responde exclusivamente con el contexto agregado autorizado del módulo ${modules[modulo].label}. No infieras datos personales ni detalles no presentes. Distingue hechos, cálculos y sugerencias. Cada hecho debe usar un fuente_id de contexto.fuentes. Eres de solo lectura: no modifiques, apruebes, envíes ni cierres registros. Si el agregado no permite responder, indícalo en limitaciones. Consulta: ${pregunta}`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_text",text:JSON.stringify(context)}]}],text:{format:{type:"json_schema",name:"ox_modulo",strict:true,schema}}})});
  const apiData=await response.json();if(!response.ok)throw new Error(apiData?.error?.message||"No fue posible consultar OX.");
  const raw=apiData.output_text||apiData.output?.flatMap((item:any)=>item.content||[]).find((item:any)=>item.type==="output_text")?.text;if(!raw)throw new Error("OX no devolvió una respuesta utilizable.");
  const parsed=JSON.parse(raw),sourceMap=new Map(context.fuentes.map((source:any)=>[source.id,source]));
  const result={...parsed,hechos:(parsed.hechos||[]).flatMap((fact:any)=>{const source:any=sourceMap.get(fact.fuente_id);return source?[{...fact,modulo:source.modulo,referencia:source.referencia,destino:source.destino}]:[]}),meta:{modo:"IA",generado_con_ia:true,modulo}};
  const inputTokens=Number(apiData.usage?.input_tokens||0),outputTokens=Number(apiData.usage?.output_tokens||0),cost=(inputTokens*.40+outputTokens*1.60)/1_000_000;
  await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Completado",p_tokens_entrada:inputTokens,p_tokens_salida:outputTokens,p_costo_usd:cost,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:"",p_metadatos:{modulo,fuentes:result.hechos.map((item:any)=>item.fuente_id)}});
  const{data:history}=await db.from("ox_consultas_modulo").insert({empresa,modulo,auth_user_id:authData.user.id,usuario:profile.nombre||profile.usuario||profile.correo,pregunta,respuesta:result,ia_consumo_id:reservationId}).select("id,created_at").single();
  return json({data:result,consulta:history,usage:{tokens_total:inputTokens+outputTokens,costo_usd:cost}});
 }catch(error){if(reservationId&&db)await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Error",p_tokens_entrada:0,p_tokens_salida:0,p_costo_usd:0,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:error instanceof Error?error.message:String(error),p_metadatos:{}});return json({error:error instanceof Error?error.message:String(error)},400);}
});
