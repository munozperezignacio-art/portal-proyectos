import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, ShieldCheck, UserCog, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PERMISSIONS_CATALOG, PERMISSION_ACTIONS, defaultPermission, permissionKey } from '../utils/permissionsCatalog';

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [rolesResult, usersResult] = await Promise.all([
        supabase.from('roles').select('id,nombre,rol_base,empresa,permisos,archivado').eq('empresa', user.empresa).eq('archivado', false).order('nombre'),
        supabase.from('usuarios').select('id,usuario,nombre,rol,rol_base,empresa,permisos').eq('empresa', user.empresa).order('nombre'),
      ]);
      setRoles(rolesResult.data || []);
      setUsers(usersResult.data || []);
      setLoading(false);
    };
    load();
  }, [user.empresa]);

  const subjects = subjectType === 'rol' ? roles : users;
  const selected = useMemo(() => subjects.find(item => String(item.id) === String(subjectId)), [subjects, subjectId]);

  useEffect(() => {
    if (initialRoleId && roles.some(role => String(role.id) === String(initialRoleId))) {
      setSubjectType('rol');
      setSubjectId(String(initialRoleId));
    }
  }, [initialRoleId, roles]);

  useEffect(() => {
    if (!subjects.length) { setSubjectId(''); setPermissions({}); return; }
    const next = subjects.some(item => String(item.id) === String(subjectId)) ? subjectId : String(subjects[0].id);
    setSubjectId(next);
    const current = subjects.find(item => String(item.id) === String(next));
    setPermissions(current?.permisos || {});
  }, [subjectType, roles, users]);

  useEffect(() => { if (selected) setPermissions(selected.permisos || {}); }, [selected?.id]);

  const effectiveUser = subjectType === 'rol'
    ? { empresa: user.empresa, rol: selected?.nombre, rol_base: selected?.rol_base }
    : selected;
  const checked = key => Object.prototype.hasOwnProperty.call(permissions, key) ? Boolean(permissions[key]) : defaultPermission(effectiveUser, key);
  const toggle = key => setPermissions(current => ({ ...current, [key]: !checked(key) }));

  const setMenu = (moduleId, menu, value) => setPermissions(current => {
    const next = { ...current };
    menu.actions.forEach(action => { next[permissionKey(moduleId, menu.id, action)] = value; });
    return next;
  });

  const save = async () => {
    if (!selected) return;
    setSaving(true); setMessage(null);
    const table = subjectType === 'rol' ? 'roles' : 'usuarios';
    const payload = { permisos: permissions, permisos_actualizados_por: user.nombre || user.usuario || user.correo, permisos_actualizados_en: new Date().toISOString() };
    const { data, error } = await supabase.from(table).update(payload).eq('id', selected.id).select('id,permisos').maybeSingle();
    if (error || !data) setMessage({ ok: false, text: `No fue posible guardar los permisos${error?.message ? `: ${error.message}` : '.'}` });
    else {
      const setter = subjectType === 'rol' ? setRoles : setUsers;
      setter(items => items.map(item => item.id === selected.id ? { ...item, permisos } : item));
      setMessage({ ok: true, text: 'Permisos guardados y disponibles para aplicar en los módulos.' });
    }
    setSaving(false);
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h3 className="flex items-center gap-2 text-base font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-700" />Gobierno de accesos</h3><p className="mt-1 text-xs text-slate-500">Define capacidades por rol y luego agrega excepciones puntuales por usuario.</p></div>
        <button type="button" onClick={save} disabled={!selected || saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar permisos'}</button>
      </div>
      {message && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{message.text}</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setSubjectType('rol')} className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-black ${subjectType === 'rol' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><Users className="h-3.5 w-3.5" />Roles</button>
          <button type="button" onClick={() => setSubjectType('usuario')} className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-black ${subjectType === 'usuario' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}><UserCog className="h-3.5 w-3.5" />Usuarios</button>
        </div>
        <select value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={loading} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800">
          {subjects.map(item => <option key={item.id} value={item.id}>{subjectType === 'rol' ? `${item.nombre} · ${item.rol_base}` : `${item.nombre || item.usuario} · ${item.rol || item.rol_base}`}</option>)}
        </select>
      </div>
    </div>

    <div className="space-y-3">
      {PERMISSIONS_CATALOG.map(module => {
        const open = openModules.includes(module.id);
        return <section key={module.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button type="button" onClick={() => setOpenModules(current => open ? current.filter(id => id !== module.id) : [...current, module.id])} className="flex w-full items-center justify-between px-5 py-4 text-left"><span className="text-sm font-black text-slate-900">{module.label}</span>{open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}</button>
          {open && <div className="border-t border-slate-200">
            {module.menus.map(menu => <div key={menu.id} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs font-black text-slate-800">{menu.label}</p><div className="mt-1 flex gap-2"><button type="button" onClick={() => setMenu(module.id, menu, true)} className="text-[10px] font-bold text-emerald-700">Permitir todo</button><button type="button" onClick={() => setMenu(module.id, menu, false)} className="text-[10px] font-bold text-rose-700">Denegar todo</button></div></div>
                <div className="flex flex-wrap gap-2">{menu.actions.map(actionId => { const action = PERMISSION_ACTIONS.find(item => item.id === actionId); const key = permissionKey(module.id, menu.id, actionId); return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${checked(key) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}><input type="checkbox" checked={checked(key)} onChange={() => toggle(key)} className="h-3.5 w-3.5 accent-emerald-700" />{action?.label || actionId}</label>; })}</div>
              </div>
            </div>)}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}
