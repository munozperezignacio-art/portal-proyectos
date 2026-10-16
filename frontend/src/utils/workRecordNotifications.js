import {supabase} from '../supabaseClient';
import {sendSystemEmail} from './emailService';
import {escapeCredentialText as escapeHtml} from './initialPassword';
import {WORK_EMAIL_EVENTS,workEmailRecipients,workEmailBatches} from './workEmailRouting';

export async function sendWorkRecordNotification({company,work,workId,event,summary}) {
  try {
    const definition=WORK_EMAIL_EVENTS.find(item=>item.id===event);
    if(!definition || event==='avance_registrado')throw new Error('Tipo de aviso no admitido.');
    const {data:config,error}=await supabase.from('config_empresa').select('correos_contextuales').eq('empresa',company).single();
    if(error)throw error;
    const recipients=workEmailRecipients({config,company,work,workId,event});
    for(const batch of workEmailBatches(recipients)){
      const result=await sendSystemEmail({...batch,permissionKey:definition.permission,subject:`${definition.label} · ${work}`,
        htmlContent:`<h2>${escapeHtml(definition.label)}</h2><p>Obra: <strong>${escapeHtml(work)}</strong></p><p>${escapeHtml(summary)}</p><p>Consulta el detalle en Obraxis con tus permisos habituales.</p><p><a href="https://www.obraxis.cl/login">Ingresar a Obraxis</a></p>`});
      if(!result.success)throw new Error(result.error||'No fue posible enviar el aviso.');
    }
    return '';
  }catch{
    // A mail failure must never make a saved record look like a failed save.
    return ' El registro quedó guardado, pero no se pudo completar la notificación por correo.';
  }
}
