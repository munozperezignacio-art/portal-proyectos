export type Profile = {
  id: number | string; auth_user_id?: string; usuario: string; nombre?: string; empresa: string;
  rol?: string; rol_base?: string; correo?: string; cargo?: string; modulos?: string[] | string;
  submenus?: string[] | string; obras?: string[] | string;
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
