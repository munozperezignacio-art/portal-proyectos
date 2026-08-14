import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value.trim().toUpperCase())))).map(b=>b.toString(16).padStart(2,"0")).join("");
const TYPES=["Avance","Programacion","Hito","Estado de pago","RDI","Libro de obra","Calidad","Prevencion","Documento","Acreditacion"];

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método no permitido."},405);
  try{
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const body=await req.json(), token=String(body?.token||"").trim(), clave=String(body?.clave||"").trim();
    if(!token||!clave)return json({error:"Ingresa enlace y clave."},400);
    const {data:contract}=await db.from("mandante_contratos").select("id,proyecto_id,empresa_mandante,codigo,nombre,rut_contratista,empresa_contratista,contacto_nombre,contacto_email,paquetes,estado,fecha_inicio,fecha_termino,presupuesto_contractual,clave_externa_hash").eq("token_externo",token).eq("modalidad","Portal externo").maybeSingle();
    if(!contract||!contract.clave_externa_hash||await hash(clave)!==contract.clave_externa_hash)return json({error:"Enlace o clave incorrectos."},401);
    if(["Suspendido","Terminado","Archivado"].includes(contract.estado))return json({error:"El acceso contractual no se encuentra activo."},403);
    if(body.action==="submit"){
      const type=String(body?.entrega?.tipo||""); if(!TYPES.includes(type))return json({error:"Tipo de entrega inválido."},400);
      const packageKey:{[key:string]:string}={Avance:"avance",Programacion:"programacion",Hito:"hitos","Estado de pago":"estados_pago",RDI:"rdi","Libro de obra":"libro_obra",Calidad:"calidad",Prevencion:"prevencion",Documento:"documentos",Acreditacion:"acreditaciones"};
      if(contract.paquetes?.[packageKey[type]]!==true)return json({error:"Esta entrega no está habilitada en el contrato."},403);
      const title=String(body?.entrega?.titulo||"").trim(); if(title.length<3)return json({error:"Indica un título válido."},400);
      const {data,error}=await db.from("mandante_entregas").insert({contrato_id:contract.id,empresa_mandante:contract.empresa_mandante,empresa_origen:contract.empresa_contratista,tipo:type,titulo:title,periodo_desde:body.entrega.periodo_desde||null,periodo_hasta:body.entrega.periodo_hasta||null,monto:Number(body.entrega.monto||0),datos:{detalle:String(body.entrega.detalle||"").slice(0,5000)},estado:"Recibido",enviado_por:contract.contacto_nombre||contract.empresa_contratista}).select("id,tipo,titulo,estado,enviado_at").single();
      if(error)throw error;
      await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:`${type} recibido desde portal externo`,estado_resultante:"Recibido",actor_nombre:contract.contacto_nombre,actor_empresa:contract.empresa_contratista,detalle:title});
      return json({success:true,entrega:data});
    }
    const [{data:obligations},{data:accreditations},{data:deliveries}]=await Promise.all([
      db.from("mandante_obligaciones").select("id,tipo,nombre,periodicidad,proxima_fecha,responsable").eq("contrato_id",contract.id).eq("activa",true).order("proxima_fecha"),
      db.from("mandante_acreditaciones").select("id,categoria,estado,total_requeridos,total_recibidos,total_aprobados,proximo_vencimiento,observacion").eq("contrato_id",contract.id).order("categoria"),
      db.from("mandante_entregas").select("id,tipo,titulo,periodo_desde,periodo_hasta,monto,estado,observacion_mandante,respuesta_contratista,enviado_at,revisado_at").eq("contrato_id",contract.id).order("enviado_at",{ascending:false}).limit(100)
    ]);
    await db.from("mandante_contratos").update({ultimo_acceso_externo:new Date().toISOString()}).eq("id",contract.id);
    await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:"Acceso al portal contractual",actor_nombre:contract.contacto_nombre,actor_empresa:contract.empresa_contratista});
    const {clave_externa_hash,...safe}=contract;
    return json({contract:safe,obligations:obligations||[],accreditations:accreditations||[],deliveries:deliveries||[]});
  }catch(error){return json({error:error instanceof Error?error.message:String(error)},500);}
});
