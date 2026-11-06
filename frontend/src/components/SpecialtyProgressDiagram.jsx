import React, {useEffect, useMemo, useState} from 'react';
import {supabase} from '../supabaseClient';
import {specialtyProgress} from '../utils/specialtyProgress.mjs';

export default function SpecialtyProgressDiagram({workId, parts, cutoff}) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    let active = true;
    setState(null); setError(''); setSelectedId(null);
    supabase.rpc('specialty_progress_state', {p_work: workId}).then(({data, error: failure}) => {
      if (!active) return;
      if (failure) setError('No se pudo consultar el esquema de pilas.');
      else setState(data);
    }).catch(() => {if (active) setError('No se pudo consultar el esquema de pilas.');});
    return () => {active = false;};
  }, [workId]);
  const points = useMemo(() => specialtyProgress(state || {}, parts.map(p => p.id), cutoff), [state, parts, cutoff]);
  const selected = points.find(p => p.id === selectedId);
  const done = points.filter(p => p.status === 'done').length;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
    <h3 className="font-bold text-slate-900">Esquema de pilas · Avance por especialidad</h3>
    <p className="text-sm text-slate-500">Coordenadas del proyecto · Corte: {cutoff.split('-').reverse().join('-')}. Selecciona una pila para consultar su detalle.</p>
    {error ? <p role="alert">{error}</p> : !state ? <p role="status">Cargando esquema…</p> : !points.length ? <p>No hay pilas con coordenadas en las partidas seleccionadas.</p> : <>
      <p className="text-sm"><span className="text-emerald-700">● Ejecutadas: {done}</span> · <span className="text-slate-600">○ Pendientes: {points.length - done}</span></p>
      <svg viewBox="0 0 600 400" className="w-full max-h-[560px] rounded-xl border border-slate-100 bg-slate-50" aria-label="Plano de pilas ejecutadas y pendientes">
        {points.map(p => <g key={p.id} role="button" tabIndex={0} aria-label={`Pila ${p.numero}, etapa ${p.etapa}, ${p.status === 'done' ? 'ejecutada' : 'pendiente'}`} onClick={() => setSelectedId(p.id)} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); setSelectedId(p.id);}}} className="cursor-pointer">
          <title>{`Pila ${p.numero} · Etapa ${p.etapa}${p.completedOn ? ` · ${p.completedOn}` : ' · Pendiente'}`}</title>
          <circle cx={p.x} cy={p.y} r={selectedId === p.id ? 5 : 3} fill={p.status === 'done' ? '#047857' : '#cbd5e1'} stroke={selectedId === p.id ? '#172554' : '#64748b'} strokeWidth="0.6"/>
        </g>)}
      </svg>
      {selected && <div role="status" className="rounded-lg bg-indigo-50 p-3 text-sm">Pila <strong>{selected.numero}</strong> · {selected.etapa} · {parts.find(p => String(p.id) === String(selected.partida_id))?.partida}<br/>Norte: {selected.norte} · Este: {selected.este}<br/>{selected.completedOn ? `Ejecutada el ${selected.completedOn.split('-').reverse().join('-')}` : 'Pendiente a la fecha de corte'}</div>}
    </>}
  </section>;
}
