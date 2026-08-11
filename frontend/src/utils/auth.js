import { supabase } from '../supabaseClient';

const PROFILE_FIELDS = 'id, usuario, empresa, rol, rol_base, obras, modulos, correo, trabajador_rut, submenus, nombre, cargo';

export async function getAuthenticatedProfile(authUser, company) {
  if (!authUser?.email) throw new Error('La cuenta autenticada no tiene un correo asociado.');

  let query = supabase
    .from('usuarios')
    .select(PROFILE_FIELDS)
    .ilike('correo', authUser.email)
    .limit(1);

  if (company?.trim()) query = query.ilike('empresa', company.trim());

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tu cuenta no tiene un perfil habilitado para esta empresa.');

  return { ...data, auth_user_id: authUser.id, email: authUser.email };
}
