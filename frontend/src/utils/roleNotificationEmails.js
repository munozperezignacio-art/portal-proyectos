import {supabase} from '../supabaseClient';
export async function filterLegacyRoleEmails(company,event,recipients){
 const code=({avance_registrado:'obra_reporte_avance',maquinaria_registrada:'obra_reporte_maquinaria'})[event]||event;
 const all=[...new Set([...(recipients.to||[]),...(recipients.cc||[])])];
 if(!all.length)return recipients;
 const {data,error}=await supabase.rpc('filter_legacy_notification_emails',{p_company:company,p_code:code,p_emails:all});if(error)throw error;
 const allowed=new Set(data||[]);return {to:(recipients.to||[]).filter(x=>allowed.has(x.toLowerCase().trim())),cc:(recipients.cc||[]).filter(x=>allowed.has(x.toLowerCase().trim()))};
}

