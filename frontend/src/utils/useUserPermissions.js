import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mergePermissions } from './permissionsCatalog';

export default function useUserPermissions(user) {
  const [permissions, setPermissions] = useState(user?.permisos || {});
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) { setPermissions({}); setLoading(false); return; }
      setLoading(true);
      const roleName = user.rol || user.rol_base || '';
      const [roleResult, userResult] = await Promise.all([
        roleName ? supabase.from('roles').select('permisos').eq('empresa', user.empresa).eq('nombre', roleName).maybeSingle() : Promise.resolve({ data: null }),
        user.id ? supabase.from('usuarios').select('permisos').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      setPermissions(mergePermissions(roleResult.data?.permisos, userResult.data?.permisos, user.permisos));
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [user?.id, user?.empresa, user?.rol, user?.rol_base]);

  return { permissions, loading };
}
