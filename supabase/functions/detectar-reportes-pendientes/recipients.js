const list = value => Array.isArray(value) ? value.map(String) : [];
export function responsibleRecipients(rule, users, work) {
  const scope = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
  if (scope === 'seleccionadas' && rule.obra_nombre !== work && !list(rule.condiciones?.obras_seleccionadas).includes(work)) return { users: [], emails: [] };
  const roles = list(rule.destinatarios_roles), ids = list(rule.destinatarios_usuarios);
  const selected = users.filter(person => {
    if (person.empresa && person.empresa !== rule.empresa) return false;
    if (!roles.includes(person.rol) && !ids.includes(String(person.id))) return false;
    if (scope !== 'asignadas') return true;
    const assigned = Array.isArray(person.obras) ? person.obras : String(person.obras || '').split(',').map(x=>x.trim());
    return assigned.includes(work) || assigned.some(x=>String(x).toLowerCase()==='todas');
  });
  return { users: selected, emails: [...new Set([...selected.map(p=>p.correo), ...(scope === 'asignadas' ? [] : list(rule.correos_adicionales))].filter(Boolean))] };
}
