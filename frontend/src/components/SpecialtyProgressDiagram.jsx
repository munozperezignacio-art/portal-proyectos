import React, {useEffect, useMemo, useState} from 'react';
import {supabase} from '../supabaseClient';
import {specialtyProgress} from '../utils/specialtyProgress.mjs';

export default function SpecialtyProgressDiagram({workId, parts, cutoff}) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [chosenDay,setDay]=useState('');
  const day=chosenDay||cutoff;
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
  const points = useMemo(() => specialtyProgress(state || {}, parts.map(p => p.id), day), [state, parts, day]);
  const daily=points.filter(p=>p.completedOn===day);
  const selected = points.find(p => p.id === selectedId);
  const done = points.filter(p => p.status === 'done').length;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
    <h3 className="font-bold text-slate-900">Esquema de pilas · Avance por especialidad</h3>
    <label className="flex flex-wrap items-center gap-2 text-sm font-bold">Fecha del esquema<input type="date" value={day} onChange={e=>{setDay(e.target.value);setSelectedId(null);}} className="rounded-lg border border-slate-300 px-3 py-2"/></label>
    {error ? <p role="alert">{error}</p> : !state ? <p role="status">Cargando esquema…</p> : !points.length ? <p>No hay pilas con coordenadas en las partidas seleccionadas.</p> : <>
      <p className="text-sm"><span className="font-bold text-amber-800">🟡 Del día: {daily.length}</span> · <span className="text-blue-900">● Anteriores: {done-daily.length}</span> · <span className="text-blue-700">○ Pendientes: {points.length - done}</span></p>
      <p className="text-xs text-slate-600" role="status">{daily.length?'Pilas del día: '+daily.map(p=>p.numero).join(', '):'Sin pilas identificadas como terminadas en esta fecha.'}</p>
      <svg viewBox="0 0 600 400" className="w-full max-h-[560px] rounded-xl border border-slate-100 bg-slate-50" aria-label="Plano de pilas ejecutadas y pendientes">
        {points.map(p => <g key={p.id} role="button" tabIndex={0} aria-label={`Pila ${p.numero}, etapa ${p.etapa}, ${p.status === 'done' ? 'ejecutada' : 'pendiente'}`} onClick={() => setSelectedId(p.id)} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); setSelectedId(p.id);}}} className="cursor-pointer">
          <title>{`Pila ${p.numero} · Etapa ${p.etapa}${p.completedOn ? ` · ${p.completedOn}` : ' · Pendiente'}`}</title>
          <circle cx={p.x} cy={p.y} r={selectedId === p.id ? 5 : p.completedOn===day?4:3} fill={p.completedOn===day?'#facc15':p.status==='done'?'#243a80':'white'} stroke={p.completedOn===day?'#92400e':'#243a80'} strokeWidth="0.7"/>
        </g>)}
      </svg>
      {selected && <div role="status" className="rounded-lg bg-indigo-50 p-3 text-sm">Pila <strong>{selected.numero}</strong> · {selected.etapa} · {parts.find(p => String(p.id) === String(selected.partida_id))?.partida}<br/>Norte: {selected.norte} · Este: {selected.este}<br/>{selected.completedOn ? `Ejecutada el ${selected.completedOn.split('-').reverse().join('-')}` : 'Pendiente a la fecha de corte'}</div>}
    </>}
  </section>;
}
