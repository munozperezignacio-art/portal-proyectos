import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { assignmentConflicts, filterAssignments, hasAssignedWork, operationalStatus } from '../utils/equipmentAssignments';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const dateLabel = value => value ? value.slice(0,10).split('-').reverse().join('/') : '—';
const fieldClass = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white min-w-0';
export default function EquipmentAssignments({ equipment, works, reservations, rentals, company, canEdit, onSaved }) {
  const [filters, setFilters] = useState({ search: '', work: '', availability: '', operational: '' });
  const [selected, setSelected] = useState([]);
  const [targets, setTargets] = useState([]);
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState(today()); const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const rentedIds = rentals.filter(r=>r.estado === 'Activo').map(r=>String(r.equipo_id));
  const visible = filterAssignments(equipment, filters, rentedIds);
  const picked = equipment.filter(e=>selected.includes(e.id));
  const totalAvailable = equipment.filter(e=>!hasAssignedWork(e.obra_nombre) && !rentedIds.includes(String(e.id)) && operationalStatus(e)==='Operativo').length;
  const setFilter = (key, value) => setFilters(previous=>({...previous, [key]: value}));
  const toggle = id => setSelected(previous=>previous.includes(id) ? previous.filter(i=>i!==id) : [...previous,id]);
  const open = items => {
    setTargets(items); setDestination(items.length===1 && hasAssignedWork(items[0].obra_nombre) ? items[0].obra_nombre : '');
    setStart(items.length===1 ? items[0].fecha_asig || today() : today()); setEnd(items.length===1 ? items[0].fecha_hasta_estimada || '' : ''); setMessage('');
  };
  const conflicts = destination ? assignmentConflicts(targets.map(e=>e.id), reservations, start, end) : [];
  const rentalConflicts = destination ? assignmentConflicts(targets.map(e=>e.id), rentals.filter(r=>r.estado==='Activo'), start, end) : [];
  const save = async event => {
    event.preventDefault(); if (!canEdit || busy || !targets.length || !company) return;
    setMessage('');
    if (destination && (!start || (end && end < start))) { setMessage('Indica una fecha desde válida y un término igual o posterior.'); return; }
    if (destination && !works.some(w=>w.nombre===destination)) { setMessage('La obra de destino ya no está disponible.'); return; }
    if (rentalConflicts.length) { setMessage('Hay equipos con arriendo activo en ese período. Resuelve el arriendo antes de asignarlos.'); return; }
    if (conflicts.length && !window.confirm('La asignación coincide con reservas de los equipos seleccionados. ¿Continuar de todas formas?')) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('inventario_maquinaria')
        .update({ obra_nombre: destination || null, fecha_asig: destination ? start : null, fecha_hasta_estimada: destination ? end || null : null })
        .eq('empresa',company).in('id',targets.map(e=>e.id)).select('id');
      if (error) throw error;
      if (data.length !== targets.length) throw new Error(`Se guardaron ${data.length} de ${targets.length} equipos. Revisa tus permisos y actualiza la vista.`);
      setTargets([]); setSelected([]); setMessage(`${data.length} equipos ${destination ? `asignados a ${destination}` : 'devueltos a bodega'}.`); await onSaved();
    } catch(error) { setMessage(`No se completó la asignación: ${error.message}`); }
    finally { setBusy(false); }
  };
  const badge = e => <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${rentedIds.includes(String(e.id)) ? 'bg-violet-100 text-violet-800' : hasAssignedWork(e.obra_nombre) ? 'bg-blue-100 text-blue-900' : operationalStatus(e)!=='Operativo' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{rentedIds.includes(String(e.id)) ? 'Arrendado a tercero' : hasAssignedWork(e.obra_nombre) ? 'Asignado' : operationalStatus(e)==='Operativo' ? 'Disponible' : 'En bodega'}</span>;
  const action = e => canEdit && <button onClick={()=>open([e])} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-50">{hasAssignedWork(e.obra_nombre) ? 'Cambiar' : 'Asignar'}</button>;
  return <section className="space-y-4">
    <header><h3 className="text-lg font-black text-slate-900">Asignación de equipos</h3><p className="text-sm text-slate-500">Ubicación actual, disponibilidad y fechas de asignación. Las fechas estimadas no liberan equipos automáticamente.</p></header>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Disponibles',totalAvailable,'text-emerald-700'],['Asignados a obra',equipment.filter(e=>hasAssignedWork(e.obra_nombre)).length,'text-blue-800'],['En mantención',equipment.filter(e=>operationalStatus(e)==='Mantención').length,'text-amber-700'],['Paralizados',equipment.filter(e=>operationalStatus(e)==='Paralizado').length,'text-rose-700']].map(([label,value,color])=><div key={label} className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-black mt-1 ${color}`}>{value}</p></div>)}</div>
    <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <input className={fieldClass} aria-label="Buscar equipos" placeholder="Código, nombre, marca o modelo…" value={filters.search} onChange={e=>setFilter('search',e.target.value)}/>
        <select aria-label="Filtrar por obra" className={fieldClass} value={filters.work} onChange={e=>setFilter('work',e.target.value)}><option value="">Todas las ubicaciones</option><option value="__bodega">Bodega / Sin asignar</option>{[...new Set([...works.map(w=>w.nombre),...equipment.filter(e=>hasAssignedWork(e.obra_nombre)).map(e=>e.obra_nombre)])].sort().map(name=><option key={name}>{name}</option>)}</select>
        <select aria-label="Filtrar disponibilidad" className={fieldClass} value={filters.availability} onChange={e=>setFilter('availability',e.target.value)}><option value="">Toda disponibilidad</option><option value="disponible">Disponibles</option><option value="asignado">Asignados a obra</option></select>
        <select aria-label="Filtrar estado operacional" className={fieldClass} value={filters.operational} onChange={e=>setFilter('operational',e.target.value)}><option value="">Todo estado operacional</option>{[...new Set(['Operativo','Mantención','Paralizado',...equipment.map(operationalStatus)])].map(s=><option key={s}>{s}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{visible.length} de {equipment.length} equipos · {picked.length} seleccionados</p><div className="flex gap-2">{selected.length>0 && <button onClick={()=>setSelected([])} className="text-xs font-bold px-3">Limpiar selección</button>}{canEdit && <button disabled={!picked.length} onClick={()=>open(picked)} className="bg-primary text-white rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40">Asignar seleccionados ({picked.length})</button>}</div></div>
      {!!visible.length && canEdit && <label className="flex gap-2 items-center text-xs font-bold"><input type="checkbox" checked={visible.every(e=>selected.includes(e.id))} onChange={e=>setSelected(previous=>e.target.checked ? [...new Set([...previous,...visible.map(e=>e.id)])] : previous.filter(id=>!visible.some(item=>item.id===id)))}/>Seleccionar equipos visibles</label>}
      <div className="hidden md:block overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['','Código','Nombre de equipo','Marca / Modelo','Disponibilidad','Estado operacional','Obra actual','Desde','Hasta estimada',''].map((h,i)=><th key={i} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{visible.map(e=><tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3">{canEdit && <input aria-label={`Seleccionar ${e.patente}`} type="checkbox" checked={selected.includes(e.id)} onChange={()=>toggle(e.id)}/>}</td><td className="p-3 font-black whitespace-nowrap">{e.patente || 'Sin código'}</td><td className="p-3 font-semibold min-w-40">{e.tipo}</td><td className="p-3 text-slate-600">{e.marca || '—'}</td><td className="p-3 whitespace-nowrap">{badge(e)}</td><td className="p-3">{operationalStatus(e)}</td><td className="p-3 min-w-36">{hasAssignedWork(e.obra_nombre)?e.obra_nombre:'Bodega central'}</td><td className="p-3 whitespace-nowrap">{hasAssignedWork(e.obra_nombre)?dateLabel(e.fecha_asig):'—'}</td><td className="p-3 whitespace-nowrap">{hasAssignedWork(e.obra_nombre)?dateLabel(e.fecha_hasta_estimada):'—'}</td><td className="p-3">{action(e)}</td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:hidden">{visible.map(e=><article key={e.id} className="rounded-xl border border-slate-200 p-4 space-y-2"><div className="flex justify-between gap-2"><label className="flex gap-2 font-black">{canEdit && <input aria-label={`Seleccionar ${e.patente}`} type="checkbox" checked={selected.includes(e.id)} onChange={()=>toggle(e.id)}/>} {e.patente}</label>{badge(e)}</div><p className="font-bold text-sm">{e.tipo}</p><p className="text-xs text-slate-500">{e.marca} · {operationalStatus(e)}</p><p className="text-xs">{hasAssignedWork(e.obra_nombre)?e.obra_nombre:'Bodega central'}{hasAssignedWork(e.obra_nombre) && ` · ${dateLabel(e.fecha_asig)} → ${dateLabel(e.fecha_hasta_estimada)}`}</p>{action(e)}</article>)}</div>
      {!visible.length && <p className="text-center py-10 text-sm text-slate-500">No hay equipos que coincidan con los filtros.</p>}
    </div>
    {message && <p role="status" className="bg-blue-50 text-blue-900 p-3 rounded-xl text-sm">{message}</p>}
    {!!targets.length && <div className="fixed inset-0 z-[100] bg-slate-950/60 p-4 flex items-center justify-center"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Asignar equipos" className="bg-white p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto space-y-4">
      <h3 className="text-lg font-black">Asignar {targets.length} equipo{targets.length!==1?'s':''}</h3><p className="text-xs text-slate-500">{targets.map(e=>e.patente).join(', ')}</p>
      <label className="block text-xs font-bold">Destino<select className={`${fieldClass} block w-full mt-1`} value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Bodega central / Sin asignar</option>{works.map(w=><option key={w.nombre}>{w.nombre}</option>)}</select></label>
      {destination && <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Desde *<input required type="date" className={`${fieldClass} block w-full mt-1`} value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-xs font-bold">Hasta estimada<input type="date" min={start} className={`${fieldClass} block w-full mt-1`} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
      <p className="text-xs text-slate-500">Cambia la asignación actual. Para planificar una asignación futura, utiliza Reservas.</p>
      {conflicts.length>0 && <p role="alert" className="rounded-lg bg-amber-50 text-amber-900 p-3 text-xs">Reservas coincidentes: {conflicts.map(r=>`${equipment.find(e=>String(e.id)===String(r.equipo_id))?.patente} (${dateLabel(r.fecha_inicio)} a ${dateLabel(r.fecha_fin)})`).join(', ')}.</p>}
      {rentalConflicts.length>0 && <p role="alert" className="text-xs text-red-700">Hay arriendos activos que coinciden con este período.</p>}
      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{message}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setTargets([])} className="border rounded-xl px-4 py-2 text-sm">Cancelar</button><button disabled={busy || rentalConflicts.length>0} className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40">{busy?'Guardando…':'Confirmar asignación'}</button></div>
    </form></div>}
  </section>;
}
