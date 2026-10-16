import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mergePermissions } from './permissionsCatalog';
import {deriveRoleNavigation,inheritsRoleAccess} from './roleNavigation';

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
  const [navigation,setNavigation]=useState(()=>inheritsRoleAccess(user)?{modulos:'',submenus:'',_hereda_accesos_rol:true}:null);

  useEffect(()=>{
    const refresh=event=>{if(!event.detail?.empresa || event.detail.empresa===company)setRevision(value=>value+1);};
    window.addEventListener('obraxis:permissions-updated',refresh);
    window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('obraxis:permissions-updated',refresh);window.removeEventListener('focus',refresh);};
  },[company]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) { setPermissions({});setNavigation(null); setLoading(false); return; }
      const identity=JSON.stringify([userId,company,role,baseRole]);
      if(loadedIdentity.current!==identity)setLoading(true);
      try{
      const roleName = role || baseRole || '';
      const loadRole=name=>name?supabase.from('roles').select('nombre,rol_base,empresa,permisos,modulos,submenus,archivado').eq('empresa', company).eq('nombre',name).maybeSingle():Promise.resolve({data:null});
      let [roleResult, userResult] = await Promise.all([loadRole(roleName),supabase.from('usuarios').select('permisos,empresa,rol,rol_base,modulos,submenus').eq('id',userId).maybeSingle()]);
      if (!active) return;
      if(roleResult.error || userResult.error)throw roleResult.error || userResult.error;
      const fresh=userResult.data?.empresa===company?userResult.data:null;
      if(fresh?.rol && fresh.rol!==roleName){roleResult=await loadRole(fresh.rol);if(roleResult.error)throw roleResult.error;}
      const ownPermissions=fresh?.permisos ?? userResult.data?.permisos ?? inheritedPermissions ?? {};
      const inherited=inheritsRoleAccess({permisos:ownPermissions});
      let resolved={modulos:fresh?.modulos ?? user.modulos ?? '',submenus:fresh?.submenus ?? user.submenus ?? '',permisos:ownPermissions,_hereda_accesos_rol:false};
      if(fresh?.rol)resolved={...resolved,rol:fresh.rol,rol_base:fresh.rol_base};
      if(inherited){
        const result=await supabase.from('config_empresa').select('empresa,modulos_activos,submenus_activos').eq('empresa',company).maybeSingle();
        if(result.error)throw result.error;
        const access=deriveRoleNavigation(roleResult.data,result.data,ownPermissions);
        resolved={...resolved,modulos:access.modulos.join(','),submenus:access.submenus.join(','),_hereda_accesos_rol:true};
      }
      if(!active)return;
      setNavigation(resolved);
      setPermissions(mergePermissions(inheritedPermissions,roleResult.data?.permisos,ownPermissions));
      loadedIdentity.current=identity;
      }catch{
        if(active)setNavigation({modulos:'',submenus:'',_hereda_accesos_rol:true});
      }finally{if(active)setLoading(false);}
    };
    load();
    return () => { active = false; };
  }, [userId, company, role, baseRole, inheritedPermissions,revision]);

  return { permissions, loading,navigation };
}
