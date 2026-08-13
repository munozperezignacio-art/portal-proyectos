import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const num=(value:unknown)=>Number(value||0);
const normalized=(value:unknown)=>String(value||"").trim().toLocaleLowerCase("es-CL");
const schema={type:"object",additionalProperties:false,properties:{respuesta_breve:{type:"string"},hechos:{type:"array",items:{type:"object",additionalProperties:false,properties:{texto:{type:"string"},modulo:{type:"string"},referencia:{type:"string"}},required:["texto","modulo","referencia"]}},calculos:{type:"array",items:{type:"object",additionalProperties:false,properties:{nombre:{type:"string"},valor:{type:"string"},base:{type:"string"}},required:["nombre","valor","base"]}},sugerencias:{type:"array",items:{type:"object",additionalProperties:false,properties:{accion:{type:"string"},prioridad:{type:"string",enum:["Alta","Media","Baja"]},motivo:{type:"string"}},required:["accion","prioridad","motivo"]}},limitaciones:{type:"array",items:{type:"string"}}},required:["respuesta_breve","hechos","calculos","sugerencias","limitaciones"]};

const hasWorksiteAccess=(profile:any,worksite:string)=>{
  if(normalized(profile?.empresa)==="obraxis"&&normalized(profile?.rol).includes("superusuario"))return true;
  const raw=String(profile?.obras||"").trim();if(!raw)return false;
  if(["todas","todos","*"].includes(normalized(raw)))return true;
  let values:string[]=[];try{const parsed=JSON.parse(raw);values=Array.isArray(parsed)?parsed.map(String):[String(parsed)]}catch{values=raw.split(/[,;|]/)}
  return values.some(value=>normalized(value)===normalized(worksite));
};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const started=Date.now();let reservationId:string|undefined;let db:any;
 try{
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),openAIKey=Deno.env.get("OPENAI_API_KEY");
  if(!serviceKey||!openAIKey)return json({error:"El Copiloto no está configurado en el servidor."},503);
  db=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}});
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");const{data:authData,error:authError}=await db.auth.getUser(token);
  if(authError||!authData?.user)return json({error:"Debes iniciar sesión."},401);
  const body=await req.json();const empresa=String(body?.empresa||"").trim(),obraNombre=String(body?.obra_nombre||"").trim(),pregunta=String(body?.pregunta||"").trim();
  if(!empresa||!obraNombre||pregunta.length<4)return json({error:"Selecciona una obra y escribe una consulta válida."},400);
  if(pregunta.length>1000)return json({error:"La consulta supera el máximo de 1.000 caracteres."},400);
  const{data:profile}=await db.from("usuarios").select("usuario,nombre,correo,empresa,rol,rol_base,obras,modulos").eq("auth_user_id",authData.user.id).maybeSingle();
  if(!profile||normalized(profile.empresa)!==normalized(empresa))return json({error:"Cuenta no autorizada para esta empresa."},403);
  if(!hasWorksiteAccess(profile,obraNombre))return json({error:"No tienes acceso autorizado a esta obra."},403);
  const{data:worksite}=await db.from("obras").select("id,nombre,empresa,estado,tipo,cliente").eq("nombre",obraNombre).eq("empresa",empresa).maybeSingle();
  if(!worksite)return json({error:"La obra no existe o no pertenece a la empresa indicada."},404);
  const[{data:globalConfig},{data:companyConfig}]=await Promise.all([db.from("config_global_obraxis").select("ia_habilitada,ia_modelo").eq("id",1).maybeSingle(),db.from("ia_config_empresas").select("*").eq("empresa",empresa).maybeSingle()]);
  if(globalConfig?.ia_habilitada===false||companyConfig?.habilitada!==true)return json({error:"La IA está deshabilitada para esta empresa."},403);
  if(companyConfig?.funciones?.copiloto!==true)return json({error:"El Copiloto por obra no está contratado o habilitado."},403);
  const allowedRoles=companyConfig?.limites_funcion?.copiloto?.roles_autorizados||[];
  if(allowedRoles.length&&!allowedRoles.some((role:string)=>normalized(role)===normalized(profile.rol)))return json({error:"Tu rol no está autorizado para usar el Copiloto."},403);
  const model=companyConfig?.modelo||globalConfig?.ia_modelo||"gpt-4.1-mini";
  const{data:reserved,error:reserveError}=await db.rpc("ia_reservar_consumo",{p_empresa:empresa,p_obra_nombre:obraNombre,p_auth_user_id:authData.user.id,p_usuario:profile.nombre||profile.usuario||profile.correo,p_funcion:"copiloto",p_modelo:model,p_reserva_usd:.02});
  if(reserveError)return json({error:reserveError.message},429);reservationId=reserved;
  const[partsResult,advancesResult,costsResult,qualityResult,safetyResult,paymentsResult]=await Promise.all([
   db.from("partidas_obra").select("partida,unidad,cantidad_presupuestada,costo_por_dia,fecha_inicio,fecha_termino").eq("obra_nombre",obraNombre),
   db.from("avances_produccion_partidas").select("partida,cantidad,created_at").eq("obra_nombre",obraNombre),
   db.from("costos_reales_obra").select("nombre,tipo_costo,monto,created_at").eq("obra_nombre",obraNombre).eq("empresa",empresa),
   db.from("calidad_no_conformidades").select("codigo,partida,clasificacion,estado,fecha_compromiso").eq("obra_nombre",obraNombre).eq("empresa",empresa),
   db.from("prevencion_respuestas").select("id,created_at").eq("proyecto_nombre",obraNombre),
   db.from("estados_pago_obra").select("numero,fecha_corte,monto_bruto,monto_neto,estado,factura_estado").eq("obra_nombre",obraNombre).eq("empresa",empresa)
  ]);
  const parts=partsResult.data||[],advances=advancesResult.data||[],costs=costsResult.data||[],quality=qualityResult.data||[],payments=paymentsResult.data||[];
  const progressByPart=new Map<string,number>();advances.forEach((row:any)=>progressByPart.set(row.partida,num(progressByPart.get(row.partida))+num(row.cantidad)));
  const activities=parts.filter((row:any)=>!["TITULO","GRUPO"].includes(String(row.unidad||"").toUpperCase()));
  const activitySummaries=activities.map((row:any)=>{const reported=num(progressByPart.get(row.partida)),planned=num(row.cantidad_presupuestada);return{partida:row.partida,unidad:row.unidad,programado:planned,reportado:reported,avance_pct:planned>0?Math.min(100,reported/planned*100):null,fecha_inicio:row.fecha_inicio,fecha_termino:row.fecha_termino}}).sort((a:any,b:any)=>(a.avance_pct??101)-(b.avance_pct??101)).slice(0,30);
  const context={obra:{nombre:worksite.nombre,estado:worksite.estado,tipo:worksite.tipo},resumen:{partidas_activas:activities.length,reportes_avance:advances.length,costo_real_total:costs.reduce((s:number,x:any)=>s+num(x.monto),0),no_conformidades_abiertas:quality.filter((x:any)=>!["cerrada","cerrado","resuelta"].includes(normalized(x.estado))).length,registros_prevencion:safetyResult.data?.length||0,estados_pago:payments.length},partidas:activitySummaries,costos_por_tipo:Object.entries(costs.reduce((acc:any,row:any)=>{const key=row.tipo_costo||"Sin categoría";acc[key]=num(acc[key])+num(row.monto);return acc},{})).map(([tipo,monto])=>({tipo,monto})),calidad:quality.slice(0,25),estados_pago:payments.slice(0,20),fuentes:[{modulo:"Programación y Avances",referencia:"partidas_obra / avances_produccion_partidas"},{modulo:"Control de costos",referencia:"costos_reales_obra"},{modulo:"Calidad",referencia:"calidad_no_conformidades"},{modulo:"Prevención",referencia:"prevencion_respuestas"},{modulo:"Estados de pago",referencia:"estados_pago_obra"}]};
  const prompt=`Eres el Copiloto de Obraxis para control profesional de construcción. Responde SOLO con el contexto JSON de la obra autorizada. No inventes ni completes datos ausentes. Distingue hechos observados, cálculos ya contenidos y sugerencias profesionales. Cada hecho debe citar un módulo y referencia exactos de la lista de fuentes. Sé breve, directo y útil. No ordenes cambios ni afirmes que modificaste registros: este Copiloto es exclusivamente de lectura. Consulta: ${pregunta}`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_text",text:JSON.stringify(context)}]}],text:{format:{type:"json_schema",name:"copiloto_contextual_obra",strict:true,schema}}})});
  const apiData=await response.json();if(!response.ok)throw new Error(apiData?.error?.message||"No fue posible consultar el Copiloto.");
  const raw=apiData.output_text||apiData.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==="output_text")?.text;if(!raw)throw new Error("El Copiloto no devolvió una respuesta utilizable.");
  const result=JSON.parse(raw),inputTokens=num(apiData.usage?.input_tokens),outputTokens=num(apiData.usage?.output_tokens),cost=(inputTokens*.40+outputTokens*1.60)/1_000_000;
  await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Completado",p_tokens_entrada:inputTokens,p_tokens_salida:outputTokens,p_costo_usd:cost,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:"",p_metadatos:{obra_nombre:obraNombre,fuentes:context.fuentes.map((x:any)=>x.referencia)}});
  const{data:history}=await db.from("copiloto_obra_consultas").insert({empresa,obra_nombre:obraNombre,auth_user_id:authData.user.id,usuario:profile.nombre||profile.usuario||profile.correo,pregunta,respuesta:result,ia_consumo_id:reservationId}).select("id,created_at").single();
  return json({data:result,consulta:history,ia_consumo_id:reservationId,usage:{tokens_total:inputTokens+outputTokens,costo_usd:cost}});
 }catch(error){if(reservationId&&db)await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Error",p_tokens_entrada:0,p_tokens_salida:0,p_costo_usd:0,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:error instanceof Error?error.message:String(error),p_metadatos:{}});return json({error:error instanceof Error?error.message:String(error)},400)}
});
