import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins=new Set(["https://obraxis.cl","https://www.obraxis.cl"]);
const cors=(o:string|null)=>({"Access-Control-Allow-Origin":o&&origins.has(o)?o:"https://www.obraxis.cl","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const reply=(b:unknown,s=200,o:string|null=null)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"Content-Type":"application/json"}});
const clean=(v:unknown,m=500)=>String(v??"").trim().slice(0,m);
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v.trim().toUpperCase())))).map(x=>x.toString(16).padStart(2,"0")).join("");
const audit=(action:string,state:string,note:string,identity:any)=>({accion:action,estado:state,comentario:note||null,nombre:clean(identity?.nombre,180)||"Usuario externo",rut:clean(identity?.rut,20)||"No informado",cargo:clean(identity?.cargo,120)||"Usuario externo",empresa:clean(identity?.empresa,180)||"No informada",medio:"Sistema Obraxis",fecha_hora:new Date().toISOString()});
const safe=(row:any)=>{const copy={...row};delete copy.clave_revision_hash;delete copy.clave_aprobacion_hash;delete copy.clave_cliente_hash;delete copy.token_revision;delete copy.token_aprobacion;delete copy.token_cliente;return copy;};

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin"); if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)}); if(req.method!=="POST")return reply({error:"Método no permitido"},405,origin);
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!key)return reply({error:"Servicio no configurado"},503,origin);
 const db=createClient(Deno.env.get("SUPABASE_URL")!,key,{auth:{persistSession:false}});
 try{
  const body=await req.json(),kind=clean(body?.tipo,20),action=clean(body?.accion,20),token=clean(body?.token,180),code=clean(body?.clave,20);
  if(!token||code.length<6)return reply({error:"Enlace o clave inválidos"},400,origin);
  const codeHash=await hash(code);
  if(kind==="estado_pago"){
   const role=body?.rol==="aprobacion"?"aprobacion":"revision",tokenCol=role==="aprobacion"?"token_aprobacion":"token_revision",codeCol=role==="aprobacion"?"clave_aprobacion_hash":"clave_revision_hash";
   const{data:item}=await db.from("estados_pago_obra").select("*").eq(tokenCol,token).eq(codeCol,codeHash).maybeSingle(); if(!item)return reply({error:"La clave o el enlace no son válidos"},404,origin);
   if(action==="cargar"){
    const{data:states}=await db.from("estados_pago_obra").select("numero,monto_bruto,retencion_monto,anticipo_descontado,monto_neto,estado").eq("empresa",item.empresa).eq("obra_nombre",item.obra_nombre).lte("numero",item.numero);
    const valid=(states||[]).filter((x:any)=>x.estado!=="Rechazado"),before=valid.filter((x:any)=>Number(x.numero)<Number(item.numero));
    const sum=(rows:any[],field:string)=>rows.reduce((n,x)=>n+Number(x[field]||0),0),contract=(item.items||[]).reduce((n:number,x:any)=>n+(Number(x.monto_contrato||0)||Number(x.quantity||0)*Number(x.unitPrice||0)),0);
    return reply({documento:safe(item),resumen:{bruto_anterior:sum(before,"monto_bruto"),bruto_acumulado:sum(valid,"monto_bruto"),retencion_acumulada:sum(valid,"retencion_monto"),anticipo_acumulado:sum(valid,"anticipo_descontado"),neto_acumulado:sum(valid,"monto_neto"),avance_periodo_pct:contract?Number(item.monto_bruto||0)/contract*100:0,avance_acumulado_pct:contract?sum(valid,"monto_bruto")/contract*100:0}},200,origin);
   }
   if(["Aprobado","Pagado","Rechazado"].includes(item.estado))return reply({error:"El Estado de Pago ya se encuentra cerrado"},409,origin);
   const note=clean(body?.comentario,3000),trace=Array.isArray(item.trazabilidad)?item.trazabilidad:[],actor=role==="aprobacion"?item.aprobador_nombre:item.revisor_nombre;
   if(action==="resolver"){
    const approved=body?.aprobado===true,state=approved?(role==="aprobacion"?"Aprobado":"En aprobación"):"Observado",field=role==="aprobacion"?"observacion_aprobacion":"observacion_revision";
    const entry=audit(approved?(role==="aprobacion"?"Estado de Pago aprobado":"Revisión técnica conforme"):"Estado de Pago observado",state,note,{nombre:actor,empresa:item.empresa,cargo:role==="aprobacion"?"Aprobador externo":"Revisor externo"});
    const{error}=await db.from("estados_pago_obra").update({estado:state,[field]:note||null,trazabilidad:[...trace,entry]}).eq("id",item.id);if(error)throw error;
    await db.from("bitacora_eventos_obra").insert({empresa:item.empresa,obra_nombre:item.obra_nombre,categoria:"Estados de Pago",accion:`EP N° ${item.numero} ${approved?"conforme":"observado"}`,detalle:note||null,actor:actor||"Usuario externo",fecha:new Date().toISOString().slice(0,10)});
    return reply({ok:true,estado:state},200,origin);
   }
   if(action==="proponer"&&role==="revision"){
    const proposal=Array.isArray(body?.items)?body.items.slice(0,1000):null;if(!proposal)return reply({error:"Propuesta inválida"},400,origin);
    const entry=audit("Propuesta externa de ajuste","Observado",note,{nombre:actor,empresa:item.empresa,cargo:"Revisor externo"});
    const{error}=await db.from("estados_pago_obra").update({estado:"Observado",items:proposal,observacion_revision:note||"Se recibió una propuesta de ajuste por partidas.",trazabilidad:[...trace,entry]}).eq("id",item.id);if(error)throw error;
    return reply({ok:true,estado:"Observado"},200,origin);
   }
  }
  if(kind==="libro_obra"){
   const{data:item}=await db.from("libro_obra_digital").select("*").eq("token_cliente",token).eq("clave_cliente_hash",codeHash).maybeSingle();if(!item)return reply({error:"La clave o el enlace no son válidos"},404,origin);
   if(action==="cargar")return reply({documento:safe(item)},200,origin);
   if(action==="resolver"){
    const identity=body?.identidad||{},accepted=body?.aceptado===true,note=clean(body?.comentario,4000);if(!clean(identity.nombre)||!clean(identity.rut)||!clean(identity.cargo)||!clean(identity.empresa)||(!accepted&&!note))return reply({error:"Completa la identidad y el comentario requerido"},400,origin);
    const state=accepted?"Aceptado por cliente":"Observado por cliente",entry=audit(state,state,note,identity),trace=Array.isArray(item.trazabilidad)?item.trazabilidad:[];
    const{error}=await db.from("libro_obra_digital").update({flujo_estado:state,estado:accepted?"Respondido":"Abierto",respuesta:note||"Aceptado sin observaciones.",fecha_respuesta:new Date().toISOString().slice(0,10),trazabilidad:[...trace,entry]}).eq("id",item.id);if(error)throw error;
    await db.from("bitacora_eventos_obra").insert({empresa:item.empresa,obra_nombre:item.obra_nombre,categoria:"Libro de Obras",accion:`${item.folio||"Folio"} ${state.toLowerCase()}`,detalle:note||null,actor:clean(identity.nombre),fecha:new Date().toISOString().slice(0,10)});
    return reply({ok:true,estado:state,respuesta:note||"Aceptado sin observaciones.",trazabilidad:[...trace,entry]},200,origin);
   }
  }
  return reply({error:"Acción inválida"},400,origin);
 }catch(error){console.error(error);return reply({error:error instanceof Error?error.message:"Error inesperado"},500,origin);}
});
