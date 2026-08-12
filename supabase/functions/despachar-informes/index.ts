import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[c]||c));
const nextRun=(s:any)=>{const n=new Date(),t=new Date(n);const [h,m]=String(s.hora_envio||'08:00').split(':').map(Number);t.setUTCHours(h+4,m,0,0);if(s.frecuencia==='Semanal'){let add=(Number(s.dia_semana||1)%7-t.getUTCDay()+7)%7;if(add===0)add=7;t.setUTCDate(t.getUTCDate()+add)}else{t.setUTCDate(Number(s.dia_mes||1));if(t<=n)t.setUTCMonth(t.getUTCMonth()+1)}return t.toISOString()};

Deno.serve(async req=>{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:schedules,error}=await db.from('informes_programaciones').select('*').eq('activa',true).lte('proxima_ejecucion',new Date().toISOString()).limit(25);
  if(error)return json({error:error.message},500);
  const results=[];
  for(const s of schedules||[]){
    try{
      const {data:works}=await db.from('obras').select('nombre,estado').eq('empresa',s.empresa);
      const names=s.alcance_tipo==='Seleccionadas'?s.obras:(works||[]).filter((x:any)=>x.estado!=='Inactiva').map((x:any)=>x.nombre);
      const from=new Date();from.setDate(from.getDate()-(s.frecuencia==='Mensual'?30:7));
      const [{data:adv},{data:attendance},{data:cost},{data:nc},{data:prevention},{data:parts},{data:users},{data:mailConfig}]=await Promise.all([
        db.from('avances_produccion_partidas').select('obra_nombre,partida').in('obra_nombre',names).gte('created_at',from.toISOString()),
        db.from('asistencia_personal').select('obra_nombre,asistencia').in('obra_nombre',names).gte('created_at',from.toISOString()),
        db.from('costos_reales_obra').select('obra_nombre,monto').eq('empresa',s.empresa).in('obra_nombre',names),
        db.from('calidad_no_conformidades').select('obra_nombre,estado').eq('empresa',s.empresa).in('obra_nombre',names),
        db.from('prevencion_respuestas').select('proyecto_nombre').in('proyecto_nombre',names).gte('created_at',from.toISOString()),
        db.from('partidas_obra').select('obra_nombre,partida,cantidad_presupuestada').in('obra_nombre',names),
        db.from('usuarios').select('id,correo,rol').eq('empresa',s.empresa),
        db.from('config_empresa').select('email_api_key,email_sender').eq('empresa','Obraxis').maybeSingle()
      ]);
      const cards=names.map((name:string)=>{const reports=(adv||[]).filter((x:any)=>x.obra_nombre===name),planned=(parts||[]).filter((x:any)=>x.obra_nombre===name&&Number(x.cantidad_presupuestada)>0),active=new Set(reports.map((x:any)=>x.partida)).size,open=(nc||[]).filter((x:any)=>x.obra_nombre===name&&!['Cerrada','Cerrado'].includes(x.estado)).length;return{name,reports:reports.length,coverage:planned.length?Math.min(100,Math.round(active/planned.length*100)):0,present:(attendance||[]).filter((x:any)=>x.obra_nombre===name&&!['Ausente','No'].includes(x.asistencia)).length,cost:(cost||[]).filter((x:any)=>x.obra_nombre===name).reduce((a:number,x:any)=>a+Number(x.monto||0),0),open,prevention:(prevention||[]).filter((x:any)=>x.proyecto_nombre===name).length}});
      const avg=cards.length?Math.round(cards.reduce((a:number,x:any)=>a+x.coverage,0)/cards.length):0,totalCost=cards.reduce((a:number,x:any)=>a+x.cost,0);
      const html=`<div style="max-width:760px;margin:auto;background:#fff;border:1px solid #dbe3ef;border-radius:18px;overflow:hidden;font-family:Arial;color:#17233b"><div style="padding:28px;background:#102b5c;color:#fff"><div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#fdba74">LECTURA GERENCIAL</div><h1>${esc(s.nombre)}</h1><div>${esc(s.empresa)} · ${new Date().toLocaleDateString('es-CL')}</div></div><div style="padding:22px"><div style="display:flex;gap:10px;flex-wrap:wrap">${[[names.length,'Obras'],[(adv||[]).length,'Reportes'],[avg+'%','Cobertura'],['$'+Math.round(totalCost).toLocaleString('es-CL'),'Costo']].map(x=>`<div style="flex:1;min-width:120px;padding:14px;background:#f8fafc;border-radius:12px"><b style="font-size:20px">${x[0]}</b><div style="font-size:10px;color:#64748b">${x[1]}</div></div>`).join('')}</div><h3>Estatus por obra</h3>${cards.map((c:any)=>`<div style="padding:14px;margin:8px 0;border:1px solid #e2e8f0;border-radius:12px"><b>${esc(c.name)}</b><span style="float:right;color:${c.open?'#be123c':'#047857'}">${c.open?c.open+' NC abiertas':'Sin NC abiertas'}</span><div style="clear:both;margin-top:8px;height:8px;background:#e2e8f0;border-radius:8px"><div style="width:${c.coverage}%;height:100%;background:${c.coverage<50?'#dc2626':c.coverage<80?'#f59e0b':'#10b981'};border-radius:8px"></div></div><div style="margin-top:8px;font-size:11px;color:#64748b">${c.reports} reportes · ${c.present} asistencias · ${c.prevention} registros preventivos · $${Math.round(c.cost).toLocaleString('es-CL')}</div></div>`).join('')}</div></div>`;
      const roleSet=new Set(s.destinatarios_roles||[]),idSet=new Set((s.destinatarios_usuarios||[]).map(String));const recipients=[...new Set([...(users||[]).filter((u:any)=>roleSet.has(u.rol)||idSet.has(String(u.id))).map((u:any)=>u.correo),...(s.correos_adicionales||[])].filter(Boolean))];
      if(!mailConfig?.email_api_key)throw new Error('Resend no está configurado');if(!recipients.length)throw new Error('Sin destinatarios');
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${mailConfig.email_api_key}`,'Content-Type':'application/json'},body:JSON.stringify({from:`Obraxis <${mailConfig.email_sender||'notificaciones@obraxis.cl'}>`,to:recipients,subject:`${s.nombre} · ${s.empresa}`,html})});if(!response.ok)throw new Error(await response.text());
      await db.from('informes_ejecuciones').insert({programacion_id:s.id,empresa:s.empresa,plantilla_codigo:s.plantilla_codigo,nombre:s.nombre,periodo_desde:from.toISOString().slice(0,10),periodo_hasta:new Date().toISOString().slice(0,10),obras:names,destinatarios:recipients,indicadores:{obras:names.length,reportes:(adv||[]).length,cobertura_avance:avg,costo:totalCost},contenido_html:html,estado:'Enviado',ejecutado_por:'Programador Obraxis',enviada_at:new Date().toISOString()});
      await db.from('informes_programaciones').update({ultima_ejecucion:new Date().toISOString(),proxima_ejecucion:nextRun(s),updated_at:new Date().toISOString()}).eq('id',s.id);results.push({id:s.id,ok:true});
    }catch(e){await db.from('informes_ejecuciones').insert({programacion_id:s.id,empresa:s.empresa,plantilla_codigo:s.plantilla_codigo,nombre:s.nombre,obras:s.obras||[],estado:'Error',error_detalle:String(e),ejecutado_por:'Programador Obraxis'});results.push({id:s.id,ok:false,error:String(e)})}
  }
  return json({processed:results.length,results});
});
