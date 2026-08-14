import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Método no permitido."},405);
  try{
    const authHeader=req.headers.get("Authorization")||"";
    const auth=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
    const {data:{user},error:userError}=await auth.auth.getUser();
    if(userError||!user)return reply({error:"Sesión no válida."},401);
    const empresa=String((await req.json())?.empresa||"").trim();
    const {data:profile}=await auth.from("usuarios").select("empresa,nombre,usuario").eq("auth_user_id",user.id).maybeSingle();
    if(!empresa||profile?.empresa!==empresa)return reply({error:"No puedes despachar recordatorios de otra empresa."},403);

    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const today=new Date().toISOString().slice(0,10);
    const {data:rows,error:rowsError}=await db.from("mandante_obligaciones").select("id,contrato_id,tipo,nombre,periodicidad,proxima_fecha,responsable,correo_responsable,notificar_dias_antes,mandante_contratos!inner(codigo,nombre,empresa_contratista,empresa_mandante,proyecto_id)").eq("empresa_mandante",empresa).eq("activa",true).not("correo_responsable","is",null).not("proxima_fecha","is",null);
    if(rowsError)throw rowsError;
    const due=(rows||[]).filter(item=>{const warning=new Date(`${item.proxima_fecha}T12:00:00Z`);warning.setUTCDate(warning.getUTCDate()-Number(item.notificar_dias_antes||0));return warning<=new Date(`${today}T23:59:59Z`);});
    const {data:config}=await db.from("config_empresa").select("email_api_key,email_sender").eq("empresa","Obraxis").maybeSingle();
    const apiKey=Deno.env.get("RESEND_API_KEY")||config?.email_api_key;
    if(!apiKey)return reply({error:"Resend no está configurado en el servidor."},503);
    let enviados=0,omitidos=0;
    for(const item of due){
      const contract=Array.isArray(item.mandante_contratos)?item.mandante_contratos[0]:item.mandante_contratos;
      const marker=`${item.id}:${today}`;
      const {data:existing}=await db.from("mandante_eventos").select("id").eq("empresa_mandante",empresa).eq("accion","Recordatorio contractual enviado").eq("detalle",marker).maybeSingle();
      if(existing){omitidos++;continue;}
      const subject=`Obligación contractual próxima · ${contract?.codigo} · ${item.nombre}`;
      const html=`<div style="max-width:650px;margin:auto;background:#fff;border-radius:16px;padding:28px;font-family:Arial,sans-serif"><h2 style="color:#0f172a">Obligación contractual pendiente</h2><p><strong>${item.nombre}</strong> del contrato <strong>${contract?.codigo}</strong> vence el <strong>${item.proxima_fecha}</strong>.</p><p>Contratista: ${contract?.empresa_contratista||"No informado"}<br>Periodicidad: ${item.periodicidad}<br>Responsable: ${item.responsable||"Por asignar"}</p><p style="font-size:12px;color:#64748b">Ingresa a Obraxis para revisar o registrar la entrega correspondiente.</p></div>`;
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:`Obraxis <${config?.email_sender||"notificaciones@obraxis.cl"}>`,to:[item.correo_responsable],subject,html})});
      if(!response.ok)continue;
      await db.from("mandante_eventos").insert({empresa_mandante:empresa,proyecto_id:contract?.proyecto_id,contrato_id:item.contrato_id,accion:"Recordatorio contractual enviado",estado_resultante:"Pendiente",actor_nombre:profile.nombre||profile.usuario,actor_empresa:empresa,detalle:marker});
      enviados++;
    }
    return reply({success:true,revisados:due.length,enviados,omitidos});
  }catch(error){return reply({error:error instanceof Error?error.message:String(error)},500);}
});
