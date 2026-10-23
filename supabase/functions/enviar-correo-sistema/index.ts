import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {emailRecipientLists} from './recipients.js';
import {ENEX_PERMISSION,allowedMailPermission,enexMailRequest,enexMailContent} from './enex-mail.js';

const cors={"Access-Control-Allow-Origin":"https://www.obraxis.cl","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hash=async(value)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,"0")).join("");
const basePermission=(roleValue,key)=>{
  const role=String(roleValue||"").toLowerCase(),action=key.split(".").pop();
  if(role.includes("superusuario")||role.includes("superadmin")||role.includes("admin")||role.includes("gerencia"))return true;
  if(role.includes("jefe")||role.includes("profesional")||role.includes("creador"))return action!=="aprobar"&&action!=="configurar";
  if(role.includes("revisor")||role.includes("supervisor"))return ["ver","revisar","aprobar","descargar"].includes(action||"");
  return ["ver","crear"].includes(action||"");
};

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Metodo no permitido"},405);
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),resendKey=Deno.env.get("RESEND_API_KEY");
  if(!url||!serviceKey||!resendKey)return reply({error:"Correo no configurado en el servidor"},503);
  const authorization=req.headers.get("authorization")||"";
  const actorClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY"),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await actorClient.auth.getUser();
  if(userError||!user)return reply({error:"Sesion invalida"},401);
  const db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:authRecord}=await db.auth.admin.getUserById(user.id);
  const bannedUntil=authRecord?.user?.banned_until?new Date(authRecord.user.banned_until).getTime():0;
  if(!authRecord?.user||authRecord.user.deleted_at||(bannedUntil&&bannedUntil>Date.now()))return reply({error:"Usuario inactivo"},403);
  const {data:profile}=await db.from("usuarios").select("id,usuario,nombre,correo,empresa,rol,rol_base,permisos,auth_user_id").eq("auth_user_id",user.id).maybeSingle();
  if(!profile)return reply({error:"Usuario sin perfil activo"},403);
  const ipHash=await hash(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown");
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await db.from("correo_sistema_intentos").select("id",{count:"exact",head:true}).eq("actor_id",user.id).eq("canal","interno").gte("created_at",since);
  if((count||0)>=60)return reply({error:"Limite horario de correos alcanzado"},429);
  const log=async(exitoso)=>{await db.from("correo_sistema_intentos").insert({actor_id:user.id,ip_hash:ipHash,canal:"interno",exitoso});};
  try{
    const body=await req.json();
    const permissionKey=String(body.permissionKey||"").trim();
    if(!allowedMailPermission(permissionKey))return reply({error:"Flujo de correo no autorizado"},403);
    const {data:role}=await db.from("roles").select("permisos,rol_base,archivado").eq("empresa",profile.empresa).eq("nombre",profile.rol).maybeSingle();
    if(role?.archivado)return reply({error:"Rol inactivo"},403);
    const effective={...(role?.permisos||{}),...(profile.permisos||{})};
    const explicitlyConfigured=Object.prototype.hasOwnProperty.call(effective,permissionKey);
    const permitted=explicitlyConfigured?Boolean(effective[permissionKey]):basePermission(profile.rol_base||role?.rol_base||profile.rol,permissionKey);
    if(permissionKey===ENEX_PERMISSION&&effective[ENEX_PERMISSION]!==true)return reply({error:"Permiso Enex explícito requerido"},403);
    if(!permitted)return reply({error:"No tienes permiso para enviar este correo"},403);
    if(body.action==="health")return reply({configured:true});
    let recipientLists;
    try{recipientLists=emailRecipientLists(body);}catch{return reply({error:"Destinatarios invalidos"},400);}
    const recipients=recipientLists.to,copies=recipientLists.cc,recipientCount=recipients.length+copies.length;
    let subject=String(body.subject||"").trim().slice(0,200),html=String(body.htmlContent||"");
    let enexIdempotency;
    let plainText;
    if(permissionKey===ENEX_PERMISSION){
      let ids;
      try{ids=enexMailRequest(body,profile,effective,recipients,copies);}catch{return reply({error:"Solicitud Enex no autorizada"},403);}
      const {data:movements,error:movementError}=await actorClient.from("enex_movements")
        .select("id,empresa,portal,occurred_local,kind,liters_milli,amount_signed,currency,tax_breakdown,ingested_at,enex_assignments(movement_id)")
        .eq("empresa",profile.empresa).in("id",ids);
      if(movementError)return reply({error:"No se pudo verificar la carga Enex"},409);
      try{
        const content=enexMailContent(profile.empresa,ids,movements);
        subject=content.subject;html=content.html;plainText=content.text;
        enexIdempotency="enex-"+await hash(JSON.stringify([user.id,recipients[0].toLowerCase(),content.canonical]));
      }catch{return reply({error:"Carga Enex incompleta o incompatible"},409);}
    }
    if(!subject||!html||new TextEncoder().encode(html).length>500_000)return reply({error:"Contenido invalido o demasiado extenso"},400);
    const attachments=Array.isArray(body.attachments)?body.attachments.slice(0,5):[];
    const attachmentSize=attachments.reduce((sum,item)=>sum+String(item?.content||"").length,0);
    if(attachmentSize>11_000_000)return reply({error:"Adjuntos demasiado extensos"},413);
    const allowedSenders=new Set(["usuarios@obraxis.cl","notificaciones@obraxis.cl"]);
    const requested=String(body.customSender||"").trim().toLowerCase();
    const sender=permissionKey===ENEX_PERMISSION?"notificaciones@obraxis.cl":allowedSenders.has(requested)?requested:"notificaciones@obraxis.cl";
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json",...(enexIdempotency?{"Idempotency-Key":enexIdempotency}:{})},body:JSON.stringify({from:`Obraxis <${sender}>`,to:recipients,...(copies.length?{cc:copies}:{}),subject,html,...(plainText?{text:plainText}:{}),attachments})});
    const result=await response.json();
    await log(response.ok);
    const {error:auditError}=await db.from("auditoria_plataforma").insert({empresa:profile.empresa,modulo:permissionKey.split(".")[0],categoria:"Correo",accion:"Enviar correo",descripcion:`${subject} - ${recipientCount} destinatario(s)`,entidad_tipo:"correo_sistema",actor_auth_user_id:user.id,actor_usuario:profile.usuario,actor_nombre:profile.nombre,actor_rol:profile.rol,actor_empresa:profile.empresa,origen:"Supabase Edge Function",resultado:response.ok?"exitoso":"fallido",nivel:response.ok?"informativo":"atencion",metadatos:{permission_key:permissionKey,recipient_count:recipientCount,attachment_count:attachments.length,...(enexIdempotency?{enex_idempotency:enexIdempotency,provider_message_id:response.ok?result?.id||null:null}:{})}});
    if(!response.ok)return reply({error:result?.message||"No fue posible enviar el correo"},502);
    return reply({success:true,id:result?.id||null,auditRecorded:!auditError,...(auditError?{warning:"AUDIT_NOT_RECORDED"}:{})});
  }catch(error){await log(false);return reply({error:error instanceof Error?error.message:"Error inesperado"},500);}
});
