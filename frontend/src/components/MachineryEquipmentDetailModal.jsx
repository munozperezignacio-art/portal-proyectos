import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarClock, Gauge, Wrench, X } from 'lucide-react';

export default function MachineryEquipmentDetailModal({ equipment, usage = [], failures = [], maintenance = [], scopeLabel = '', onClose, onUsage, onFailure, onMaintenance }) {
  const [tab, setTab] = useState('historial');
  const scopedUsage = useMemo(() => usage.filter(item => String(item.equipo_id) === String(equipment?.id)), [usage, equipment]);
  const scopedFailures = useMemo(() => failures.filter(item => String(item.equipo_id) === String(equipment?.id)), [failures, equipment]);
  const scopedMaintenance = useMemo(() => maintenance.filter(item => String(item.equipo_id) === String(equipment?.id)), [maintenance, equipment]);
  const history = useMemo(() => [
    ...scopedUsage.map(item => ({ ...item, kind: 'Uso', sortDate: item.fecha || item.created_at })),
    ...scopedFailures.map(item => ({ ...item, kind: 'Falla', sortDate: item.fecha || item.created_at })),
    ...scopedMaintenance.map(item => ({ ...item, kind: 'Mantención', sortDate: item.fecha || item.created_at })),
  ].sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate))), [scopedUsage, scopedFailures, scopedMaintenance]);
  const plans = useMemo(() => (Array.isArray(equipment?.planes_mantencion) ? equipment.planes_mantencion : []).map(plan => {
    const current = Number(equipment?.horometro_inicial || 0);
    const last = Number(plan.ultima_lectura || 0);
    const interval = Number(plan.intervalo || 0);
    return { ...plan, remaining: interval - (current - last), next: last + interval };
  }).sort((a, b) => a.remaining - b.remaining), [equipment]);
  const totalUse = scopedUsage.reduce((sum, item) => sum + Number(item.horas_trabajadas || 0), 0);
  if (!equipment) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Ficha operativa del equipo</p><h3 className="mt-1 text-lg font-black text-slate-950">{equipment.tipo || 'Equipo'} · {equipment.patente || 'S/P'}</h3><p className="mt-1 text-xs text-slate-500">{scopeLabel || 'Historial completo de la empresa'}</p></div>
        <button onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200" aria-label="Cerrar ficha"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Lectura actual" value={Number(equipment.horometro_inicial || 0).toLocaleString('es-CL')} />
          <Kpi label="Uso registrado" value={`${totalUse.toLocaleString('es-CL')} h`} />
          <Kpi label="Fallas" value={scopedFailures.length} tone={scopedFailures.length ? 'rose' : 'green'} />
          <Kpi label="Mantenciones" value={scopedMaintenance.length} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs"><div className="grid gap-2 sm:grid-cols-2"><p><b>Marca / modelo:</b> {equipment.marca || 'Sin informar'}</p><p><b>Estado:</b> {equipment.estado_equipo || 'Operativo'}</p><p><b>Ubicación:</b> {equipment.obra_nombre || 'Bodega / Sin asignar'}</p><p><b>Propiedad:</b> {equipment.tipo_activo || 'Propio'}</p></div></div>
        <div className="flex flex-wrap gap-2">
          {onUsage && <Action icon={Gauge} label="Registrar uso" onClick={onUsage} color="bg-emerald-700" />}
          {onFailure && <Action icon={AlertTriangle} label="Reportar falla" onClick={onFailure} color="bg-rose-700" />}
          {onMaintenance && <Action icon={Wrench} label="Registrar mantención" onClick={onMaintenance} color="bg-indigo-700" />}
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">{[['historial', 'Historial'], ['mantenciones', 'Mantenciones'], ['planes', 'Próximas']].map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
        {tab === 'historial' && <div className="space-y-2">{history.length ? history.map(item => <HistoryItem key={`${item.kind}-${item.id}`} item={item} />) : <Empty text="No hay movimientos registrados para este alcance." />}</div>}
        {tab === 'mantenciones' && <div className="space-y-2">{scopedMaintenance.length ? scopedMaintenance.map(item => <div key={item.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="flex justify-between gap-3"><b className="text-xs text-slate-900">{item.tipo || 'Mantención'}</b><span className="text-[10px] font-bold text-slate-500">{item.fecha}</span></div><p className="mt-1 text-xs text-slate-600">{item.descripcion || 'Sin descripción'}</p><p className="mt-2 text-[10px] font-bold text-indigo-800">Lectura {Number(item.horometro || 0).toLocaleString('es-CL')} · ${Number(item.costo || 0).toLocaleString('es-CL')} · {item.proveedor || item.responsable || 'Sin proveedor'}</p></div>) : <Empty text="No hay mantenciones registradas." />}</div>}
        {tab === 'planes' && <div className="space-y-2">{plans.length ? plans.map((plan, index) => <div key={plan.id || index} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><b className="text-xs text-slate-900">{plan.nombre || 'Mantención preventiva'}</b><p className="mt-1 text-[10px] text-slate-500">Próxima referencia: {plan.next.toLocaleString('es-CL')} {plan.unidad || 'horas'}</p></div><span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${plan.remaining <= 0 ? 'bg-rose-100 text-rose-800' : plan.remaining <= 10 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{plan.remaining <= 0 ? 'Vencida' : `${plan.remaining.toLocaleString('es-CL')} restantes`}</span></div>) : <Empty text="Este equipo no tiene planes de mantención configurados." />}</div>}
      </div>
    </div>
  </div>;
}
function Kpi({ label, value, tone = 'blue' }) { const color = tone === 'rose' ? 'text-rose-700' : tone === 'green' ? 'text-emerald-700' : 'text-blue-950'; return <div className="rounded-2xl border border-slate-200 bg-white p-4"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span><p className={`mt-1 text-2xl font-black ${color}`}>{value}</p></div>; }
function Action({ icon: Icon, label, onClick, color }) { return <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white ${color}`}><Icon className="h-4 w-4" />{label}</button>; }
function HistoryItem({ item }) { const failure = item.kind === 'Falla', maintenance = item.kind === 'Mantención'; const Icon = failure ? AlertTriangle : maintenance ? Wrench : Activity; return <div className={`rounded-2xl border p-4 ${failure ? 'border-rose-200 bg-rose-50/50' : maintenance ? 'border-indigo-200 bg-indigo-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-xs font-black"><Icon className="h-4 w-4" />{item.kind}</span><span className="text-[10px] font-bold text-slate-500">{item.fecha || String(item.created_at || '').slice(0, 10)}</span></div><p className="mt-2 text-xs text-slate-600">{failure ? `${item.descripcion || 'Sin descripción'} · ${item.horas_fuera_servicio || 0} h fuera de servicio` : maintenance ? `${item.tipo || ''} · ${item.descripcion || 'Sin descripción'}` : `${Number(item.horas_trabajadas || 0).toLocaleString('es-CL')} h · ${item.operador || 'Sin operador'}${item.observaciones ? ` · ${item.observaciones}` : ''}`}</p></div>; }
function Empty({ text }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><CalendarClock className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-xs text-slate-500">{text}</p></div>; }
