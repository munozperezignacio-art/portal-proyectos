import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"https://www.obraxis.cl","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,"0")).join("");
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedPermission=/^(obras\.(avances|estados_pago|libro_obra|calidad|prevencion|subcontratos)|acreditaciones\.subcontratos|formularios\.formularios|clientes\.portales|mandante\.(contratos|acreditaciones)|prevencion\.registros|admin\.(usuarios|permisos))\.enviar$/;
const basePermission=(roleValue:unknown,key:string)=>{
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
  const actorClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await actorClient.auth.getUser();
  if(userError||!user)return reply({error:"Sesion invalida"},401);
  const db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const {data:authRecord}=await db.auth.admin.getUserById(user.id);
  const bannedUntil=authRecord?.user?.banned_until?new Date(authRecord.user.banned_until).getTime():0;
  if(!authRecord?.user||authRecord.user.deleted_at||(bannedUntil&&bannedUntil>Date.now()))return reply({error:"Usuario inactivo"},403);
  const {data:profile}=await db.from("usuarios").select("id,usuario,nombre,empresa,rol,rol_base,permisos,auth_user_id").eq("auth_user_id",user.id).maybeSingle();
  if(!profile)return reply({error:"Usuario sin perfil activo"},403);
  const ipHash=await hash(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown");
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await db.from("correo_sistema_intentos").select("id",{count:"exact",head:true}).eq("actor_id",user.id).eq("canal","interno").gte("created_at",since);
  if((count||0)>=60)return reply({error:"Limite horario de correos alcanzado"},429);
  const log=async(exitoso:boolean)=>{await db.from("correo_sistema_intentos").insert({actor_id:user.id,ip_hash:ipHash,canal:"interno",exitoso});};
  try{
    const body=await req.json();
    const permissionKey=String(body.permissionKey||"").trim();
    if(!allowedPermission.test(permissionKey))return reply({error:"Flujo de correo no autorizado"},403);
    const {data:role}=await db.from("roles").select("permisos,rol_base,archivado").eq("empresa",profile.empresa).eq("nombre",profile.rol).maybeSingle();
    if(role?.archivado)return reply({error:"Rol inactivo"},403);
    const effective={...(role?.permisos||{}),...(profile.permisos||{})};
    const explicitlyConfigured=Object.prototype.hasOwnProperty.call(effective,permissionKey);
    const permitted=explicitlyConfigured?Boolean(effective[permissionKey]):basePermission(profile.rol_base||role?.rol_base||profile.rol,permissionKey);
    if(!permitted)return reply({error:"No tienes permiso para enviar este correo"},403);
    if(body.action==="health")return reply({configured:true});
    const recipients=(Array.isArray(body.to)?body.to:String(body.to||"").split(",")).map((v:unknown)=>String(v).trim().toLowerCase()).filter(Boolean);
    if(!recipients.length||recipients.length>10||recipients.some((v:string)=>!email.test(v)))return reply({error:"Destinatarios invalidos"},400);
    const subject=String(body.subject||"").trim().slice(0,200),html=String(body.htmlContent||"");
    if(!subject||!html||new TextEncoder().encode(html).length>500_000)return reply({error:"Contenido invalido o demasiado extenso"},400);
    const attachments=Array.isArray(body.attachments)?body.attachments.slice(0,5):[];
    const attachmentSize=attachments.reduce((sum:number,item:any)=>sum+String(item?.content||"").length,0);
    if(attachmentSize>11_000_000)return reply({error:"Adjuntos demasiado extensos"},413);
    const allowedSenders=new Set(["usuarios@obraxis.cl","notificaciones@obraxis.cl"]);
    const requested=String(body.customSender||"").trim().toLowerCase();
    const sender=allowedSenders.has(requested)?requested:"notificaciones@obraxis.cl";
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:`Obraxis <${sender}>`,to:recipients,subject,html,attachments})});
    const result=await response.json();
    await log(response.ok);
    await db.from("auditoria_plataforma").insert({empresa:profile.empresa,modulo:permissionKey.split(".")[0],categoria:"Correo",accion:"Enviar correo",descripcion:`${subject} - ${recipients.length} destinatario(s)`,entidad_tipo:"correo_sistema",actor_auth_user_id:user.id,actor_usuario:profile.usuario,actor_nombre:profile.nombre,actor_rol:profile.rol,actor_empresa:profile.empresa,origen:"Supabase Edge Function",resultado:response.ok?"Exitoso":"Error",nivel:response.ok?"info":"warning",metadatos:{permission_key:permissionKey,recipient_count:recipients.length,attachment_count:attachments.length}});
    if(!response.ok)return reply({error:result?.message||"No fue posible enviar el correo"},502);
    return reply({success:true,id:result?.id||null});
  }catch(error){await log(false);return reply({error:error instanceof Error?error.message:"Error inesperado"},500);}
});
