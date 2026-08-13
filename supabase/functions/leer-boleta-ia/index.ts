import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const key=Deno.env.get("OPENAI_API_KEY");
    if(!key) return new Response(JSON.stringify({error:"La lectura IA requiere configurar OPENAI_API_KEY en Supabase Edge Functions."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const db=serviceKey ? createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}}) : null;
    const {data:globalConfig}=db ? await db.from("config_global_obraxis").select("ia_habilitada,ia_proveedor,ia_modelo,ia_confianza_minima,ia_archivo_max_mb").eq("id",1).maybeSingle() : {data:null};
    if(globalConfig?.ia_habilitada===false) return new Response(JSON.stringify({error:"Las funciones de inteligencia artificial están deshabilitadas globalmente."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
    if(globalConfig?.ia_proveedor && String(globalConfig.ia_proveedor).toLowerCase()!=="openai") return new Response(JSON.stringify({error:`El proveedor ${globalConfig.ia_proveedor} aún no está disponible para lectura de comprobantes.`}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
    const {image_base64,mime_type}=await req.json();
    if(!image_base64||!String(mime_type||"").startsWith("image/")) throw new Error("Adjunta una imagen JPG, PNG o WEBP.");
    const estimatedBytes=Math.ceil(String(image_base64).length*0.75);
    const maxBytes=Number(globalConfig?.ia_archivo_max_mb||10)*1024*1024;
    if(estimatedBytes>maxBytes) throw new Error(`La imagen supera el máximo global de ${globalConfig?.ia_archivo_max_mb||10} MB.`);
    const schema={type:"object",additionalProperties:false,properties:{tipo_documento:{type:"string",enum:["Boleta","Factura","Comprobante","Otro"]},proveedor:{type:"string"},rut_proveedor:{type:"string"},folio:{type:"string"},fecha_documento:{type:"string"},monto_neto:{type:"number"},monto_iva:{type:"number"},monto_total:{type:"number"},categoria:{type:"string",enum:["Alimentación","Combustible","Peajes","Alojamiento","Materiales","Herramientas","Transporte","Otros"]},descripcion:{type:"string"},confianza:{type:"number"},advertencias:{type:"array",items:{type:"string"}}},required:["tipo_documento","proveedor","rut_proveedor","folio","fecha_documento","monto_neto","monto_iva","monto_total","categoria","descripcion","confianza","advertencias"]};
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:globalConfig?.ia_modelo||Deno.env.get("OPENAI_RECEIPT_MODEL")||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:`Lee este comprobante chileno. Extrae sólo datos visibles, usa fecha YYYY-MM-DD, montos CLP sin separadores y confianza de 0 a 100. No inventes: usa cadena vacía o 0 y agrega advertencia. La confianza mínima operativa es ${globalConfig?.ia_confianza_minima||75}%.`},{type:"input_image",image_url:`data:${mime_type};base64,${image_base64}`}]}],text:{format:{type:"json_schema",name:"lectura_boleta",strict:true,schema}}})});
    const data=await response.json();
    if(!response.ok) throw new Error(data?.error?.message||"No fue posible analizar la imagen.");
    const raw=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    return new Response(JSON.stringify({data:JSON.parse(raw)}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});
