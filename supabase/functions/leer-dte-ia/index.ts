import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const schema={type:"object",additionalProperties:false,properties:{tipo_dte:{type:"integer",enum:[33,34,52,56,61]},folio:{type:"string"},fecha_emision:{type:"string"},fecha_vencimiento:{type:"string"},rut_emisor:{type:"string"},razon_social_emisor:{type:"string"},giro_emisor:{type:"string"},direccion_emisor:{type:"string"},comuna_emisor:{type:"string"},monto_neto:{type:"number"},monto_exento:{type:"number"},monto_iva:{type:"number"},monto_total:{type:"number"},items:{type:"array",items:{type:"object",additionalProperties:false,properties:{descripcion:{type:"string"},cantidad:{type:"number"},unidad:{type:"string"},precio_unitario:{type:"number"},descuento:{type:"number"},exento:{type:"boolean"}},required:["descripcion","cantidad","unidad","precio_unitario","descuento","exento"]}},referencias:{type:"array",items:{type:"object",additionalProperties:false,properties:{tipo_documento:{type:"integer"},folio:{type:"string"},fecha:{type:"string"},codigo_referencia:{type:"string"},razon:{type:"string"}},required:["tipo_documento","folio","fecha","codigo_referencia","razon"]}},confianza:{type:"number"},advertencias:{type:"array",items:{type:"string"}}},required:["tipo_dte","folio","fecha_emision","fecha_vencimiento","rut_emisor","razon_social_emisor","giro_emisor","direccion_emisor","comuna_emisor","monto_neto","monto_exento","monto_iva","monto_total","items","referencias","confianza","advertencias"]};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const started=Date.now();let reservationId:string|undefined;let db:any;
 try{
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),openAIKey=Deno.env.get("OPENAI_API_KEY");
  if(!serviceKey||!openAIKey)return json({error:"La lectura inteligente no está configurada en el servidor."},503);
  db=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}});
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const{data:authData,error:authError}=await db.auth.getUser(token);if(authError||!authData?.user)return json({error:"Debes iniciar sesión para importar documentos."},401);
  const body=await req.json();const{file_base64,mime_type,file_name,empresa:requestedCompany}=body||{};
  if(!file_base64||!mime_type)return json({error:"Falta el archivo del DTE."},400);
  const allowed=["application/pdf","image/jpeg","image/png","image/webp"];if(!allowed.includes(mime_type))return json({error:"Usa PDF, JPG, PNG o WEBP."},400);
  let profileQuery=db.from("usuarios").select("usuario,nombre,correo,empresa").eq("auth_user_id",authData.user.id);if(requestedCompany)profileQuery=profileQuery.eq("empresa",requestedCompany);
  const{data:profiles,error:profileError}=await profileQuery.limit(2);if(profileError)throw profileError;if(!profiles?.length)return json({error:"La cuenta no está autorizada para esta empresa."},403);const profile=profiles[0];
  const[{data:globalConfig},{data:companyConfig}]=await Promise.all([db.from("config_global_obraxis").select("ia_habilitada,ia_proveedor,ia_modelo,ia_archivo_max_mb").eq("id",1).maybeSingle(),db.from("ia_config_empresas").select("*").eq("empresa",profile.empresa).maybeSingle()]);
  if(globalConfig?.ia_habilitada===false)return json({error:"Las funciones de IA están deshabilitadas globalmente."},503);
  const bytes=Math.ceil(String(file_base64).length*.75),maxMb=Number(globalConfig?.ia_archivo_max_mb||10);if(bytes>maxMb*1024*1024)return json({error:`El documento supera el máximo de ${maxMb} MB.`},413);
  const model=companyConfig?.modelo||globalConfig?.ia_modelo||"gpt-4.1-mini";
  const{data:reserved,error:reserveError}=await db.rpc("ia_reservar_consumo",{p_empresa:profile.empresa,p_obra_nombre:"",p_auth_user_id:authData.user.id,p_usuario:profile.nombre||profile.usuario||profile.correo,p_funcion:"lectura_documental",p_modelo:model,p_reserva_usd:.05});if(reserveError)return json({error:reserveError.message},429);reservationId=reserved;
  const prompt="Extrae fielmente este DTE chileno recibido. Identifica si es factura electrónica (33), factura exenta (34), guía de despacho (52), nota de débito (56) o nota de crédito (61). Usa fechas YYYY-MM-DD. Los datos de contraparte son los del EMISOR. Extrae todas las referencias tributarias indicando tipo de documento, folio, fecha, código de referencia y razón; para notas de crédito o débito la referencia al DTE corregido es crítica. Si no hay referencias devuelve una lista vacía. No inventes valores: usa cadena vacía o cero y agrégalos a advertencias cuando no sean legibles. Separa cada línea de detalle y marca exento solo cuando corresponda. La suma es una ayuda y debe ser revisada por una persona antes de registrar.";
  const filePart=mime_type.startsWith("image/")?{type:"input_image",image_url:`data:${mime_type};base64,${file_base64}`}:{type:"input_file",filename:file_name||"dte.pdf",file_data:`data:${mime_type};base64,${file_base64}`};
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt},filePart]}],text:{format:{type:"json_schema",name:"lectura_dte",strict:true,schema}}})});
  const apiData=await response.json();if(!response.ok)throw new Error(apiData?.error?.message||"No fue posible leer el DTE.");const raw=apiData.output_text||apiData.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==="output_text")?.text;if(!raw)throw new Error("La IA no devolvió datos utilizables.");const result=JSON.parse(raw);
  const inputTokens=Number(apiData.usage?.input_tokens||0),outputTokens=Number(apiData.usage?.output_tokens||0),cost=(inputTokens*.40+outputTokens*1.60)/1_000_000;
  await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Completado",p_tokens_entrada:inputTokens,p_tokens_salida:outputTokens,p_costo_usd:cost,p_confianza:Number(result.confianza||0),p_duracion_ms:Date.now()-started,p_error_detalle:"",p_metadatos:{mime_type,bytes,file_name}});
  return json({data:result,usage:{tokens_total:inputTokens+outputTokens,costo_usd:cost}});
 }catch(error){if(reservationId&&db)await db.rpc("ia_finalizar_consumo",{p_id:reservationId,p_estado:"Error",p_tokens_entrada:0,p_tokens_salida:0,p_costo_usd:0,p_confianza:null,p_duracion_ms:Date.now()-started,p_error_detalle:error instanceof Error?error.message:String(error),p_metadatos:{}});return json({error:error instanceof Error?error.message:String(error)},400)}
});
