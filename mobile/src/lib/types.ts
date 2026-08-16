export type Profile = {
  id: number | string; auth_user_id?: string; usuario: string; nombre?: string; empresa: string;
  rol?: string; rol_base?: string; correo?: string; cargo?: string; modulos?: string[] | string;
  submenus?: string[] | string; obras?: string[] | string; permisos?: Record<string, boolean>;
};
export type Work = { id: number; nombre: string; estado?: string; cliente?: string; tipo?: string; area?: string; empresa?: string };
export type Machinery = { id: number; tipo?: string; patente?: string; marca?: string; obra_nombre?: string; estado_equipo?: string; horometro_inicial?: number; color_calendario?: string };

export const toList = (value?: string[] | string) => Array.isArray(value) ? value : String(value || '').split(',').map(v => v.trim()).filter(Boolean);
export const canUse = (profile: Profile | null, module: string) => {
  if (!profile) return false;
  const role = `${profile.rol_base || ''} ${profile.rol || ''}`.toLowerCase();
  if (role.includes('superusuario') || (profile.empresa === 'Obraxis' && role.includes('admin'))) return true;
  const modules = toList(profile.modulos).map(v => v.toLowerCase());
  return modules.length === 0 || modules.some(v => v.includes(module.toLowerCase()));
};

export const can = (profile: Profile | null, key: string) => {
  if (!profile) return false;
  const role = `${profile.rol_base || ''} ${profile.rol || ''}`.toLowerCase();
  if (role.includes('superusuario') || role.includes('superadmin') || (profile.empresa === 'Obraxis' && role.includes('admin'))) return true;
  if (Object.prototype.hasOwnProperty.call(profile.permisos || {}, key)) return Boolean(profile.permisos?.[key]);
  const action = key.split('.').pop();
  if (role.includes('admin') || role.includes('gerencia')) return true;
  if (role.includes('jefe') || role.includes('profesional') || role.includes('creador')) return !['aprobar', 'configurar'].includes(String(action));
  if (role.includes('revisor') || role.includes('supervisor')) return ['ver', 'revisar', 'aprobar', 'descargar'].includes(String(action));
  return ['ver', 'crear'].includes(String(action));
};

export const canAccessWork = (profile: Profile | null, workName?: string) => {
  if (!profile || !workName) return false;
  const role = `${profile.rol_base || ''} ${profile.rol || ''}`.toLowerCase();
  if (role.includes('superusuario') || role.includes('superadmin')) return true;
  const works = toList(profile.obras).map(value => value.toLocaleLowerCase('es-CL'));
  return works.includes('todas') || works.includes(workName.trim().toLocaleLowerCase('es-CL'));
};
