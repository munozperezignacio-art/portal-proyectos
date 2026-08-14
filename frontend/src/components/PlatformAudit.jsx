import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bot, Building2, CalendarDays, ChevronDown, Download, Eye, Filter, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can, isSuperUser } from '../utils/permissionsCatalog';

const PAGE_SIZE = 100;
const fmtDate = value => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—';
const escapeCsv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function PlatformAudit({ user }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const allowed = can(user, permissions, 'admin.auditoria.ver');
  const global = user?.empresa === 'Obraxis' && isSuperUser(user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({ search: '', empresa: '', modulo: '', resultado: '', desde: '', hasta: '' });

  useEffect(() => {
    if (permissionsLoading || !allowed) return;
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      let query = supabase.from('auditoria_plataforma').select('*').order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (filters.empresa) query = query.eq('empresa', filters.empresa);
      if (filters.modulo) query = query.eq('modulo', filters.modulo);
      if (filters.resultado) query = query.eq('resultado', filters.resultado);
      if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00`);
      if (filters.hasta) query = query.lte('created_at', `${filters.hasta}T23:59:59.999`);
      const { data, error: queryError } = await query;
      if (!active) return;
      if (queryError) setError(queryError.message);
      else { setRows(data || []); setHasMore((data || []).length === PAGE_SIZE); }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [allowed, permissionsLoading, page, filters.empresa, filters.modulo, filters.resultado, filters.desde, filters.hasta]);

  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(row => [row.accion, row.descripcion, row.actor_nombre, row.actor_usuario, row.empresa, row.obra_nombre, row.modulo, row.entidad_tipo].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [rows, filters.search]);
  const companies = useMemo(() => [...new Set(rows.map(row => row.empresa).filter(Boolean))].sort(), [rows]);
  const modules = useMemo(() => [...new Set(rows.map(row => row.modulo).filter(Boolean))].sort(), [rows]);
  const stats = useMemo(() => ({ total: visible.length, ia: visible.filter(row => ['ia','ox'].includes(row.modulo)).length, failures: visible.filter(row => row.resultado === 'fallido' || row.nivel === 'critico').length, users: new Set(visible.map(row => row.actor_auth_user_id || row.actor_usuario || row.actor_nombre).filter(Boolean)).size }), [visible]);

  const exportCsv = () => {
    const headers = ['Fecha','Empresa','Obra','Módulo','Acción','Descripción','Usuario','Rol','Origen','Resultado'];
    const body = visible.map(row => [fmtDate(row.created_at), row.empresa, row.obra_nombre, row.modulo, row.accion, row.descripcion, row.actor_nombre || row.actor_usuario, row.actor_rol, row.origen, row.resultado].map(escapeCsv).join(';'));
    const blob = new Blob([`\uFEFF${headers.join(';')}\n${body.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `auditoria-obraxis-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando autorización…</div>;
  if (!allowed) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">Tu perfil no tiene permiso para consultar la Auditoría General.</div>;

  return <div className="space-y-4">
    <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><span className="rounded-2xl bg-white/10 p-3"><ShieldCheck className="h-6 w-6" /></span><div><h2 className="text-xl font-black">Auditoría General</h2><p className="mt-1 text-xs text-slate-300">Trazabilidad multiempresa de usuarios, obras, módulos, automatizaciones y OX.</p></div></div>
        <button onClick={exportCsv} disabled={!visible.length} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs font-bold transition hover:bg-white/10 disabled:opacity-40"><Download className="h-4 w-4" />Exportar CSV</button>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[[Activity,'Movimientos',stats.total,'text-blue-700 bg-blue-50'],[UserRound,'Actores',stats.users,'text-violet-700 bg-violet-50'],[Bot,'OX e IA',stats.ia,'text-orange-700 bg-orange-50'],[AlertTriangle,'Atenciones',stats.failures,'text-red-700 bg-red-50']].map(([Icon,label,value,color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><div className={`mb-3 inline-flex rounded-xl p-2 ${color}`}><Icon className="h-4 w-4" /></div><p className="text-2xl font-black text-slate-900">{value}</p><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label} en esta vista</p></div>)}
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={filters.search} onChange={e => setFilters(v => ({...v, search:e.target.value}))} placeholder="Buscar acción, usuario, obra…" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs font-semibold outline-none focus:border-primary" /></label>
        {global && <select value={filters.empresa} onChange={e => { setPage(0); setFilters(v => ({...v, empresa:e.target.value})); }} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold"><option value="">Todas las empresas</option>{companies.map(value => <option key={value}>{value}</option>)}</select>}
        <select value={filters.modulo} onChange={e => { setPage(0); setFilters(v => ({...v, modulo:e.target.value})); }} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold"><option value="">Todos los módulos</option>{modules.map(value => <option key={value}>{value}</option>)}</select>
        <input type="date" title="Desde" value={filters.desde} onChange={e => { setPage(0); setFilters(v => ({...v, desde:e.target.value})); }} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold" />
        <input type="date" title="Hasta" value={filters.hasta} onChange={e => { setPage(0); setFilters(v => ({...v, hasta:e.target.value})); }} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold" />
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {error && <div className="border-b border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">No fue posible cargar la auditoría: {error}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Fecha</th>{global && <th className="px-4 py-3">Empresa</th>}<th className="px-4 py-3">Módulo / obra</th><th className="px-4 py-3">Movimiento</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan="8" className="p-10 text-center text-xs font-bold text-slate-500">Cargando movimientos…</td></tr> : visible.length === 0 ? <tr><td colSpan="8" className="p-10 text-center text-xs text-slate-500">No existen movimientos para estos filtros.</td></tr> : visible.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600">{fmtDate(row.created_at)}</td>{global && <td className="px-4 py-3 text-xs font-black text-slate-800">{row.empresa}</td>}<td className="px-4 py-3"><p className="text-xs font-black capitalize text-slate-800">{row.modulo?.replaceAll('_',' ')}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.obra_nombre || 'Nivel empresa'}</p></td><td className="max-w-sm px-4 py-3"><p className="text-xs font-bold capitalize text-slate-800">{row.accion?.replaceAll('_',' ')}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{row.descripcion}</p></td><td className="px-4 py-3"><p className="text-xs font-bold text-slate-700">{row.actor_nombre || row.actor_usuario || 'Sistema Obraxis'}</p><p className="text-[10px] text-slate-500">{row.actor_rol || row.actor_empresa || 'Automatización'}</p></td><td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">{row.origen?.replaceAll('_',' ')}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${row.resultado === 'fallido' ? 'bg-red-50 text-red-700' : row.resultado === 'observado' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{row.resultado}</span></td><td className="px-4 py-3"><button onClick={() => setSelected(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Ver detalle"><Eye className="h-4 w-4" /></button></td></tr>)}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-100 p-3"><span className="text-[10px] font-bold text-slate-500">Página {page + 1} · máximo {PAGE_SIZE} movimientos</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage(v => v-1)} className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-30">Anterior</button><button disabled={!hasMore} onClick={() => setPage(v => v+1)} className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-30">Siguiente</button></div></div>
    </section>

    {selected && <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/40" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-primary">Movimiento #{selected.id}</p><h3 className="mt-1 text-xl font-black capitalize text-slate-900">{selected.accion?.replaceAll('_',' ')}</h3></div><button onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-3">{[['Fecha',fmtDate(selected.created_at)],['Empresa',selected.empresa],['Obra',selected.obra_nombre || 'Nivel empresa'],['Módulo',selected.modulo],['Descripción',selected.descripcion || 'Sin detalle'],['Actor',selected.actor_nombre || selected.actor_usuario || 'Sistema Obraxis'],['Rol',selected.actor_rol || '—'],['Origen',selected.origen],['Entidad',`${selected.entidad_tipo || '—'} ${selected.entidad_id || ''}`]].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-800">{value}</p></div>)}</div>{selected.metadatos && Object.keys(selected.metadatos).length > 0 && <div className="mt-5 rounded-xl bg-slate-950 p-4 text-slate-200"><p className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Metadatos técnicos no sensibles</p><pre className="whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(selected.metadatos,null,2)}</pre></div>}</aside></div>}
  </div>;
}
