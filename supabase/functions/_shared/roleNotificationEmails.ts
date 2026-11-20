import {notificationRecipient} from './notificationRecipients.mjs';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function dispatchRoleEmails(db:any){
 const {data:rows,error}=await db.from('notificaciones_entregas').select('id,empresa,evento_codigo,obra_nombre,destinatario,asunto,payload').eq('canal','Correo').eq('estado','Pendiente').not('role_route_key','is',null).order('id').limit(100);if(error)throw error;
 const {data:sender}=await db.from('config_empresa').select('email_sender').eq('empresa','Obraxis').maybeSingle();
 let accepted=0;
 for(const row of rows||[]){
  const {data:claim,error:claimError}=await db.from('notificaciones_entregas').update({estado:'Procesando'}).eq('id',row.id).eq('estado','Pendiente').select('id');if(claimError)throw claimError;if(!claim?.length)continue;
  try{
   const [{data:profile},{data:configuration}]=await Promise.all([db.from('usuarios').select('id,usuario,correo,empresa,rol,obras').eq('empresa',row.empresa).eq('correo',row.destinatario).maybeSingle(),db.from('role_notifications').select('settings').eq('empresa',row.empresa).eq('role_id',row.payload.role_id).maybeSingle()]);
   const current=configuration?.settings?.[row.evento_codigo];
   const configured={...row,payload:{...row.payload,channels:current,works_scope:current?.works}};
   if(!profile||!current?.email||!notificationRecipient(configured,profile,'email')||(current.forms==='selected'&&!current.form_ids.includes(String(row.payload.formulario_id)))||(current.equipment==='selected'&&!current.equipment_ids.includes(String(row.payload.equipo_id)))){
    await db.from('notificaciones_entregas').update({estado:'Omitida',error_detalle:'La configuración o el destinatario cambió.'}).eq('id',row.id);continue;
   }
   const key=Deno.env.get('RESEND_API_KEY');if(!key)throw Error('Correo no configurado');
   const html='<div style="font-family:Arial;max-width:680px;margin:auto"><div style="background:#20387d;color:white;padding:24px"><h2>OBRAXIS</h2></div><div style="padding:24px;border:1px solid #dde3ed"><h3>'+escape(row.asunto)+'</h3><p>'+escape(row.empresa)+(row.obra_nombre?' · '+escape(row.obra_nombre):'')+'</p><p>Tienes un nuevo aviso. Consulta el detalle en Obraxis con tus permisos habituales.</p><a href="https://www.obraxis.cl">Abrir Obraxis</a></div></div>';
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'role-notification-'+row.id},body:JSON.stringify({from:'Obraxis <'+(sender?.email_sender||'notificaciones@obraxis.cl')+'>',to:[row.destinatario],subject:row.asunto,html}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();const ok=response.ok&&!!result.id;
   const saved=await db.from('notificaciones_entregas').update({estado:ok?'Enviada':'Error',enviada_at:ok?new Date().toISOString():null,error_detalle:ok?'Aceptado por el proveedor; entrega no confirmada.':'Proveedor no aceptó el correo. Revisar; no se reintentará automáticamente.'}).eq('id',row.id);if(saved.error)throw saved.error;if(ok)accepted++;
  }catch{await db.from('notificaciones_entregas').update({estado:'Error',error_detalle:'Resultado incierto. Revisar antes de reenviar.'}).eq('id',row.id);}
 }
 return {roleEmailsAccepted:accepted};
}

