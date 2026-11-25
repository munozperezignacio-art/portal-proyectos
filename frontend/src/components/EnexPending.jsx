import React, {useEffect, useRef, useState} from 'react';
import {supabase} from '../supabaseClient';

export default function EnexPending({company}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState({});
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null); setError(''); setChoices({});
    async function load() {
      try {
        const {data: result, error: failure} = await supabase.rpc('enex_my_pending', {p_company: company});
        if (failure) throw failure;
        if (live) { setData(result); setNeedsRefresh(false); }
      } catch {
        if (live) setError('No se pudieron consultar tus pendientes. Comprueba tu conexión y pulsa Actualizar pendientes.');
      }
    }
    void load();
    return () => { live = false; };
  }, [company, revision]);

  async function save(id) {
    if (saving.current || needsRefresh) return;
    const center = Number(choices[id]);
    if (!Number.isSafeInteger(center) || !data?.centers.some(c => Number(c.id) === center)) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const {error: failure} = await supabase.rpc('enex_charge_center', {p_company: company, p_id: id, p_center: center});
      if (failure) throw failure;
      setData(current => ({...current, rows: current.rows.filter(r => r.id !== id)}));
    } catch (failure) {
      // A timeout may happen AFTER persistence. Do not automatically repeat it.
      setNeedsRefresh(true);
      setError(failure?.code === '23505'
        ? 'Esta carga ya tiene una asignación. Actualiza los pendientes; no se modificó la asignación existente.'
        : 'No se pudo confirmar la asignación. Pulsa Actualizar pendientes para comprobar si quedó guardada antes de volver a intentarlo.');
    } finally { saving.current = false; setBusy(false); }
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Combustibles · Mis pendientes</h2>
      <button type="button" disabled={busy} onClick={() => setRevision(n => n + 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-primary disabled:opacity-50">Actualizar pendientes</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</p>}
    {!data && !error && <p role="status">Cargando…</p>}
    {data?.rows.length === 0 && <p role="status">No tienes cargas pendientes.</p>}
    {data?.rows.map(r => <fieldset key={r.id} disabled={busy || needsRefresh} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <legend className="px-1 font-bold">{r.vehicle} · {r.portal}</legend>
      <p className="text-sm">{String(r.date).replace('T', ' ')} · Documento {r.document} · ${Number(r.amount).toLocaleString('es-CL')}</p>
      {r.station && <p className="text-sm text-slate-600">Estación: {r.station}{r.station_commune ? ` · ${r.station_commune}` : ''}</p>}
      <label className="block text-sm font-semibold">Centro de gestión
        <select value={choices[r.id] || ''} onChange={e => setChoices(current => ({...current, [r.id]: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">Seleccionar centro</option>
          {data.centers.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      </label>
      {data.centers.length === 0 && <p className="text-sm text-amber-800">No hay centros de gestión activos. Solicita a Administración que habilite el centro correspondiente.</p>}
      <button type="button" disabled={!choices[r.id]} onClick={() => save(r.id)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Guardar asignación</button>
    </fieldset>)}
  </section>;
}
