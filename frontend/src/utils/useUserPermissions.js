import { useEffect, useRef, useState } from 'react';
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
  const [revision,setRevision]=useState(0);
  const loadedIdentity=useRef('');

  useEffect(()=>{
    const refresh=event=>{if(!event.detail?.empresa || event.detail.empresa===company)setRevision(value=>value+1);};
    window.addEventListener('obraxis:permissions-updated',refresh);
    window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('obraxis:permissions-updated',refresh);window.removeEventListener('focus',refresh);};
  },[company]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setPermissions({}); setLoading(false); return; }
      const identity=JSON.stringify([userId,company,role,baseRole]);
      if(loadedIdentity.current!==identity)setLoading(true);
      const roleName = role || baseRole || '';
      const [roleResult, userResult] = await Promise.all([
        roleName ? supabase.from('roles').select('permisos').eq('empresa', company).eq('nombre', roleName).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from('usuarios').select('permisos').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!active) return;
      setPermissions(mergePermissions(inheritedPermissions,roleResult.data?.permisos,userResult.data?.permisos));
      loadedIdentity.current=identity;
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [userId, company, role, baseRole, inheritedPermissions,revision]);

  return { permissions, loading };
}
