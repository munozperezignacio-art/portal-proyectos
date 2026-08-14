import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Filter, HardHat, RefreshCw, ShieldAlert, Truck, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

const normalize = value => String(value || '').trim().toLowerCase();
const todayKey = () => new Date().toISOString().slice(0, 10);
const priorityMeta = {
  4: { label: 'Crítica', badge: 'bg-rose-100 text-rose-800 border-rose-200', border: 'border-rose-200' },
  3: { label: 'Alta', badge: 'bg-amber-100 text-amber-900 border-amber-200', border: 'border-amber-200' },
  2: { label: 'Media', badge: 'bg-blue-100 text-blue-800 border-blue-200', border: 'border-blue-200' },
  1: { label: 'Seguimiento', badge: 'bg-slate-100 text-slate-700 border-slate-200', border: 'border-slate-200' }
};
const moduleMeta = {
  planning: { label: 'Planificación', icon: CalendarClock, tone: 'text-indigo-700', action: 'Abrir Last Planner' },
  quality: { label: 'Calidad', icon: ClipboardCheck, tone: 'text-teal-700', action: 'Abrir Calidad' },
  prevention: { label: 'Prevención', icon: ShieldAlert, tone: 'text-rose-700', action: 'Abrir Prevención' },
  machinery: { label: 'Maquinaria', icon: Truck, tone: 'text-amber-700', action: 'Abrir Maquinaria' },
  hr: { label: 'RR. HH.', icon: Users, tone: 'text-blue-700', action: 'Abrir RR. HH.' }
};

