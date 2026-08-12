import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarRange, Edit3, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

const isoToday = () => new Date().toISOString().slice(0, 10);
const monthEnd = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
const money = value => `$${Number(value || 0).toLocaleString('es-CL')}`;
const normalize = value => String(value || '').trim().toLocaleLowerCase('es-CL');

export default function WorkforceProjection({ user, personal = [], obras = [], canCreate, canEdit, canDelete }) {
  const empty = { obra_nombre: obras[0]?.nombre || '', cargo: '', fecha_inicio: isoToday(), fecha_termino: monthEnd(), cantidad_requerida: 1, costo_mensual_unitario: '', turno: 'Jornada diurna', estado: 'Planificada', observaciones: '' };
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [obraFilter, setObraFilter] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const localKey = `obraxis_rrhh_proyeccion_${user?.empresa || 'OBRAXIS'}`;

  const load = async () => {
    const { data, error: queryError } = await supabase.from('rrhh_proyecciones_dotacion').select('*').eq('empresa', user?.empresa || 'OBRAXIS').order('fecha_inicio', { ascending: true });
    if (queryError) { try { setRows(JSON.parse(localStorage.getItem(localKey) || '[]')); } catch { setRows([]); } return; }
    setRows(data || []);
  };
  useEffect(() => { load(); }, [user?.empresa]);
  useEffect(() => { if (!form.obra_nombre && obras[0]?.nombre) setForm(current => ({ ...current, obra_nombre: obras[0].nombre })); }, [obras]);

  const actualByKey = useMemo(() => {
    const map = new Map();
    personal.filter(item => String(item.estado || 'Activo').toLowerCase() !== 'inactivo').forEach(item => {
      const key = `${normalize(item.obra_nombre)}|${normalize(item.cargo)}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [personal]);
  const visible = useMemo(() => rows.filter(row => !obraFilter || row.obra_nombre === obraFilter).map(row => {
    const actual = actualByKey.get(`${normalize(row.obra_nombre)}|${normalize(row.cargo)}`) || 0;
    return { ...row, actual, brecha: Number(row.cantidad_requerida || 0) - actual, costo_total: Number(row.cantidad_requerida || 0) * Number(row.costo_mensual_unitario || 0) };
  }), [rows, obraFilter, actualByKey]);
  const totals = useMemo(() => visible.reduce((acc, row) => ({ requeridos: acc.requeridos + Number(row.cantidad_requerida || 0), brecha: acc.brecha + Math.max(0, row.brecha), costo: acc.costo + row.costo_total }), { requeridos: 0, brecha: 0, costo: 0 }), [visible]);

  const openNew = () => { setEditing(null); setForm({ ...empty, obra_nombre: obras[0]?.nombre || '' }); setShowForm(true); setError(''); };
  const openEdit = row => { setEditing(row); setForm({ obra_nombre: row.obra_nombre, cargo: row.cargo, fecha_inicio: row.fecha_inicio, fecha_termino: row.fecha_termino, cantidad_requerida: row.cantidad_requerida, costo_mensual_unitario: row.costo_mensual_unitario || '', turno: row.turno || 'Jornada diurna', estado: row.estado || 'Planificada', observaciones: row.observaciones || '' }); setShowForm(true); };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, cantidad_requerida: Number(form.cantidad_requerida), costo_mensual_unitario: Number(form.costo_mensual_unitario || 0), empresa: user?.empresa || 'OBRAXIS', creado_por: user?.nombre || user?.usuario || '' };
    const result = editing ? await supabase.from('rrhh_proyecciones_dotacion').update(payload).eq('id', editing.id).select().single() : await supabase.from('rrhh_proyecciones_dotacion').insert([payload]).select().single();
    setSaving(false);
    if (result.error) {
      const localRow = { ...payload, id: editing?.id || `local_${Date.now()}` };
      const updated = editing ? rows.map(row => row.id === editing.id ? localRow : row) : [...rows, localRow];
      setRows(updated); localStorage.setItem(localKey, JSON.stringify(updated)); setShowForm(false); return;
    }
    setRows(current => editing ? current.map(row => row.id === editing.id ? result.data : row) : [...current, result.data]); setShowForm(false);
  };
  const remove = async row => {
    if (!window.confirm(`¿Eliminar la proyección de ${row.cargo} para ${row.obra_nombre}?`)) return;
    const { error: deleteError } = await supabase.from('rrhh_proyecciones_dotacion').delete().eq('id', row.id);
    if (deleteError && !String(row.id).startsWith('local_')) { setError(deleteError.message); return; }
    setRows(current => current.filter(item => item.id !== row.id));
    localStorage.setItem(localKey, JSON.stringify(rows.filter(item => item.id !== row.id)));
  };

  return <div className="space-y-5">
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white shadow-lg"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><CalendarRange className="h-4 w-4"/>Planificación de dotación</div><h2 className="text-2xl font-black">Proyección de personal</h2><p className="mt-2 max-w-2xl text-sm text-slate-300">Anticipa la dotación requerida por obra y cargo, compara contra el personal asignado y estima el costo mensual futuro.</p></div>{canCreate && <button onClick={openNew} className="rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black text-slate-950"><Plus className="mr-1.5 inline h-4 w-4"/>Nueva necesidad</button>}</div></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Users} label="Dotación requerida" value={totals.requeridos}/><Metric icon={AlertTriangle} label="Brecha por cubrir" value={totals.brecha} warn={totals.brecha > 0}/><Metric icon={BarChart3} label="Costo mensual proyectado" value={money(totals.costo)}/><div className="rounded-2xl border border-slate-200 bg-white p-4"><label className="text-[10px] font-black uppercase text-slate-500">Filtrar por obra</label><select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold"><option value="">Todas las obras</option>{obras.map(obra => <option key={obra.nombre}>{obra.nombre}</option>)}</select></div></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600"><tr><th className="p-3">Obra / período</th><th className="p-3">Cargo</th><th className="p-3 text-center">Requerido</th><th className="p-3 text-center">Asignado</th><th className="p-3 text-center">Brecha</th><th className="p-3">Turno</th><th className="p-3">Costo mensual</th><th className="p-3">Estado</th><th className="p-3 text-center">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="p-3"><b>{row.obra_nombre}</b><div className="mt-1 font-mono text-[10px] text-slate-500">{row.fecha_inicio} → {row.fecha_termino}</div></td><td className="p-3 font-bold">{row.cargo}</td><td className="p-3 text-center font-black">{row.cantidad_requerida}</td><td className="p-3 text-center font-black text-cyan-700">{row.actual}</td><td className={`p-3 text-center font-black ${row.brecha > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{row.brecha > 0 ? `Faltan ${row.brecha}` : row.brecha < 0 ? `Exceso ${Math.abs(row.brecha)}` : 'Cubierta'}</td><td className="p-3">{row.turno}</td><td className="p-3 font-black">{money(row.costo_total)}</td><td className="p-3"><span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-800">{row.estado}</span></td><td className="p-3 text-center">{canEdit && <button onClick={() => openEdit(row)} className="mr-1 rounded-lg p-2 text-indigo-700 hover:bg-indigo-50"><Edit3 className="h-4 w-4"/></button>}{canDelete && <button onClick={() => remove(row)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button>}</td></tr>)}{!visible.length && <tr><td colSpan="9" className="p-12 text-center text-slate-500">Aún no existen necesidades proyectadas de personal.</td></tr>}</tbody></table></div>
    {showForm && <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"><form onSubmit={save} className="w-full max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-black">{editing ? 'Editar necesidad' : 'Nueva necesidad de personal'}</h3><p className="text-xs text-slate-500">Define cuándo y cuánto personal necesitará la obra.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-3 py-2 font-black">Cerrar</button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Obra"><select required value={form.obra_nombre} onChange={e => setForm({ ...form, obra_nombre: e.target.value })} className="input-projection"><option value="">Seleccionar obra</option>{obras.map(obra => <option key={obra.nombre}>{obra.nombre}</option>)}</select></Field><Field label="Cargo requerido"><input required value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} placeholder="Ej. Carpintero" className="input-projection"/></Field><Field label="Fecha de inicio"><input required type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className="input-projection"/></Field><Field label="Fecha de término"><input required type="date" min={form.fecha_inicio} value={form.fecha_termino} onChange={e => setForm({ ...form, fecha_termino: e.target.value })} className="input-projection"/></Field><Field label="Cantidad requerida"><input required min="1" type="number" value={form.cantidad_requerida} onChange={e => setForm({ ...form, cantidad_requerida: e.target.value })} className="input-projection"/></Field><Field label="Costo mensual unitario"><input min="0" type="number" value={form.costo_mensual_unitario} onChange={e => setForm({ ...form, costo_mensual_unitario: e.target.value })} placeholder="$ por persona" className="input-projection"/></Field><Field label="Turno / jornada"><input value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value })} className="input-projection"/></Field><Field label="Estado"><select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="input-projection"><option>Planificada</option><option>Confirmada</option><option>En contratación</option><option>Cubierta</option><option>Cancelada</option></select></Field></div><Field label="Observaciones"><textarea rows="3" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="input-projection"/></Field><button disabled={saving} className="w-full rounded-xl bg-indigo-800 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar proyección'}</button></form></div>}
    <style>{`.input-projection{width:100%;border:1px solid #cbd5e1;border-radius:.75rem;padding:.7rem;font-size:.75rem;font-weight:700;background:#fff}.input-projection:focus{outline:2px solid #67e8f9;outline-offset:1px}`}</style>
  </div>;
}

function Metric({ icon: Icon, label, value, warn }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500"><Icon className={`h-4 w-4 ${warn ? 'text-rose-600' : 'text-indigo-700'}`}/>{label}</div><div className={`mt-3 text-2xl font-black ${warn ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div></div>; }
function Field({ label, children }) { return <label className="block text-[10px] font-black uppercase text-slate-600">{label}<div className="mt-1.5 normal-case">{children}</div></label>; }
