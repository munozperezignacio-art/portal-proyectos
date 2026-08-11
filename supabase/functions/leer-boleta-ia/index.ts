import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const key=Deno.env.get("OPENAI_API_KEY");
    if(!key) return new Response(JSON.stringify({error:"La lectura IA requiere configurar OPENAI_API_KEY en Supabase Edge Functions."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
    const {image_base64,mime_type}=await req.json();
    if(!image_base64||!String(mime_type||"").startsWith("image/")) throw new Error("Adjunta una imagen JPG, PNG o WEBP.");
    const schema={type:"object",additionalProperties:false,properties:{tipo_documento:{type:"string",enum:["Boleta","Factura","Comprobante","Otro"]},proveedor:{type:"string"},rut_proveedor:{type:"string"},folio:{type:"string"},fecha_documento:{type:"string"},monto_neto:{type:"number"},monto_iva:{type:"number"},monto_total:{type:"number"},categoria:{type:"string",enum:["Alimentación","Combustible","Peajes","Alojamiento","Materiales","Herramientas","Transporte","Otros"]},descripcion:{type:"string"},confianza:{type:"number"},advertencias:{type:"array",items:{type:"string"}}},required:["tipo_documento","proveedor","rut_proveedor","folio","fecha_documento","monto_neto","monto_iva","monto_total","categoria","descripcion","confianza","advertencias"]};
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_RECEIPT_MODEL")||"gpt-4.1-mini",input:[{role:"user",content:[{type:"input_text",text:"Lee este comprobante chileno. Extrae sólo datos visibles, usa fecha YYYY-MM-DD, montos CLP sin separadores y confianza de 0 a 100. No inventes: usa cadena vacía o 0 y agrega advertencia."},{type:"input_image",image_url:`data:${mime_type};base64,${image_base64}`}]}],text:{format:{type:"json_schema",name:"lectura_boleta",strict:true,schema}}})});
    const data=await response.json();
    if(!response.ok) throw new Error(data?.error?.message||"No fue posible analizar la imagen.");
    const raw=data.output_text||data.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    return new Response(JSON.stringify({data:JSON.parse(raw)}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});
