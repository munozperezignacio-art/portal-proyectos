const values = value => Array.isArray(value) ? value.map(String) : [];
const normalize = value => String(value ?? '').trim().toLowerCase();
export function notificationRecipient(delivery, profile, channel = 'mobile') {
  if (delivery.empresa && delivery.empresa !== profile.empresa) return false;
  const current=profile.notification_settings?.[delivery.evento_codigo];
  if(!delivery.payload?.role_notification && current)return false;
  if(delivery.payload?.role_notification){
    const payload=current?{...delivery.payload,channels:current,works_scope:current.works}:delivery.payload;
    if(current?.forms==='selected'&&!current.form_ids.includes(String(payload.formulario_id)))return false;
    if(current?.equipment==='selected'&&!current.equipment_ids.includes(String(payload.equipo_id)))return false;
    if(profile.rol!==payload.role_name || !payload.channels?.[channel])return false;
    const workNames=(Array.isArray(profile.obras)?profile.obras:String(profile.obras||'').split(',')).map(normalize);
    if(!['enex_pendiente','solicitudes_actualizacion'].includes(delivery.evento_codigo) && payload.works_scope==='assigned' && (!delivery.obra_nombre || (!workNames.includes('todas')&&!workNames.includes(normalize(delivery.obra_nombre)))))return false;
    return [profile.id,profile.usuario,profile.correo].filter(x=>x!=null).map(normalize).includes(normalize(delivery.destinatario));
  }
  const actor = delivery.payload?.actor_auth_user_id;
  if (actor && actor === profile.auth_user_id) return false;
  const assigned = (Array.isArray(profile.obras) ? profile.obras : String(profile.obras || '').split(',')).map(normalize);
  // New operational events never bypass the recipient's current work access.
  if (delivery.payload?.operational_event && !assigned.includes('todas') && !assigned.includes(normalize(delivery.obra_nombre))) return false;
  const target = normalize(delivery.destinatario);
  if ([profile.id, profile.usuario, profile.correo].filter(x => x != null && x !== '').map(normalize).includes(target)) return true;
  const rule = delivery.notificaciones_reglas;
  if (!rule?.activa) return false;
  if (!values(rule.destinatarios_usuarios).map(normalize).includes(normalize(profile.id)) &&
      !values(rule.destinatarios_roles).map(normalize).some(role => [normalize(profile.rol), normalize(profile.rol_base)].includes(role))) return false;
  const scope = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
  if (scope === 'todas') return true;
  const work = normalize(delivery.obra_nombre);
  if (scope === 'asignadas') return assigned.includes('todas') || assigned.includes(work);
  return values(rule.condiciones?.obras_seleccionadas).map(normalize).includes(work) || normalize(rule.obra_nombre) === work;
}

export function pushEnabled(delivery) {
  const rule = delivery.notificaciones_reglas;
  return rule ? Boolean(rule.activa && rule.canal_push) : delivery.payload?.push_enabled === true;
}
