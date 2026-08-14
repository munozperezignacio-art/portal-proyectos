import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"https://www.obraxis.cl","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(v:unknown,max=250)=>String(v??"").trim().slice(0,max);
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,"0")).join("");

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"Servicio no configurado"},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const body=await req.json();
    const action=clean(body?.action,20),token=clean(body?.token,160);
    if(token.length<8)return json({error:"Enlace inválido"},404);
    const ip=clean(req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",80);
    const [tokenHash,ipHash]=await Promise.all([digest(token),digest(ip)]);
    const since=new Date(Date.now()-15*60*1000).toISOString();
    const {count}=await db.from("formulario_publico_intentos").select("id",{count:"exact",head:true}).eq("token_hash",tokenHash).eq("ip_hash",ipHash).eq("accion",action).gte("created_at",since);
    const limit=action==="enviar"?12:80;
    if((count||0)>=limit)return json({error:"Demasiados intentos. Intenta nuevamente más tarde."},429);
    const log=async(exitoso:boolean)=>{await db.from("formulario_publico_intentos").insert({token_hash:tokenHash,ip_hash:ipHash,accion:action,exitoso});};
    const {data:form,error:formError}=await db.from("prevencion_formularios").select("id,titulo,descripcion,categoria,campos,publico_token,codigo,revision,fecha_revision,empresa,cargos_obligados").eq("publico_token",token).maybeSingle();
    if(formError||!form){await log(false);return json({error:"Formulario no disponible"},404);}

    if(action==="cargar"){
      const {data:branding}=await db.from("config_empresa").select("logo_base64,color_primario,color_secundario").eq("empresa",form.empresa).maybeSingle();
      await log(true); return json({form,branding:branding||null});
    }
    if(action!=="enviar")return json({error:"Acción inválida"},400);
    const answers=body?.respuestas;
    if(!answers||typeof answers!=="object"||Array.isArray(answers))return json({error:"Respuestas inválidas"},400);
    if(new TextEncoder().encode(JSON.stringify(answers)).length>10*1024*1024)return json({error:"El formulario supera el tamaño permitido"},413);
    const centerId=Number(body?.centro_gestion_id)||null,workId=Number(body?.obra_id)||null;
    let workName=clean(body?.proyecto_nombre,250)||"Terreno";
    const stored:any=form.campos,control=stored&&!Array.isArray(stored)?stored.control_documental||{}:{};
    const centers=(control.centros_gestion_ids||[]).map((x:any)=>Number(x)).filter(Number.isFinite);
    if(centerId&&(!centers.includes(centerId)||(await db.from("facturacion_centros_gestion").select("id").eq("id",centerId).eq("empresa",form.empresa).eq("activo",true).maybeSingle()).data===null))return json({error:"Centro de gestión no autorizado"},403);
    if(workId){const {data:work}=await db.from("obras").select("id,nombre,centro_gestion_id").eq("id",workId).eq("empresa",form.empresa).maybeSingle();if(!work||(centerId&&Number(work.centro_gestion_id)!==centerId))return json({error:"Obra no autorizada"},403);workName=work.nombre;}
    const inspector=clean(body?.inspector,200)||"Trabajador Terreno",signature=clean(body?.firma_url,4*1024*1024)||null;
    const {data:saved,error:saveError}=await db.from("prevencion_respuestas").insert({formulario_id:form.id,centro_gestion_id:centerId,obra_id:workId,proyecto_nombre:workName,inspector,respuestas:answers,firma_url:signature}).select("id").single();
    if(saveError){await log(false);throw saveError;}
    if(control.tipo_registro==="maquinaria_uso"){
      const patent=clean((answers as any).equipo_patente,40).toUpperCase();
      const initial=Number((answers as any).horometro_inicial),final=Number((answers as any).horometro_final);
      const{data:equipment}=await db.from("inventario_maquinaria").select("id,tipo,patente,obra_nombre,horometro_inicial,empresa").eq("empresa",form.empresa).ilike("patente",patent).maybeSingle();
      if(!equipment||!Number.isFinite(initial)||!Number.isFinite(final)||final<initial)throw new Error("Lecturas de maquinaria inválidas");
      const isMileage=(answers as any).unidad_medicion==="Kilometraje (km)";
      const{error:usageError}=await db.from("maquinaria_uso_diario").insert({equipo_id:String(equipment.id),equipo_tipo:equipment.tipo,equipo_patente:equipment.patente,obra_nombre:workName||equipment.obra_nombre||"Sin asignar",fecha:new Date().toISOString().slice(0,10),horometro_inicial:initial,horometro_final:final,horas_trabajadas:isMileage?0:Math.max(0,final-initial),combustible_cargado:Math.max(0,Number((answers as any).combustible)||0),operador:inspector,observaciones:clean((answers as any).observaciones,2000),empresa:form.empresa});
      if(usageError)throw usageError;
      await db.from("inventario_maquinaria").update({horometro_inicial:final}).eq("id",equipment.id).eq("empresa",form.empresa);
    }
    await log(true);return json({id:saved.id});
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Error inesperado"},500);}
});
