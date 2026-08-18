import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Building2, CheckCheck, ChevronRight, Clock3, Filter, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

const moduleFor = code => {
  const value = String(code || '').toLowerCase();
  if (value.startsWith('maquinaria_') || value.startsWith('mantenimiento_')) return 'Maquinaria';
  if (value.startsWith('rrhh_') || value.startsWith('personal_')) return 'Recursos Humanos';
  if (value.startsWith('prevencion_') || value.startsWith('cumplimiento_')) return 'Prevención';
  if (value.startsWith('calidad_') || value.startsWith('rdi_') || value.startsWith('nc_')) return 'Calidad';
  if (value.startsWith('acreditacion_')) return 'Acreditaciones';
  if (value.startsWith('bodega_')) return 'Bodega';
  if (value.startsWith('facturacion_') || value.startsWith('dte_')) return 'Facturación';
  if (value.startsWith('gastos_')) return 'Gastos';
  return 'Obras';
};

const priorityFor = item => {
  const explicit = String(item.payload?.prioridad || item.payload?.priority || '').toLowerCase();
  if (explicit) return explicit;
  const code = String(item.evento_codigo || '').toLowerCase();
  if (/falla|vencid|incidente|accidente|rechaz|error|sobrecosto/.test(code)) return 'alta';
  if (/pendiente|observad|mantenimiento|plazo/.test(code)) return 'media';
  return 'normal';
};

export default function PlatformNotificationCenter({ user, onNavigate, compact = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('No leídas');
  const [module, setModule] = useState('Todos');
  const [priority, setPriority] = useState('Todas');

  const invoke = useCallback(async (action, extra = {}) => {
    if (!user?.id) return null;
    const { data, error: invokeError } = await supabase.functions.invoke('notificaciones-moviles', { body: { action, perfil_id: user.id, ...extra } });
    if (invokeError || data?.error) throw new Error(data?.error || 'No fue posible consultar las notificaciones.');
    return data;
  }, [user?.id]);

  const load = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    setError('');
    try { setItems((await invoke('inbox'))?.data || []); }
    catch (loadError) { setError(loadError.message); }
    finally { if (!silent) setLoading(false); }
  }, [invoke, user?.id]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => { if (open) load(true); }, [load, open]);

  const unread = items.filter(item => !item.leida_at).length;
  const modules = useMemo(() => ['Todos', ...new Set(items.map(item => moduleFor(item.evento_codigo)))], [items]);
  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.asunto || ''} ${item.obra_nombre || ''} ${item.evento_codigo || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (status === 'Todas' || (status === 'No leídas' ? !item.leida_at : Boolean(item.leida_at)))
      && (module === 'Todos' || moduleFor(item.evento_codigo) === module)
      && (priority === 'Todas' || priorityFor(item) === priority.toLowerCase());
  }), [items, module, priority, query, status]);

  const markRead = async item => {
    if (item.leida_at) return;
    await invoke('read', { entrega_id: item.id });
    setItems(rows => rows.map(row => row.id === item.id ? { ...row, leida_at: new Date().toISOString() } : row));
  };

  const openItem = async item => {
    try { await markRead(item); } catch {}
    setOpen(false);
    onNavigate?.(item);
  };

  const markAllRead = async () => {
    const pending = items.filter(item => !item.leida_at);
    await Promise.allSettled(pending.map(item => invoke('read', { entrega_id: item.id })));
    const now = new Date().toISOString();
    setItems(rows => rows.map(row => row.leida_at ? row : { ...row, leida_at: now }));
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} title="Centro de notificaciones" className={`relative flex items-center justify-center rounded-xl border transition ${compact ? 'h-9 w-9 border-white/20 bg-white/10 text-white hover:bg-white/20' : 'h-10 w-10 border-slate-200 bg-white text-slate-700 shadow-sm hover:border-primary hover:text-primary'}`}>
      <Bell className="h-5 w-5"/>{unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="fixed inset-0 z-[10000] bg-slate-950/55 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-slate-50 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <header className="border-b border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary p-2.5 text-white"><Bell className="h-5 w-5"/></div><div><h2 className="text-lg font-black text-slate-900">Centro de notificaciones</h2><p className="text-xs text-slate-500">{unread ? `${unread} aviso${unread === 1 ? '' : 's'} sin leer` : 'No tienes avisos pendientes'}</p></div></div><button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="relative sm:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar aviso u obra" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs"/></label><select value={module} onChange={event => setModule(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{modules.map(value => <option key={value}>{value}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><option>No leídas</option><option>Leídas</option><option>Todas</option></select><select value={priority} onChange={event => setPriority(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><option>Todas</option><option>Alta</option><option>Media</option><option>Normal</option></select></div>
          <div className="mt-3 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><Filter className="h-3.5 w-3.5"/>{filtered.length} resultado(s)</span>{unread > 0 && <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] font-black text-primary"><CheckCheck className="h-4 w-4"/>Marcar todas como leídas</button>}</div>
        </header>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">{error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}{loading ? <div className="py-16 text-center text-sm font-bold text-slate-400">Cargando notificaciones…</div> : filtered.length ? <div className="space-y-2">{filtered.map(item => { const itemPriority = priorityFor(item); const detail = item.payload?.detalle || item.payload?.mensaje || item.payload?.resumen || ''; return <button key={item.id} onClick={() => openItem(item)} className={`w-full rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-white ${item.leida_at ? 'border-slate-200 bg-white/70' : 'border-blue-200 bg-blue-50/80 shadow-sm'}`}><div className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${itemPriority === 'alta' ? 'bg-rose-600' : itemPriority === 'media' ? 'bg-amber-500' : item.leida_at ? 'bg-slate-300' : 'bg-blue-600'}`}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-slate-900">{item.asunto || 'Nueva notificación'}</p>{!item.leida_at && <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[9px] font-black text-orange-700">Nueva</span>}</div>{detail && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{String(detail)}</p>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500"><span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5"/>{item.obra_nombre || 'Nivel empresa'}</span><span>{moduleFor(item.evento_codigo)}</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5"/>{new Date(item.created_at).toLocaleString('es-CL')}</span></div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400"/></div></button>; })}</div> : <div className="py-16 text-center"><Bell className="mx-auto h-9 w-9 text-slate-300"/><p className="mt-3 text-sm font-black text-slate-600">No hay notificaciones en esta vista</p><p className="mt-1 text-xs text-slate-400">Cambia los filtros o revisa nuevamente más tarde.</p></div>}</div>
      </aside>
    </div>}
  </>;
}
