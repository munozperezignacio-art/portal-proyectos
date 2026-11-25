import { useState } from 'react';
import { FileText, ClipboardList, ClipboardCheck, Wrench, ArrowLeft } from 'lucide-react';
import { normalizeRut } from '../../../supabase/functions/_shared/equipmentQr.mjs';

const actions = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'reporte', label: 'Realizar reporte', icon: ClipboardList },
  { id: 'checklist', label: 'Realizar checklist', icon: ClipboardCheck },
  { id: 'mantenimiento', label: 'Registrar mantenimiento', icon: Wrench },
];

/** Identity is supplied by the server, never assembled from an editable name. */
export default function EquipmentQrPortal({ equipment, identify, openAction, children }) {
  const [rut, setRut] = useState('');
  const [identity, setIdentity] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function enter(event) {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizeRut(rut);
    if (!normalized) { setError('Revisa el RUT y su dígito verificador.'); return; }
    setBusy(true); setError('');
    try {
      const result = await identify(normalized);
      if (!result?.nombre || !result?.session) throw new Error('No se pudo validar el RUT para este equipo.');
      setIdentity(result);
    } catch (failure) {
      setError(failure.message || 'No se pudo comprobar el RUT. Intenta nuevamente.');
    } finally { setBusy(false); }
  }
  async function choose(id) {
    if (busy || !identity) return;
    setBusy(true); setError('');
    try { await openAction(id, identity.session); setSelected(id); }
    catch (failure) { setError(failure.message || 'No se pudo abrir esta opción.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="equipment-qr-layout mx-auto max-w-2xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{equipment.empresa}</p>
        <h1 className="mt-2 text-2xl font-bold">{equipment.patente}</h1>
        <p className="mt-1 font-medium">{equipment.tipo}</p>
        <p className="mt-1 text-sm text-slate-600">{equipment.obra_nombre || 'Bodega / sin asignar'}</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      {!identity ? <form onSubmit={enter} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Identifícate para continuar</h2>
        <label className="block text-sm font-semibold" htmlFor="equipment-qr-rut">Tu RUT</label>
        <input id="equipment-qr-rut" autoComplete="off" autoCapitalize="characters" maxLength={16} required disabled={busy} value={rut} onChange={event => setRut(event.target.value)} placeholder="12.345.678-5" className="w-full rounded-xl border-2 border-slate-300 bg-white p-3 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        <p className="text-sm text-slate-600">Usaremos el nombre y cargo de tu ficha de personal o de operador externo autorizado para este equipo. No necesitas una cuenta de Obraxis.</p>
        <button disabled={busy} className="w-full rounded-xl bg-indigo-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Comprobando…' : 'Continuar'}</button>
      </form> : <>
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Persona que registra">
          <p className="font-semibold">{identity.nombre}</p><p className="text-sm">{identity.cargo || 'Cargo no registrado'}</p>
          {identity.externo&&<p className="text-sm">Operador externo · {identity.proveedor}</p>}
          <p className="mt-2 text-xs text-slate-600">RUT coincidente con una ficha habilitada. Identidad declarada, no autenticada.</p>
          {!selected && <button disabled={busy} onClick={() => { setIdentity(null); setRut(''); setError(''); }} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Cambiar persona</button>}
        </section>
        {selected ? <>
          <button disabled={busy} onClick={() => setSelected(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold"><ArrowLeft size={18} aria-hidden="true" />Volver al equipo</button>
          {typeof children === 'function' ? children(selected, identity) : children}
        </> : <nav aria-label="Acciones del equipo" className="grid grid-cols-2 gap-3">
          {actions.map(({id, label, icon: Icon}) => <button key={id} disabled={busy} onClick={() => choose(id)} className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center font-semibold shadow-sm hover:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 disabled:opacity-50"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-800"><Icon size={26} aria-hidden="true" /></span>{label}</button>)}
        </nav>}
      </>}
    </div>
  </main>;
}
