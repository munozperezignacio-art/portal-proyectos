import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Save, ShieldCheck, UserCog, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PERMISSION_ACTIONS, defaultPermission, permissionKey,mergePermissions,isSuperUser } from '../utils/permissionsCatalog';
import {companyPermissionCatalog,modulePermissionKeys,setModulePermissions} from '../utils/companyPermissions';

export default function PermissionsGovernancePanel({ user, initialRoleId = '' }) {
  const [subjectType, setSubjectType] = useState('rol');
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [permissions, setPermissions] = useState({});
  const [openModules, setOpenModules] = useState(['obras']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [company,setCompany]=useState(null);
  const [loadError,setLoadError]=useState('');
  const initializedRole=useRef('');

  useEffect(() => {
    let active=true;
    const load = async () => {
      setLoading(true);setLoadError('');setCompany(null);setRoles([]);setUsers([]);setMessage(null);
      try{
      const [rolesResult, usersResult,companyResult] = await Promise.all([
        supabase.from('roles').select('id,nombre,rol_base,empresa,permisos,archivado').eq('empresa', user.empresa).eq('archivado', false).order('nombre'),
        supabase.from('usuarios').select('id,usuario,nombre,rol,rol_base,empresa,permisos').eq('empresa', user.empresa).order('nombre'),
        supabase.from('config_empresa').select('empresa,modulos_activos').eq('empresa',user.empresa).maybeSingle(),
      ]);
      if(!active)return;
      if(rolesResult.error || usersResult.error || companyResult.error)throw rolesResult.error || usersResult.error || companyResult.error;
      if(!companyResult.data)throw new Error('No se encontró la configuración de módulos de esta empresa.');
      setRoles(rolesResult.data || []);
      setUsers(usersResult.data || []);
      setCompany(companyResult.data);
      }catch(error){if(active)setLoadError(error.message || 'No se pudieron cargar los permisos.');}
      finally{if(active)setLoading(false);}
    };
    load();
    return ()=>{active=false;};
  }, [user.empresa]);

  const subjects = subjectType === 'rol' ? roles : users;
  const selected = useMemo(() => subjects.find(item => String(item.id) === String(subjectId)), [subjects, subjectId]);

  useEffect(() => {
    const key=`${user.empresa}:${initialRoleId}`;
    if (initialRoleId && initializedRole.current!==key && roles.some(role => String(role.id) === String(initialRoleId))) {
      initializedRole.current=key;
      setSubjectType('rol');
      setSubjectId(String(initialRoleId));
    }
  }, [initialRoleId, roles,user.empresa]);

  useEffect(() => {
    if (!subjects.length) { setSubjectId(''); setPermissions({}); return; }
    const next = subjects.some(item => String(item.id) === String(subjectId)) ? subjectId : String(subjects[0].id);
    setSubjectId(next);
    const current = subjects.find(item => String(item.id) === String(next));
    setPermissions(current?.permisos || {});
  }, [subjectId, subjects]);

  useEffect(() => { if (selected) setPermissions(selected.permisos || {}); }, [selected]);

  const effectiveUser = subjectType === 'rol'
    ? { empresa: user.empresa, rol: selected?.nombre }
    : selected;
  const inherited=subjectType==='usuario'?roles.find(role=>role.nombre===selected?.rol)?.permisos:{};
  const effectivePermissions=mergePermissions(inherited,permissions);
  const checked = key => Object.prototype.hasOwnProperty.call(effectivePermissions, key) ? Boolean(effectivePermissions[key]) : defaultPermission(effectiveUser, key);
  const catalog=useMemo(()=>companyPermissionCatalog(company),[company]);
  const unrestricted=isSuperUser(effectiveUser);
  const disabled=loading || saving || !selected || !!loadError || unrestricted;
  const toggle = key => setPermissions(current => ({ ...current, [key]: !checked(key) }));

  const setMenu = (moduleId, menu, value) => setPermissions(current => {
    const next = { ...current };
    menu.actions.forEach(action => { next[permissionKey(moduleId, menu.id, action)] = value; });
    return next;
  });

  const save = async () => {
    if (disabled || selected.empresa!==user.empresa) return;
    setSaving(true); setMessage(null);
    try{
    const table = subjectType === 'rol' ? 'roles' : 'usuarios';
    const payload = { permisos: permissions, permisos_actualizados_por: user.nombre || user.usuario || user.correo, permisos_actualizados_en: new Date().toISOString() };
    const { data, error } = await supabase.from(table).update(payload).eq('empresa',user.empresa).eq('id', selected.id).select('id,permisos').maybeSingle();
    if (error || !data) setMessage({ ok: false, text: `No fue posible guardar los permisos${error?.message ? `: ${error.message}` : '.'}` });
    else {
      const setter = subjectType === 'rol' ? setRoles : setUsers;
      setter(items => items.map(item => item.id === selected.id ? { ...item, permisos:data.permisos || payload.permisos } : item));
      setMessage({ ok: true, text: 'Permisos guardados y disponibles para aplicar en los módulos.' });
      window.dispatchEvent(new CustomEvent('obraxis:permissions-updated',{detail:{empresa:user.empresa}}));
    }
    }catch(error){setMessage({ok:false,text:`No fue posible guardar los permisos: ${error.message || 'Revise su conexión.'}`});}
    finally{setSaving(false);}
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h3 className="flex items-center gap-2 text-base font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-700" />Gobierno de accesos</h3><p className="mt-1 text-xs text-slate-500">Define capacidades por rol y luego agrega excepciones puntuales por usuario.</p></div>
        <button type="button" onClick={save} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar permisos'}</button>
      </div>
      {message && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}
      {loadError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{loadError} No se habilitará el guardado hasta cargar la configuración correctamente.</p>}
      {unrestricted && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Este perfil tiene acceso global de superusuario. Sus permisos no se pueden restringir desde esta matriz; selecciona un rol o usuario de empresa.</p>}
      <p className="mt-3 text-xs text-slate-500">Solo se muestran módulos habilitados para {user.empresa}. Desactivar un módulo deniega todas sus acciones; luego pulsa Guardar permisos. Las excepciones explícitas por usuario se conservan.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" disabled={saving} onClick={() => setSubjectType('rol')} className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-black ${subjectType === 'rol' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Users className="h-3.5 w-3.5" />Roles</button>
          <button type="button" disabled={saving} onClick={() => setSubjectType('usuario')} className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-black ${subjectType === 'usuario' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><UserCog className="h-3.5 w-3.5" />Usuarios</button>
        </div>
        <select aria-label="Rol o usuario a configurar" value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={loading || saving} className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800">
          {subjects.map(item => <option key={item.id} value={item.id}>{subjectType === 'rol' ? item.nombre : `${item.nombre || item.usuario} · ${item.rol || 'Sin rol asignado'}`}</option>)}
        </select>
      </div>
    </div>

    <div className="space-y-3">
      {catalog.map(module => {
        const open = openModules.includes(module.id);
        const keys=modulePermissionKeys(module),enabledCount=keys.filter(checked).length;
        return <section key={module.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3"><button type="button" aria-expanded={open} onClick={() => setOpenModules(current => open ? current.filter(id => id !== module.id) : [...current, module.id])} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="text-sm font-black text-slate-900">{module.label}</span>{open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}</button><span className={`text-[11px] font-bold ${enabledCount?'text-emerald-800':'text-slate-500'}`}>{enabledCount===0?'Desactivado':enabledCount===keys.length?'Todas las acciones':'Acceso parcial'} · {enabledCount}/{keys.length}</span><div className="flex flex-wrap gap-2"><button type="button" aria-label={`Desactivar módulo ${module.label}`} disabled={disabled} onClick={()=>setPermissions(current=>setModulePermissions(current,module,false))} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Desactivar módulo</button><button type="button" aria-label={`Permitir todo el módulo ${module.label}`} disabled={disabled} onClick={()=>setPermissions(current=>setModulePermissions(current,module,true))} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40">Permitir todo</button></div></div>
          {open && <div className="border-t border-slate-200">
            {module.permissionModule && <p className="bg-amber-50 px-5 py-2 text-xs text-amber-900">Estos permisos también se aplican a Calidad de Obra, porque ambas vistas comparten el mismo acceso.</p>}
            {module.menus.map(menu => <div key={menu.id} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs font-black text-slate-800">{menu.label}</p><div className="mt-1 flex gap-2"><button type="button" disabled={disabled} onClick={() => setMenu(module.permissionModule || module.id, menu, true)} className="text-[10px] font-bold text-emerald-700 disabled:opacity-40">Permitir todo</button><button type="button" disabled={disabled} onClick={() => setMenu(module.permissionModule || module.id, menu, false)} className="text-[10px] font-bold text-rose-700 disabled:opacity-40">Denegar todo</button></div></div>
                <div className="flex flex-wrap gap-2">{menu.actions.map(actionId => { const action = PERMISSION_ACTIONS.find(item => item.id === actionId); const key = permissionKey(module.permissionModule || module.id, menu.id, actionId); return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${checked(key) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><input type="checkbox" disabled={disabled} checked={checked(key)} onChange={() => toggle(key)} className="h-3.5 w-3.5 accent-emerald-700" />{action?.label || actionId}</label>; })}</div>
              </div>
            </div>)}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}
