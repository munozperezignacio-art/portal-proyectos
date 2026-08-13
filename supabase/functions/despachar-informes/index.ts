import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildExecutiveReportHtml } from "./executiveReportHtml.ts";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const nextRun=(s:any)=>{const n=new Date(),t=new Date(n);const [h,m]=String(s.hora_envio||'08:00').split(':').map(Number);t.setUTCHours(h+4,m,0,0);if(s.frecuencia==='Semanal'){let add=(Number(s.dia_semana||1)%7-t.getUTCDay()+7)%7;if(add===0)add=7;t.setUTCDate(t.getUTCDate()+add)}else{t.setUTCDate(Number(s.dia_mes||1));if(t<=n)t.setUTCMonth(t.getUTCMonth()+1)}return t.toISOString()};

Deno.serve(async()=>{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:schedules,error}=await db.from('informes_programaciones').select('*').eq('activa',true).lte('proxima_ejecucion',new Date().toISOString()).limit(25);
  if(error)return json({error:error.message},500);
  const results=[];
  for(const s of schedules||[]){
    try{
      const {data:works}=await db.from('obras').select('nombre,estado').eq('empresa',s.empresa);
      const names=s.alcance_tipo==='Seleccionadas'?s.obras:(works||[]).filter((x:any)=>x.estado!=='Inactiva').map((x:any)=>x.nombre);
      const from=new Date();const periodDays=s.frecuencia==='Mensual'?30:7;from.setDate(from.getDate()-periodDays);
      const [{data:adv},{data:attendance},{data:cost},{data:nc},{data:prevention},{data:parts},{data:users},{data:mailConfig}]=await Promise.all([
        db.from('avances_produccion_partidas').select('obra_nombre,partida,cantidad,created_at').in('obra_nombre',names),
        db.from('asistencia_personal').select('obra_nombre,asistencia,horas_ordinarias,created_at').in('obra_nombre',names).gte('created_at',from.toISOString()),
        db.from('costos_reales_obra').select('obra_nombre,monto,created_at').eq('empresa',s.empresa).in('obra_nombre',names),
        db.from('calidad_no_conformidades').select('obra_nombre,estado,fecha_compromiso').eq('empresa',s.empresa).in('obra_nombre',names),
        db.from('prevencion_respuestas').select('proyecto_nombre,created_at').in('proyecto_nombre',names).gte('created_at',from.toISOString()),
        db.from('partidas_obra').select('obra_nombre,partida,cantidad_presupuestada,costo_por_dia,rendimiento_meta,fecha_inicio,fecha_termino').in('obra_nombre',names),
        db.from('usuarios').select('id,correo,rol').eq('empresa',s.empresa),
        db.from('config_empresa').select('email_api_key,email_sender').eq('empresa','Obraxis').maybeSingle()
      ]);
      const report=buildExecutiveReportHtml({schedule:s,company:s.empresa,selected:names,advances:adv||[],attendance:attendance||[],costs:cost||[],nonConformities:nc||[],prevention:prevention||[],parts:parts||[],periodDays});
      const roleSet=new Set(s.destinatarios_roles||[]),idSet=new Set((s.destinatarios_usuarios||[]).map(String));
      const recipients=[...new Set([...(users||[]).filter((u:any)=>roleSet.has(u.rol)||idSet.has(String(u.id))).map((u:any)=>u.correo),...(s.correos_adicionales||[])].filter(Boolean))];
      if(!mailConfig?.email_api_key)throw new Error('Resend no está configurado');
      if(!recipients.length)throw new Error('Sin destinatarios');
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${mailConfig.email_api_key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`Obraxis <${mailConfig.email_sender||'notificaciones@obraxis.cl'}>`,to:recipients,subject:`${s.nombre} · ${s.empresa}`,html:report.html})});
      if(!response.ok)throw new Error(await response.text());
      await db.from('informes_ejecuciones').insert({programacion_id:s.id,empresa:s.empresa,plantilla_codigo:s.plantilla_codigo,nombre:s.nombre,periodo_desde:from.toISOString().slice(0,10),periodo_hasta:new Date().toISOString().slice(0,10),obras:names,destinatarios:recipients,indicadores:report.indicators,contenido_html:report.html,estado:'Enviado',ejecutado_por:'Programador Obraxis',enviada_at:new Date().toISOString()});
      await db.from('informes_programaciones').update({ultima_ejecucion:new Date().toISOString(),proxima_ejecucion:nextRun(s),updated_at:new Date().toISOString()}).eq('id',s.id);
      results.push({id:s.id,ok:true});
    }catch(e){
      await db.from('informes_ejecuciones').insert({programacion_id:s.id,empresa:s.empresa,plantilla_codigo:s.plantilla_codigo,nombre:s.nombre,obras:s.obras||[],estado:'Error',error_detalle:String(e),ejecutado_por:'Programador Obraxis'});
      results.push({id:s.id,ok:false,error:String(e)});
    }
  }
  return json({processed:results.length,results});
});
