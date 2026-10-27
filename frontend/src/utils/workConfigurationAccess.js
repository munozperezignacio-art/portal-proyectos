import { can } from './permissionsCatalog.js';

export function canConfigureWork(user, permissions, workName) {
  if (can(user, permissions, 'admin.permisos.configurar')) return true;
  if (!can(user, permissions, 'obras.ficha.configurar') || !workName) return false;
  const assigned = String(user?.obras || '').split(',').map(name => name.trim().toLowerCase());
  return assigned.includes('todas') || assigned.includes(workName.toLowerCase());
}

export function canConfigureResponsibility(user, permissions, conditions) {
  if (can(user, permissions, 'admin.permisos.configurar')) return true;
  const selected = conditions?.obras_seleccionadas;
  return conditions?.alcance_tipo === 'seleccionadas' && Array.isArray(selected)
    && selected.length > 0 && selected.every(name => canConfigureWork(user, permissions, name));
}
