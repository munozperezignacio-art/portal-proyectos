import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mergePermissions } from './permissionsCatalog';

export default function useUserPermissions(user) {
  const [permissions, setPermissions] = useState(user?.permisos || {});
  const [loading, setLoading] = useState(Boolean(user));
  const userId = user?.id;
  const company = user?.empresa;
  const role = user?.rol;
  const baseRole = user?.rol_base;
  const inheritedPermissions = user?.permisos;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setPermissions({}); setLoading(false); return; }
      setLoading(true);
      const roleName = role || baseRole || '';
      const [roleResult, userResult] = await Promise.all([
        roleName ? supabase.from('roles').select('permisos').eq('empresa', company).eq('nombre', roleName).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from('usuarios').select('permisos').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      setPermissions(mergePermissions(roleResult.data?.permisos, userResult.data?.permisos, inheritedPermissions));
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [userId, company, role, baseRole, inheritedPermissions]);

  return { permissions, loading };
}
