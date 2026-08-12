import React, { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, PackageMinus, ShieldAlert, TrendingUp, UserCheck, Users, Warehouse } from 'lucide-react';

const number = value => Number(value || 0);
const money = value => `$${Math.round(number(value)).toLocaleString('es-CL')}`;
const normalize = value => String(value || '').toLowerCase();
const dateOf = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const monthKey = value => { const date = dateOf(value); return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : ''; };
const monthLabel = key => { const [year, month] = key.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }); };
const recentMonths = (count = 6) => Array.from({ length: count }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (count - 1 - index)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; });
const withinDays = (value, days) => { const date = dateOf(value); return date && date >= new Date(Date.now() - days * 86400000); };
const grouped = (items, keyFn, valueFn = () => 1) => [...items.reduce((map, item) => { const key = keyFn(item) || 'Sin información'; map.set(key, (map.get(key) || 0) + valueFn(item)); return map; }, new Map())].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const flattenValues = value => value && typeof value === 'object' ? Object.values(value).flatMap(flattenValues) : [value];

export function PreventionStatistics({ respuestas = [], formularios = [], cumplimiento = [], asignaciones = [], obras = [] }) {
  const [period, setPeriod] = useState('90');
  const [work, setWork] = useState('');
  const filtered = useMemo(() => respuestas.filter(record => {
    const inPeriod = period === 'all' || withinDays(record.created_at || record.fecha, Number(period));
    const recordWork = record.proyecto_nombre || record.obra_nombre || record.respuestas?.proyecto_nombre || '';
    return inPeriod && (!work || recordWork === work);
  }), [respuestas, period, work]);
  const metrics = useMemo(() => {
    const incident = filtered.filter(record => {
      const text = normalize(`${record.prevencion_formularios?.titulo} ${record.prevencion_formularios?.categoria} ${record.respuestas?.tipo}`);
      return text.includes('incidente') || text.includes('accidente');
    });
    const findings = filtered.reduce((total, record) => total + flattenValues(record.respuestas || {}).filter(value => ['no cumple','rechazado','rechazada','deficiente'].includes(normalize(value))).length, 0);
    const compliant = cumplimiento.filter(row => normalize(row.estado || row.resultado) === 'cumple').length;
    const complianceRate = cumplimiento.length ? compliant / cumplimiento.length * 100 : 0;
    return { incident: incident.length, findings, complianceRate, pending: Math.max(0, asignaciones.length - cumplimiento.filter(row => withinDays(row.fecha_cumplimiento || row.created_at, 30)).length) };
  }, [filtered, cumplimiento, asignaciones]);
  const months = recentMonths();
  const trend = months.map(key => ({ label: monthLabel(key), value: filtered.filter(row => monthKey(row.created_at || row.fecha) === key).length }));
  const byWork = grouped(filtered, row => row.proyecto_nombre || row.obra_nombre || row.respuestas?.proyecto_nombre || 'Corporativo').slice(0, 7);
  const byForm = grouped(filtered, row => row.prevencion_formularios?.titulo || formularios.find(form => form.id === row.formulario_id)?.titulo || 'Registro preventivo').slice(0, 7);
  return <AnalyticsShell title="Estadísticas de Prevención" subtitle="Indicadores preventivos consolidados desde inspecciones, incidentes y controles de cumplimiento." filters={<><select value={period} onChange={e => setPeriod(e.target.value)} className="stat-filter"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="all">Todo el historial</option></select><select value={work} onChange={e => setWork(e.target.value)} className="stat-filter"><option value="">Todas las obras</option>{obras.map(item => <option key={item.nombre || item} value={item.nombre || item}>{item.nombre || item}</option>)}</select></>}>
    <KpiGrid items={[[ClipboardCheck,'Registros analizados',filtered.length,'blue'],[ShieldAlert,'Incidentes / accidentes',metrics.incident,metrics.incident ? 'rose' : 'green'],[AlertTriangle,'Hallazgos críticos',metrics.findings,metrics.findings ? 'amber' : 'green'],[CheckCircle2,'Cumplimiento',`${metrics.complianceRate.toFixed(1)}%`,metrics.complianceRate >= 90 ? 'green' : 'amber'],[CalendarClock,'Controles pendientes',metrics.pending,metrics.pending ? 'amber' : 'green']]}/>
    <div className="grid gap-4 xl:grid-cols-3"><TrendCard title="Actividad preventiva mensual" data={trend}/><RankCard title="Registros por obra" data={byWork}/><RankCard title="Formularios más utilizados" data={byForm}/></div>
  </AnalyticsShell>;
}