export default function SpecializedAssistanceInbox({ user, obra, criticalPartidas = [], upcomingPartidas = [], equipmentAvailability = [], incidents = [], personal = [], onNavigate }) {
  const [data, setData] = useState({ restrictions: [], ncs: [], rdis: [], receptions: [], needs: [] });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const company = user?.empresa || 'Obraxis';
  const work = obra?.nombre || '';

  const load = useCallback(async () => {
    if (!work) return;
    setLoading(true); setMessage('');
    const base = query => query.eq('empresa', company).eq('obra_nombre', work);
    const results = await Promise.all([
      base(supabase.from('last_planner_recursos').select('id,partida,recurso,estado,responsable,fecha_compromiso,criticidad,observacion')),
      base(supabase.from('calidad_no_conformidades').select('id,codigo,partida,descripcion,clasificacion,estado,responsable,fecha_compromiso,impacto')),
      base(supabase.from('calidad_rdi').select('id,codigo,partida,sector,estado,fecha_inspeccion,inspector,observaciones')),
      base(supabase.from('calidad_recepciones_partidas').select('id,codigo,partida,sector,estado,fecha_entrega,recibe_por,observaciones')),
      base(supabase.from('rrhh_proyecciones_dotacion').select('id,cargo,cantidad_requerida,fecha_inicio,fecha_termino,estado,observaciones'))
        .in('estado', ['Planificada', 'Confirmada', 'En contratación']).gte('fecha_termino', todayKey())
    ]);
    const [restrictions, ncs, rdis, receptions, needs] = results.map(result => result.error ? [] : result.data || []);
    setData({ restrictions, ncs, rdis, receptions, needs });
    const errors = results.filter(result => result.error);
    if (errors.length) setMessage('Algunas fuentes no pudieron consultarse. La bandeja muestra los datos disponibles.');
    setLoading(false);
  }, [company, work]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const rows = [];
    const today = todayKey();
    criticalPartidas.slice(0, 8).forEach((partida, index) => rows.push({
      id: `schedule-${index}-${partida.partida}`, module: 'planning', priority: partida.status === 'cost' || partida.scheduleGap <= -20 ? 4 : 3,
      title: partida.partida, detail: partida.status === 'cost' ? `Costo imputado supera el valor ganado en $${Math.max(0, partida.costGap).toLocaleString('es-CL')}.` : partida.status === 'no-progress' ? 'Actividad planificada sin reporte de producción.' : `Atraso de ${Math.abs(partida.scheduleGap).toFixed(1)}% frente al plan.`,
      responsible: 'Jefatura de obra'
    }));
    const upcomingNames = new Set(upcomingPartidas.map(item => normalize(item.partida)));
    data.restrictions.filter(item => normalize(item.estado) === 'pendiente').forEach(item => {
      const overdue = item.fecha_compromiso && item.fecha_compromiso < today;
      const nearStart = upcomingNames.has(normalize(item.partida));
      rows.push({ id: `lp-${item.id}`, module: 'planning', priority: overdue ? 4 : nearStart || normalize(item.criticidad) === 'alta' ? 3 : 2, title: `${item.partida} · ${item.recurso}`, detail: overdue ? 'Restricción vencida sin liberar.' : nearStart ? 'Restricción abierta en una partida próxima a iniciar.' : 'Recurso o restricción pendiente de confirmación.', due: item.fecha_compromiso, responsible: item.responsable || 'Sin responsable' });
    });
    data.ncs.filter(item => !['cerrada', 'verificada'].includes(normalize(item.estado))).forEach(item => {
      const overdue = item.fecha_compromiso && item.fecha_compromiso < today;
      rows.push({ id: `nc-${item.id}`, module: 'quality', priority: overdue || ['crítico', 'critico', 'mayor'].includes(normalize(item.clasificacion)) ? 4 : 3, title: `${item.codigo || 'NC'} · ${item.partida || 'Sin partida'}`, detail: overdue ? 'Acción correctiva vencida.' : item.descripcion || 'No conformidad pendiente de tratamiento.', due: item.fecha_compromiso, responsible: item.responsable || 'Sin responsable' });
    });
    data.rdis.filter(item => ['borrador', 'enviada', 'observada'].includes(normalize(item.estado))).forEach(item => rows.push({ id: `rdi-${item.id}`, module: 'quality', priority: normalize(item.estado) === 'observada' ? 3 : 2, title: `${item.codigo || 'RDI'} · ${item.partida}`, detail: normalize(item.estado) === 'observada' ? 'RDI observada: requiere corrección o respuesta.' : 'Inspección o respuesta de calidad pendiente.', due: item.fecha_inspeccion, responsible: item.inspector || 'Inspector no asignado' }));
    data.receptions.filter(item => !['aprobada', 'cerrada', 'recepcionada'].includes(normalize(item.estado))).forEach(item => rows.push({ id: `reception-${item.id}`, module: 'quality', priority: normalize(item.estado).includes('rechaz') ? 3 : 2, title: `${item.codigo || 'Recepción'} · ${item.partida}`, detail: `${item.estado || 'Pendiente'}${item.sector ? ` en ${item.sector}` : ''}.`, due: item.fecha_entrega, responsible: item.recibe_por || 'Receptor no asignado' }));
    incidents.forEach((item, index) => {
      const severity = normalize(item.potencial_gravedad || item.gravedad || item.tipo);
      const closed = ['cerrado', 'cerrada', 'finalizado'].includes(normalize(item.estado));
      if (!closed) rows.push({ id: `incident-${item.id || index}`, module: 'prevention', priority: severity.includes('crít') || severity.includes('ctp') || Number(item.dias_perdidos || 0) > 0 ? 4 : 3, title: item.tipo || item.clasificacion_evento || 'Incidente pendiente', detail: item.descripcion || item.detalle || 'Evento preventivo pendiente de investigación o cierre.', due: item.fecha, responsible: item.responsable || 'Prevención de riesgos' });
    });
    equipmentAvailability.filter(item => item.availablePct < 90 || item.stops > 0).forEach((item, index) => rows.push({ id: `equipment-${index}-${item.name}`, module: 'machinery', priority: item.availablePct < 75 ? 4 : item.availablePct < 90 ? 3 : 2, title: item.name, detail: `Disponibilidad ${item.availablePct.toFixed(1)}% · ${item.stops} falla(s) · ${item.downtime.toLocaleString('es-CL')} h fuera de servicio.`, responsible: 'Encargado de maquinaria' }));
    data.needs.forEach(need => {
      const assigned = personal.filter(worker => normalize(worker.obra_nombre) === normalize(work) && normalize(worker.cargo) === normalize(need.cargo) && worker.activo !== false && !['finiquitado', 'inactivo'].includes(normalize(worker.estado))).length;
      const gap = Math.max(0, Number(need.cantidad_requerida || 0) - assigned);
      if (gap) rows.push({ id: `hr-${need.id}`, module: 'hr', priority: need.fecha_inicio && need.fecha_inicio <= today ? 4 : 3, title: `Brecha de ${need.cargo}`, detail: `Faltan ${gap} de ${need.cantidad_requerida} persona(s) requeridas para la obra.`, due: need.fecha_inicio, responsible: 'Recursos Humanos' });
    });
    return rows.sort((a, b) => b.priority - a.priority || String(a.due || '9999').localeCompare(String(b.due || '9999')));
  }, [criticalPartidas, upcomingPartidas, equipmentAvailability, incidents, personal, data, work]);

  const visible = filter === 'all' ? items : items.filter(item => item.module === filter);
  const critical = items.filter(item => item.priority === 4).length;
  const counts = Object.keys(moduleMeta).reduce((result, key) => ({ ...result, [key]: items.filter(item => item.module === key).length }), {});

  return <section className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 p-5 text-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">Asistencia especializada · sin consumo de IA</p><h4 className="mt-1 text-lg font-black">Bandeja priorizada de la obra</h4><p className="mt-1 max-w-3xl text-xs text-blue-100">Consolida desviaciones, restricciones y compromisos abiertos. No modifica registros: cada acción conduce al módulo responsable.</p></div><button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Actualizar</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric icon={AlertTriangle} label="Prioridades críticas" value={critical} tone={critical ? 'rose' : 'green'}/><Metric icon={HardHat} label="Acciones abiertas" value={items.length} tone={items.length ? 'amber' : 'green'}/><Metric icon={CheckCircle2} label="Módulos sin alertas" value={Object.values(counts).filter(value => value === 0).length} tone="blue"/></div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3"><Filter className="h-4 w-4 text-slate-500"/>{[['all','Todas'], ...Object.entries(moduleMeta).map(([key, meta]) => [key, meta.label])].map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-xl px-3 py-2 text-[10px] font-black ${filter === key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}{key !== 'all' ? ` (${counts[key] || 0})` : ` (${items.length})`}</button>)}</div>
    {message && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{message}</p>}
    {!visible.length ? <div className="rounded-2xl border border-dashed bg-emerald-50 p-10 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600"/><p className="mt-3 text-sm font-black text-emerald-900">Sin prioridades abiertas para este filtro</p><p className="mt-1 text-xs text-emerald-700">La lectura depende de la calidad y actualización de los registros operativos.</p></div> : <div className="space-y-3">{visible.map(item => <PriorityRow key={item.id} item={item} onNavigate={onNavigate}/>)}</div>}
    <p className="text-[10px] text-slate-400">La prioridad se calcula con criticidad, vencimiento, impacto y cercanía al inicio. Las decisiones y aprobaciones continúan en su módulo de origen.</p>
  </section>;
}

function Metric({ icon: Icon, label, value, tone }) { const color = tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-blue-700'; return <div className="rounded-2xl border bg-white p-4"><Icon className={`h-5 w-5 ${color}`}/><p className="mt-3 text-2xl font-black text-slate-900">{value}</p><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p></div>; }
function PriorityRow({ item, onNavigate }) { const meta = moduleMeta[item.module]; const priority = priorityMeta[item.priority] || priorityMeta[1]; const Icon = meta.icon; return <article className={`rounded-2xl border bg-white p-4 ${priority.border}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-xl bg-slate-50 p-2.5"><Icon className={`h-5 w-5 ${meta.tone}`}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-wide text-slate-500">{meta.label}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${priority.badge}`}>{priority.label}</span></div><h5 className="mt-1 text-sm font-black text-slate-900">{item.title}</h5><p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.detail}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">Responsable: {item.responsible}{item.due ? ` · Fecha: ${new Date(`${item.due}T12:00:00`).toLocaleDateString('es-CL')}` : ''}</p></div></div><button type="button" onClick={() => onNavigate?.(item.module)} className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-100">{meta.action}</button></div></article>; }
