import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Filter, Plus, RefreshCw, ShieldAlert, UserRound } from 'lucide-react';
import { supabase } from '../supabaseClient';

const normalize = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const dateKey = value => value ? String(value).substring(0, 10) : '';
const addDays = (value, days) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return dateKey(date.toISOString()); };
const dayDiff = (from, to) => Math.ceil((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
const todayKey = () => new Date().toISOString().substring(0, 10);
const TYPES = ['Material', 'Mano de Obra', 'Maquinaria', 'Permiso / Restricción', 'Información / Plano', 'Calidad', 'Prevención'];
const PRIORITIES = ['Baja', 'Media', 'Alta', 'Crítica'];
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400';

function statusFor(resources, startDate) {
  if (!resources.length) return { code: 'sin_requisitos', label: 'Sin requisitos', tone: 'slate' };
  const active = resources.filter(item => item.estado !== 'no_aplica');
  const pending = active.filter(item => item.estado !== 'confirmado');
  if (!pending.length) return { code: 'lista', label: 'Lista para ejecutar', tone: 'emerald' };
  const overdue = pending.some(item => item.fecha_compromiso && item.fecha_compromiso < todayKey());
  const critical = pending.some(item => item.criticidad === 'Crítica' || item.criticidad === 'Alta');
  const near = dayDiff(todayKey(), startDate) <= 7;
  if (overdue || critical || near) return { code: 'riesgo', label: 'En riesgo', tone: 'rose' };
  return { code: 'preparacion', label: 'En preparación', tone: 'amber' };
}

const toneClass = tone => ({ emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200', rose: 'bg-rose-100 text-rose-800 border-rose-200', amber: 'bg-amber-100 text-amber-800 border-amber-200', slate: 'bg-slate-100 text-slate-700 border-slate-200' }[tone]);

export default function LastPlannerLookahead({ obra, partidas, fechaCorte, getStartDate, user }) {
  const [apuResources, setApuResources] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('todos');
  const [expanded, setExpanded] = useState({});
  const [manual, setManual] = useState({ partida: '', recurso: '', tipo: 'Material', responsable: '', fecha_compromiso: '', criticidad: 'Media', observacion: '' });
  const company = obra?.empresa || user?.empresa || '';
  const actor = user?.nombre || user?.usuario || user?.correo || '';

  const lookaheadPartidas = useMemo(() => {
    const horizon = addDays(fechaCorte, 42);
    return (partidas || []).filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => ({ ...p, startDate: getStartDate(p) }))
      .filter(p => p.startDate && p.startDate >= fechaCorte && p.startDate <= horizon)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [partidas, fechaCorte, getStartDate]);

  const loadLookahead = useCallback(async () => {
    if (!obra?.nombre || !company) return;
    setLoading(true); setMessage('');
    try {
      const { data: savedChecks, error: checksError } = await supabase.from('last_planner_recursos').select('*').eq('empresa', company).eq('obra_nombre', obra.nombre);
      if (checksError) { setSchemaReady(false); setChecks([]); setApuResources([]); return; }
      setSchemaReady(true); setChecks(savedChecks || []);
      let relationQuery = supabase.from('obra_presupuestos').select('presupuesto_id').eq('obra_nombre', obra.nombre);
      if (company) relationQuery = relationQuery.eq('empresa', company);
      const { data: relation } = await relationQuery.maybeSingle();
      let budgetId = relation?.presupuesto_id;
      if (!budgetId) {
        const { data: matchingBudget } = await supabase.from('presupuestos_proyectos').select('id').eq('nombre', obra.nombre).eq('empresa', company).maybeSingle();
        budgetId = matchingBudget?.id;
      }
      if (!budgetId) { setApuResources([]); return; }
      const { data: items } = await supabase.from('presupuestos_items').select('id, partida, descripcion').eq('presupuesto_id', budgetId);
      const itemIds = (items || []).map(item => item.id);
      if (!itemIds.length) { setApuResources([]); return; }
      const [{ data: links }, { data: resources }] = await Promise.all([
        supabase.from('presupuestos_items_recursos').select('*').in('item_id', itemIds),
        supabase.from('recursos_presupuesto').select('*').eq('presupuesto_id', budgetId)
      ]);
      const itemMap = new Map((items || []).map(item => [String(item.id), item]));
      const resourceMap = new Map((resources || []).map(resource => [String(resource.id), resource]));
      setApuResources((links || []).map(link => {
        const item = itemMap.get(String(link.item_id)); const resource = resourceMap.get(String(link.recurso_id));
        return item && resource ? { partida: item.partida || item.descripcion, recurso_clave: `apu-${link.recurso_id}`, recurso: resource.recurso || resource.nombre || 'Recurso APU', tipo: resource.tipo || 'Recurso', categoria: resource.categoria || 'Sin categoría', unidad: resource.unidad || '', cantidad_requerida: link.cantidad || link.rendimiento || 0, origen: 'APU' } : null;
      }).filter(Boolean));
    } catch (error) { setMessage(`No se pudieron cargar los recursos: ${error.message}`); }
    finally { setLoading(false); }
  }, [company, obra?.nombre]);

  useEffect(() => { loadLookahead(); }, [loadLookahead]);

  const mergedResources = useCallback((partida) => {
    const persisted = checks.filter(item => normalize(item.partida) === normalize(partida));
    const savedKeys = new Set(persisted.map(item => item.recurso_clave));
    const apu = apuResources.filter(item => normalize(item.partida) === normalize(partida) && !savedKeys.has(item.recurso_clave))
      .map(item => ({ ...item, estado: 'pendiente', criticidad: 'Media', responsable: '', fecha_compromiso: '', observacion: '' }));
    return [...persisted, ...apu];
  }, [apuResources, checks]);

  const activities = useMemo(() => lookaheadPartidas.map(partida => {
    const resources = mergedResources(partida.partida);
    return { ...partida, resources, readiness: statusFor(resources, partida.startDate) };
  }), [lookaheadPartidas, mergedResources]);
  const visibleActivities = activities.filter(item => filter === 'todos' || item.readiness.code === filter);
  const allResources = activities.flatMap(item => item.resources);
  const pending = allResources.filter(item => item.estado === 'pendiente');
  const overdue = pending.filter(item => item.fecha_compromiso && item.fecha_compromiso < todayKey());

  const persist = async (resource, patch = {}) => {
    const next = { ...resource, ...patch };
    const payload = {
      empresa: company, obra_nombre: obra.nombre, partida: next.partida, recurso_clave: next.recurso_clave,
      recurso: next.recurso, tipo: next.tipo || 'Recurso', unidad: next.unidad || '', cantidad_requerida: Number(next.cantidad_requerida || 0),
      origen: next.origen || 'Manual', estado: next.estado || 'pendiente', responsable: next.responsable || null,
      observacion: next.observacion || null, fecha_compromiso: next.fecha_compromiso || null, criticidad: next.criticidad || 'Media',
      liberado_at: next.estado === 'confirmado' ? (next.liberado_at || new Date().toISOString()) : null,
      liberado_por: next.estado === 'confirmado' ? (next.liberado_por || actor) : null, actualizado_por: actor || null
    };
    const { data, error } = await supabase.from('last_planner_recursos').upsert(payload, { onConflict: 'empresa,obra_nombre,partida,recurso_clave' }).select().single();
    if (error) { setMessage(`No se pudo guardar: ${error.message}`); return false; }
    setChecks(previous => [...previous.filter(item => !(item.partida === data.partida && item.recurso_clave === data.recurso_clave)), data]);
    return true;
  };

  const addManual = async () => {
    if (!manual.partida || !manual.recurso.trim()) { setMessage('Selecciona una partida y describe el requisito.'); return; }
    const ok = await persist({ ...manual, recurso: manual.recurso.trim(), recurso_clave: `manual-${crypto.randomUUID()}`, origen: 'Manual', estado: 'pendiente', unidad: '', cantidad_requerida: 0 });
    if (ok) { setManual(current => ({ ...current, recurso: '', observacion: '' })); setMessage('Restricción o recurso agregado al plan de liberación.'); }
  };

  const suggestions = useMemo(() => {
    const rows = [];
    activities.forEach(item => {
      const waiting = item.resources.filter(resource => resource.estado === 'pendiente');
      const late = waiting.filter(resource => resource.fecha_compromiso && resource.fecha_compromiso < todayKey());
      if (!item.resources.length) rows.push({ level: 'Alta', title: item.partida, text: 'Definir recursos y restricciones antes de comprometer la partida.' });
      else if (late.length) rows.push({ level: 'Crítica', title: item.partida, text: `Escalar ${late.length} restricción(es) vencida(s) y reasignar responsable o fecha.` });
      else if (dayDiff(todayKey(), item.startDate) <= 7 && waiting.length) rows.push({ level: 'Alta', title: item.partida, text: `Resolver ${waiting.length} requisito(s) antes del inicio programado ${item.startDate}.` });
      else if (waiting.some(resource => !resource.responsable)) rows.push({ level: 'Media', title: item.partida, text: 'Asignar responsable a todas las restricciones abiertas.' });
    });
    return rows.slice(0, 8);
  }, [activities]);

  return <div className="space-y-5">
    <div className="rounded-2xl bg-indigo-950 p-5 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">Last Planner System</p><h4 className="mt-1 text-base font-black">Lookahead de 6 semanas y liberación de restricciones</h4><p className="mt-1 text-xs text-indigo-100">Controla qué puede ejecutarse, quién libera cada requisito y cuándo debe quedar resuelto.</p></div><button type="button" onClick={loadLookahead} className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
    {!schemaReady ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"><b>Falta actualizar Last Planner en Supabase.</b> Aplica la migración vigente y vuelve a cargar.</div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Partidas en ventana', activities.length, ClipboardCheck, 'text-indigo-700'], ['Listas para ejecutar', activities.filter(x => x.readiness.code === 'lista').length, CheckCircle2, 'text-emerald-700'], ['Restricciones abiertas', pending.length, ShieldAlert, 'text-amber-700'], ['Compromisos vencidos', overdue.length, CalendarClock, 'text-rose-700']].map(([label, value, Icon, color]) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon className={`h-5 w-5 ${color}`} /><p className="mt-3 text-2xl font-black text-slate-900">{value}</p><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p></div>)}
      </div>

      <div className="rounded-2xl border bg-white p-4"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-700"/><h5 className="text-xs font-black uppercase text-slate-800">Agregar restricción o recurso manual</h5></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <select value={manual.partida} onChange={e => setManual({ ...manual, partida: e.target.value })} className={input}><option value="">Partida *</option>{lookaheadPartidas.map(p => <option key={p.id || p.partida} value={p.partida}>{p.partida}</option>)}</select>
        <input value={manual.recurso} onChange={e => setManual({ ...manual, recurso: e.target.value })} placeholder="Requisito o recurso *" className={input}/>
        <select value={manual.tipo} onChange={e => setManual({ ...manual, tipo: e.target.value })} className={input}>{TYPES.map(x => <option key={x}>{x}</option>)}</select>
        <select value={manual.criticidad} onChange={e => setManual({ ...manual, criticidad: e.target.value })} className={input}>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select>
        <input value={manual.responsable} onChange={e => setManual({ ...manual, responsable: e.target.value })} placeholder="Responsable" className={input}/>
        <input type="date" value={manual.fecha_compromiso} onChange={e => setManual({ ...manual, fecha_compromiso: e.target.value })} className={input}/>
        <input value={manual.observacion} onChange={e => setManual({ ...manual, observacion: e.target.value })} placeholder="Observación / condición de liberación" className={`${input} xl:col-span-2`}/>
      </div><button type="button" onClick={addManual} className="mt-3 flex items-center gap-1 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-black text-white"><Plus className="h-3.5 w-3.5"/>Agregar al plan</button>{message && <p className="mt-2 text-[11px] font-semibold text-slate-600">{message}</p>}</div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3"><Filter className="h-4 w-4 text-slate-500"/>{[['todos','Todas'],['lista','Listas'],['riesgo','En riesgo'],['preparacion','En preparación'],['sin_requisitos','Sin requisitos']].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-[10px] font-black ${filter === key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>

      {!visibleActivities.length ? <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-xs text-slate-500">No hay partidas para este filtro en la ventana de seis semanas.</div> : <div className="space-y-3">{visibleActivities.map((partida) => {
        const isOpen = expanded[partida.partida] !== false;
        const week = Math.max(1, Math.ceil((dayDiff(fechaCorte, partida.startDate) + 1) / 7));
        const done = partida.resources.filter(x => x.estado === 'confirmado').length;
        return <div key={partida.id || partida.partida} className="overflow-hidden rounded-2xl border bg-white"><button type="button" onClick={() => setExpanded(current => ({ ...current, [partida.partida]: !isOpen }))} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-indigo-100 px-2 py-0.5 text-[9px] font-black text-indigo-900">SEMANA {week}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${toneClass(partida.readiness.tone)}`}>{partida.readiness.label}</span></div><h5 className="mt-1 truncate text-sm font-black text-slate-900">{partida.partida}</h5><p className="text-[10px] font-semibold text-slate-500">Inicio {partida.startDate} · {done}/{partida.resources.length} liberados</p></div>{isOpen ? <ChevronUp className="h-4 w-4 shrink-0"/> : <ChevronDown className="h-4 w-4 shrink-0"/>}</button>
          {isOpen && <div className="border-t bg-slate-50/60 p-3">{!partida.resources.length ? <p className="rounded-xl bg-white p-3 text-xs italic text-slate-500">Sin requisitos registrados. Agrega recursos APU o restricciones manuales antes de comprometer la partida.</p> : <div className="space-y-2">{partida.resources.map(resource => <div key={resource.recurso_clave} className="grid gap-2 rounded-xl border bg-white p-3 lg:grid-cols-[minmax(180px,1.4fr)_130px_160px_145px_minmax(180px,1fr)]"><div><p className="text-xs font-black text-slate-800">{resource.recurso}</p><p className="text-[9px] font-bold uppercase text-slate-400">{resource.tipo} · {resource.origen}{resource.cantidad_requerida ? ` · ${resource.cantidad_requerida} ${resource.unidad || ''}` : ''}</p></div><select value={resource.estado || 'pendiente'} onChange={e => persist(resource, { estado: e.target.value })} className={input}><option value="pendiente">Pendiente</option><option value="confirmado">Liberado</option><option value="no_aplica">No aplica</option></select><div className="relative"><UserRound className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400"/><input defaultValue={resource.responsable || ''} onBlur={e => persist(resource, { responsable: e.target.value.trim() })} placeholder="Responsable" className={`${input} pl-7`}/></div><input type="date" defaultValue={dateKey(resource.fecha_compromiso)} onBlur={e => persist(resource, { fecha_compromiso: e.target.value })} className={`${input} ${resource.estado === 'pendiente' && resource.fecha_compromiso && resource.fecha_compromiso < todayKey() ? 'border-rose-400 bg-rose-50' : ''}`}/><div className="grid grid-cols-[105px_1fr] gap-2"><select value={resource.criticidad || 'Media'} onChange={e => persist(resource, { criticidad: e.target.value })} className={input}>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select><input defaultValue={resource.observacion || ''} onBlur={e => persist(resource, { observacion: e.target.value.trim() })} placeholder="Observación" className={input}/></div></div>)}</div>}</div>}
        </div>;
      })}</div>}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-indigo-800"/><h5 className="text-xs font-black uppercase text-indigo-950">Sugerencias de recuperación y preparación</h5></div>{!suggestions.length ? <p className="mt-3 text-xs font-semibold text-emerald-700">La ventana no presenta alertas relevantes con los datos registrados.</p> : <div className="mt-3 grid gap-2 md:grid-cols-2">{suggestions.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-[9px] font-black uppercase text-indigo-700">Prioridad {item.level}</p><p className="mt-1 text-xs font-black text-slate-900">{item.title}</p><p className="mt-1 text-[11px] text-slate-600">{item.text}</p></div>)}</div>}</div>
      <p className="text-[10px] text-slate-400">Los semáforos y sugerencias se calculan con fechas, estados y criticidades registradas. No modifican la programación contractual.</p>
    </>}
  </div>;
}