export function WarehouseStatistics({ stockRows = [], movimientos = [], bodegas = [], productos = [], guias = [] }) {
  const [period, setPeriod] = useState('90');
  const [warehouseId, setWarehouseId] = useState('');
  const filteredStock = stockRows.filter(row => !warehouseId || String(row.bodega_id) === warehouseId);
  const filteredMoves = movimientos.filter(row => (!warehouseId || String(row.bodega_id) === warehouseId) && (period === 'all' || withinDays(row.fecha || row.created_at, Number(period))));
  const positive = new Set(['entrada','ajuste +','transferencia entrada']);
  const negative = new Set(['salida','ajuste -','transferencia salida']);
  const stockValue = filteredStock.reduce((sum, row) => sum + Math.max(0, number(row.valor)), 0);
  const low = filteredStock.filter(row => number(row.stock) <= number(row.producto?.stock_minimo));
  const stockout = filteredStock.filter(row => number(row.stock) <= 0);
  const entries = filteredMoves.filter(row => positive.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0);
  const exits = filteredMoves.filter(row => negative.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0);
  const linkedGuides = filteredMoves.filter(row => row.dte_documento_id).length;
  const traceability = filteredMoves.length ? linkedGuides / filteredMoves.length * 100 : 0;
  const warehouseValue = grouped(filteredStock, row => row.bodega?.nombre || 'Bodega', row => Math.max(0, number(row.valor))).slice(0, 7);
  const consumption = grouped(filteredMoves.filter(row => negative.has(normalize(row.tipo))), row => productos.find(product => product.id === row.producto_id)?.nombre || 'Producto', row => number(row.cantidad)).slice(0, 7);
  const months = recentMonths();
  const trend = months.map(key => ({ label: monthLabel(key), value: filteredMoves.filter(row => monthKey(row.fecha || row.created_at) === key && negative.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0) }));
  return <AnalyticsShell title="Estadísticas de Bodega" subtitle="Valor, rotación, consumo, disponibilidad y trazabilidad documental del inventario." filters={<><select value={period} onChange={e => setPeriod(e.target.value)} className="stat-filter"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="all">Todo el historial</option></select><select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="stat-filter"><option value="">Todas las bodegas</option>{bodegas.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></>}>
    <KpiGrid items={[[CircleDollarSign,'Stock valorizado',money(stockValue),'blue'],[AlertTriangle,'Bajo mínimo',low.length,low.length ? 'amber' : 'green'],[PackageMinus,'Quiebres de stock',stockout.length,stockout.length ? 'rose' : 'green'],[TrendingUp,'Entradas valorizadas',money(entries),'green'],[Boxes,'Salidas valorizadas',money(exits),'blue'],[ClipboardCheck,'Movimientos con guía',`${traceability.toFixed(1)}%`,traceability >= 80 ? 'green' : 'amber']]}/>
    <div className="grid gap-4 xl:grid-cols-3"><TrendCard title="Consumo valorizado mensual" data={trend} formatter={money}/><RankCard title="Valor por bodega" data={warehouseValue} formatter={money}/><RankCard title="Productos con mayor salida" data={consumption}/></div>
    <div className="rounded-2xl border bg-white p-4 text-xs text-slate-600"><b>{guias.length}</b> guías de despacho disponibles · <b>{linkedGuides}</b> movimientos enlazados a DTE 52.</div>
  </AnalyticsShell>;
}

export function HrStatistics({ personal = [], obras = [] }) {
  const [work, setWork] = useState('');
  const filtered = personal.filter(worker => !work || (worker.obra_nombre || '') === work);
  const active = filtered.filter(worker => worker.activo !== false && !['finiquitado','inactivo'].includes(normalize(worker.estado)));
  const assigned = active.filter(worker => worker.obra_nombre);
  const unassigned = active.length - assigned.length;
  const expiring = active.filter(worker => { const date = dateOf(worker.fecha_vencimiento_contrato); return date && date >= new Date() && date <= new Date(Date.now() + 30 * 86400000); });
  const expired = active.filter(worker => { const date = dateOf(worker.fecha_vencimiento_contrato); return date && date < new Date(); });
  const monthlyCost = active.reduce((sum, worker) => sum + number(worker.sueldo_base) + number(worker.colacion) + number(worker.movilizacion), 0);
  const byWork = grouped(active, worker => worker.obra_nombre || 'Oficina / sin asignar').slice(0, 8);
  const byRole = grouped(active, worker => worker.cargo || 'Sin cargo').slice(0, 8);
  const byContract = grouped(active, worker => worker.tipo_contrato || 'Sin información').slice(0, 6);
  const health = grouped(active, worker => worker.prevision_salud || 'Sin información').slice(0, 6);
  return <AnalyticsShell title="Estadísticas de Recursos Humanos" subtitle="Dotación, asignaciones, vencimientos contractuales y estructura del costo mensual." filters={<select value={work} onChange={e => setWork(e.target.value)} className="stat-filter"><option value="">Toda la empresa</option>{obras.map(item => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}</select>}>
    <KpiGrid items={[[Users,'Dotación activa',active.length,'blue'],[UserCheck,'Asignados a obra',assigned.length,'green'],[Warehouse,'Sin asignación',unassigned,unassigned ? 'amber' : 'green'],[CalendarClock,'Contratos por vencer',expiring.length,expiring.length ? 'amber' : 'green'],[AlertTriangle,'Contratos vencidos',expired.length,expired.length ? 'rose' : 'green'],[CircleDollarSign,'Costo base mensual',money(monthlyCost),'blue']]}/>
    <div className="grid gap-4 xl:grid-cols-2"><RankCard title="Dotación por obra" data={byWork}/><RankCard title="Dotación por cargo" data={byRole}/><DonutLikeCard title="Tipos de contrato" data={byContract}/><DonutLikeCard title="Sistema de salud" data={health}/></div>
    {expiring.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="text-xs font-black uppercase text-amber-900">Vencimientos en los próximos 30 días</h4><div className="mt-2 grid gap-2 md:grid-cols-2">{expiring.map(worker => <div key={worker.id || worker.rut} className="rounded-xl bg-white p-3 text-xs"><b>{worker.nombre}</b><span className="float-right font-mono text-amber-800">{new Date(`${worker.fecha_vencimiento_contrato}T12:00:00`).toLocaleDateString('es-CL')}</span><p className="text-slate-500">{worker.cargo || 'Sin cargo'} · {worker.obra_nombre || 'Sin obra'}</p></div>)}</div></div>}
  </AnalyticsShell>;
}

function AnalyticsShell({ title, subtitle, filters, children }) { return <section className="space-y-4"><style>{`.stat-filter{min-width:180px;border:1px solid #cbd5e1;border-radius:12px;background:white;padding:9px 12px;font-size:12px;font-weight:700;color:#334155;outline:none}`}</style><div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-white p-5"><div><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className="flex flex-wrap gap-2">{filters}</div></div>{children}</section>; }
function KpiGrid({ items }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{items.map(([Icon,label,value,tone]) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon className={`h-5 w-5 ${tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-blue-700'}`}/><p className="mt-3 text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>)}</div>; }
function RankCard({ title, data, formatter = value => number(value).toLocaleString('es-CL', { maximumFractionDigits: 1 }) }) { const max = Math.max(...data.map(item => number(item.value)), 1); return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-4 space-y-3">{data.map(item => <div key={item.label}><div className="mb-1 flex justify-between gap-3 text-[11px]"><span className="truncate font-bold text-slate-700">{item.label}</span><b>{formatter(item.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.max(4, number(item.value) / max * 100)}%` }}/></div></div>)}{!data.length && <p className="py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</p>}</div></div>; }
function TrendCard({ title, data, formatter = value => number(value).toLocaleString('es-CL') }) { const max = Math.max(...data.map(item => number(item.value)), 1); return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-5 flex h-44 items-end gap-2">{data.map(item => <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[9px] font-black text-slate-600">{formatter(item.value)}</span><div className="w-full rounded-t-md bg-emerald-600" style={{ height: `${Math.max(5, number(item.value) / max * 120)}px` }}/><span className="text-[8px] uppercase text-slate-400">{item.label}</span></div>)}</div></div>; }
function DonutLikeCard({ title, data }) { const total = data.reduce((sum, item) => sum + number(item.value), 0); const colors = ['bg-blue-700','bg-emerald-600','bg-amber-500','bg-violet-600','bg-rose-500','bg-slate-500']; return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">{data.map((item,index) => <div key={item.label} className={colors[index % colors.length]} style={{ width: `${total ? item.value / total * 100 : 0}%` }}/>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{data.map((item,index) => <div key={item.label} className="flex items-center gap-2 text-[11px]"><span className={`h-2.5 w-2.5 rounded-full ${colors[index % colors.length]}`}/><span className="min-w-0 flex-1 truncate text-slate-600">{item.label}</span><b>{item.value}</b></div>)}</div></div>; }
