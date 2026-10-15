const normalize = value => String(value ?? '').trim().toLowerCase();
const list = value => Array.isArray(value) ? value : String(value || '').split(',').filter(Boolean);

export function advanceNotificationRecipients({ rules, users, company, work, fallback }) {
  const recipients = new Set();
  const add = value => { const email = normalize(value); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) recipients.add(email); };
  for (const rule of rules) {
    if (rule.empresa !== company || !rule.activa || !rule.canal_email || rule.evento_codigo !== 'avance_registrado' || rule.frecuencia !== 'Inmediata') continue;
    const scope = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
    const selected = list(rule.condiciones?.obras_seleccionadas).map(normalize);
    if (scope === 'seleccionadas' && !selected.includes(normalize(work)) && normalize(rule.obra_nombre) !== normalize(work)) continue;
    list(rule.correos_adicionales).forEach(add);
    const ids = list(rule.destinatarios_usuarios).map(normalize);
    const roles = list(rule.destinatarios_roles).map(normalize);
    users.filter(user => user.empresa === company).forEach(user => {
      const assigned = list(user.obras).map(normalize);
      if (scope === 'asignadas' && !assigned.includes('todas') && !assigned.includes(normalize(work))) return;
      if (ids.includes(normalize(user.id)) || roles.includes(normalize(user.rol || user.rol_base))) add(user.correo);
    });
  }
  // El respaldo y las reglas se combinan antes de enviar: un correo por persona.
  fallback.forEach(add);
  return [...recipients];
}
