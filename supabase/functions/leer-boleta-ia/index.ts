import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const receiptSchema={type:"object",additionalProperties:false,properties:{tipo_documento:{type:"string",enum:["Boleta","Factura","Comprobante","Otro"]},proveedor:{type:"string"},rut_proveedor:{type:"string"},folio:{type:"string"},fecha_documento:{type:"string"},monto_neto:{type:"number"},monto_iva:{type:"number"},monto_total:{type:"number"},categoria:{type:"string",enum:["Alimentación","Combustible","Peajes","Alojamiento","Materiales","Herramientas","Transporte","Otros"]},descripcion:{type:"string"},confianza:{type:"number"},advertencias:{type:"array",items:{type:"string"}}},required:["tipo_documento","proveedor","rut_proveedor","folio","fecha_documento","monto_neto","monto_iva","monto_total","categoria","descripcion","confianza","advertencias"]};
const normalize=value=>String(value||"").toLowerCase().replace(/[^a-z0-9k]/g,"");
const centerScore=(center:any,category:string,description:string)=>{const haystack=normalize(`${center.codigo} ${center.nombre} ${center.descripcion||""} ${center.tipo||""}`),words=normalize(`${category} ${description}`).match(/[a-z0-9k]{4,}/g)||[];return words.reduce((score,word)=>score+(haystack.includes(word)?1:0),0)};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const started=Date.now();let reservationId:string|undefined;let db:any;
 try{
  const openAIKey=Deno.env.get("OPENAI_API_KEY");if(!openAIKey)return json({error:"La lectura IA requiere configurar OPENAI_API_KEY en Supabase Edge Functions."},503);
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!serviceKey)return json({error:"No está disponible la conexión segura del servidor."},503);
  db=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}});
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return json({error:"Debes iniciar sesión para utilizar la lectura inteligente."},401);
  const{data:authData,error:authError}=await db.auth.getUser(token);if(authError||!authData?.user)return json({error:"La sesión no es válida o expiró."},401);
  const body=await req.json();const{image_base64,mime_type,empresa:requestedCompany,obra_nombre}=body||{};
  if(!image_base64||!String(mime_type||"").startsWith("image/"))throw new Error("Adjunta una imagen JPG, PNG o WEBP.");
  let profileQuery=db.from("usuarios").select("usuario,nombre,correo,empresa").eq("auth_user_id",authData.user.id);if(requestedCompany)profileQuery=profileQuery.eq("empresa",requestedCompany);
  const{data:profiles,error:profileError}=await profileQuery.limit(2);if(profileError)throw profileError;if(!profiles?.length)return json({error:"La cuenta no tiene un perfil autorizado para esta empresa."},403);const profile=profiles[0];
  const[{data:globalConfig},{data:companyConfig},{data:centers}]=await Promise.all([
   db.from("config_global_obraxis").select("ia_habilitada,ia_proveedor,ia_modelo,ia_confianza_minima,ia_archivo_max_mb").eq("id",1).maybeSingle(),
   db.from("ia_config_empresas").select("*").eq("empresa",profile.empresa).maybeSingle(),
   db.from("facturacion_centros_gestion").select("id,codigo,nombre,descripcion,tipo").eq("empresa",profile.empresa).eq("activo",true).order("codigo")
  ]);
  if(globalConfig?.ia_habilitada===false)return json({error:"Las funciones de inteligencia artificial están deshabilitadas globalmente."},503);
  if(globalConfig?.ia_proveedor&&String(globalConfig.ia_proveedor).toLowerCase()!=="openai")return json({error:`El proveedor ${globalConfig.ia_proveedor} aún no está disponible para lectura documental.`},503);
  const estimatedBytes=Math.ceil(String(image_base64).length*.75),maxMb=Number(globalConfig?.ia_archivo_max_mb||10);if(estimatedBytes>maxMb*1024*1024)throw new Error(`La imagen supera el máximo global de ${maxMb} MB.`);
  const model=companyConfig?.modelo||globalConfig?.ia_modelo||Deno.env.get("OPENAI_RECEIPT_MODEL")||"gpt-4.1-mini";
  const{data:reserved,error:reserveError}=await db.rpc("ia_reservar_consumo",{p_empresa:profile.empresa,p_obra_nombre:obra_nombre||"",p_auth_user_id:authData.user.id,p_usuario:profile.nombre||profile.usuario||profile.correo,p_funcion:"lectura_documental",p_modelo:model,p_reserva_usd:.02});if(reserveError)return json({error:reserveError.message},429);reservationId=reserved;
  const prompt=`Lee este comprobante chileno. Extrae sólo datos visibles, usa fecha YYYY-MM-DD, montos CLP sin separadores y confianza de 0 a 100. No inventes: usa cadena vacía o 0 y agrega una advertencia. Sugiere la categoría del gasto. La confianza mínima operativa es ${globalConfig?.ia_confianza_minima||75}%.`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:`data:${mime_type};base64,${image_base64}`}]}],text:{format:{type:"json_schema",name:"lectura_boleta",strict:true,schema:receiptSchema}}})});
  const apiData=await response.json();if(!response.ok)throw new Error(apiData?.error?.message||"No fue posible analizar la imagen.");const raw=apiData.output_text||apiData.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;if(!raw)throw new Error("El proveedor no devolvió una lectura utilizable.");const result=JSON.parse(raw);
  const rankedCenters=(centers||[]).map(center=>({center,score:centerScore(center,result.categoria,result.descripcion)})).sort((a,b)=>b.score-a.score);const suggestedCenter=rankedCenters[0]?.score>0?rankedCenters[0].center:null;result.centro_gestion_sugerido_id=suggestedCenter?.id||null;result.centro_gestion_sugerido=suggestedCenter?`${suggestedCenter.codigo} · ${suggestedCenter.nombre}`:"";
  const{data:candidates,error:duplicateError}=await db.from("gastos_rendicion_items").select("id,folio,rut_proveedor,proveedor,fecha_documento,monto_total,rendicion_id").eq("empresa",profile.empresa).eq("monto_total",Number(result.monto_total||0)).limit(20);if(duplicateError)throw duplicateError;
  const exact=(candidates||[]).filter(item=>{
   const sameRut=result.rut_proveedor&&item.rut_proveedor&&normalize(item.rut_proveedor)===normalize(result.rut_proveedor);
   const sameProvider=!result.rut_proveedor&&normalize(item.proveedor)===normalize(result.proveedor);
   const sameFolio=result.folio&&item.folio&&normalize(item.folio)===normalize(result.folio);
   const sameDate=result.fecha_documento&&item.fecha_documento===result.fecha_documento;
   return (sameRut||sameProvider)&&(sameFolio||sameDate);
  });
  result.duplicado={detectado:exact.length>0,coincidencias:exact.map(item=>({id:item.id,rendicion_id:item.rendicion_id,proveedor:item.proveedor,folio:item.folio,fecha_documento:item.fecha_documento,monto_total:Number(item.monto_total) }))};
  if(exact.length)result.advertencias=[...(result.advertencias||[]),`Posible comprobante duplicado: ${exact.length} coincidencia(s) previa(s).`];
  const inputTokens=Number(apiData.usage?.input_tokens||0),outputTokens=Number(apiData.usage?.output_tokens||0),cost=(inputTokens*.40+outputTokens*1.60)/1_000_000;
  await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Completado",p_tokens_entrada:inputTokens,p_tokens_salida:outputTokens,p_costo_usd:cost,p_confianza:Number(result.confianza||0),p_duracion_ms:Date.now()-started,p_error_detalle:"",p_metadatos:{mime_type,bytes:estimatedBytes,duplicado:exact.length>0,centro_sugerido_id:result.centro_gestion_sugerido_id}});
  return json({data:result,usage:{tokens_entrada:inputTokens,tokens_salida:outputTokens,costo_usd:cost}});
 }catch(error){if(reservationId&&db)await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Error",p_tokens_entrada:0,p_tokens_salida:0,p_costo_usd:0,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:error instanceof Error?error.message:String(error),p_metadatos:{}});return json({error:error instanceof Error?error.message:String(error)},400)}
});
