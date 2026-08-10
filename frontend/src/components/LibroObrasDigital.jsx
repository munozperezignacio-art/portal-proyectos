import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Mail, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { registrarEventoBitacora } from '../utils/bitacoraService';

const initialEntry = { tipo: 'Registro diario', fecha: new Date().toISOString().slice(0, 10), asunto: '', detalle: '', emisor: '', destinatario: '', partida: '' };
const types = ['Registro diario', 'Instrucción', 'Observación', 'Acuerdo', 'Incidente'];
const statusStyle = { Abierto: 'bg-amber-100 text-amber-800', Respondido: 'bg-blue-100 text-blue-800', Cerrado: 'bg-emerald-100 text-emerald-800' };

export default function LibroObrasDigital({ user, obraNombre, obra }) {
  const [entries, setEntries] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [form, setForm] = useState(initialEntry);
  const [filter, setFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const empresa = user?.empresa || null;

  const load = async () => {
    if (!obraNombre) return;
    setLoading(true); setMessage('');
    try {
      const [entriesResult, partidasResult] = await Promise.all([
        supabase.from('libro_obra_digital').select('*').eq('empresa', empresa).eq('obra_nombre', obraNombre).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('partidas_obra').select('partida, unidad').eq('obra_nombre', obraNombre),
      ]);
      if (entriesResult.error) throw entriesResult.error;
      if (partidasResult.error) throw partidasResult.error;
      setEntries(entriesResult.data || []);
      setPartidas((partidasResult.data || []).filter(p => !['TITULO', 'GRUPO'].includes(p.unidad)));
    } catch (error) {
      setMessage(error.message?.includes('libro_obra_digital') ? 'Falta habilitar Libro de Obras en Supabase. Ejecuta schema_libro_obras.sql y actualiza.' : `No fue posible cargar el Libro de Obras: ${error.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [empresa, obraNombre]);

  const visibleEntries = useMemo(() => filter === 'Todos' ? entries : entries.filter(entry => entry.tipo === filter), [entries, filter]);
  const pending = entries.filter(entry => entry.estado !== 'Cerrado').length;
  const clientName = obra?.cliente || '';
  const clientEmail = obra?.cliente_email || '';
  const clientPhone = obra?.cliente_telefono || '';
  const useClientAsRecipient = () => {
    if (!clientName && !clientEmail) return;
    setForm(current => ({ ...current, destinatario: clientEmail ? `${clientName || 'Mandante'} <${clientEmail}>` : clientName }));
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    try {
      const folio = `LO-${new Date().getFullYear()}-${String(entries.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('libro_obra_digital').insert({
        empresa, obra_nombre: obraNombre, folio, estado: 'Abierto', ...form,
      });
      if (error) throw error;
      setForm({ ...initialEntry, fecha: new Date().toISOString().slice(0, 10) });
      setMessage(`${folio} registrado en el Libro de Obras.`);
      await load();
    } catch (error) { setMessage(`No se pudo registrar el folio: ${error.message}`); }
  };

  const closeEntry = async (id) => {
    try {
      const { error } = await supabase.from('libro_obra_digital').update({ estado: 'Cerrado', fecha_cierre: new Date().toISOString().slice(0, 10) }).eq('id', id);
      if (error) throw error;
      const entry = entries.find(item => item.id === id);
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Libro de Obra', accion: `${entry?.folio || 'Folio'} cerrado`, detalle: entry?.asunto || 'Cierre de registro del Libro de Obra.', actor: user?.nombre || user?.email || 'Usuario autorizado' });
      await load();
    } catch (error) { setMessage(`No se pudo cerrar el folio: ${error.message}`); }
  };

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none';
  return <div className="space-y-5 animate-in fade-in duration-200">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><BookOpenCheck className="h-6 w-6 text-blue-800" /><h2 className="text-xl font-black text-slate-900">Libro de Obras Digital</h2></div><p className="mt-1 text-xs text-slate-500">Folios formales de la obra: registro diario, instrucciones, acuerdos y observaciones trazables.</p></div>
      <button onClick={load} className="flex w-fit items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button>
    </div>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{message}</div>}
    {(clientName || clientEmail || clientPhone) && <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-1.5 text-xs font-black text-blue-950"><Mail className="h-3.5 w-3.5" />Contacto del mandante</p><p className="mt-1 text-xs text-blue-900">{clientName || 'Mandante'}{clientEmail ? ` · ${clientEmail}` : ''}{clientPhone ? ` · ${clientPhone}` : ''}</p></div><button type="button" onClick={useClientAsRecipient} className="w-fit rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-black text-blue-900">Usar como destinatario</button></div>}
    <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
      <form onSubmit={saveEntry} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><MessageSquarePlus className="h-4 w-4 text-blue-800" />Nuevo folio</h3>
        <div className="grid grid-cols-2 gap-2"><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={input}>{types.map(type => <option key={type}>{type}</option>)}</select><input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className={input} /></div>
        <input required placeholder="Asunto o materia" value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })} className={input} />
        <textarea required rows={5} placeholder="Detalle del registro, instrucción, acuerdo u observación" value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} className={input} />
        <input required placeholder="Emitido por" value={form.emisor} onChange={e => setForm({ ...form, emisor: e.target.value })} className={input} />
        <input placeholder="Dirigido a (opcional)" value={form.destinatario} onChange={e => setForm({ ...form, destinatario: e.target.value })} className={input} />
        <select value={form.partida} onChange={e => setForm({ ...form, partida: e.target.value })} className={input}><option value="">Partida relacionada (opcional)</option>{partidas.map(p => <option key={p.partida} value={p.partida}>{p.partida}</option>)}</select>
        <button className="w-full rounded-xl bg-blue-900 py-2.5 text-xs font-black text-white">Registrar en Libro de Obras</button>
      </form>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4"><div><p className="text-xs font-black text-slate-800">{entries.length} folios registrados</p><p className="text-[11px] text-slate-500">{pending} pendientes de cierre</p></div><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><option>Todos</option>{types.map(type => <option key={type}>{type}</option>)}</select></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando folios…</div> : visibleEntries.length ? visibleEntries.map(entry => <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-black text-blue-900">{entry.folio}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">{entry.tipo}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusStyle[entry.estado] || statusStyle.Abierto}`}>{entry.estado}</span></div><h3 className="mt-2 text-sm font-black text-slate-800">{entry.asunto}</h3></div><p className="text-xs font-bold text-slate-500">{entry.fecha}</p></div><p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-700">{entry.detalle}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span>Emite: <b>{entry.emisor}</b>{entry.destinatario ? ` · Dirigido a: ${entry.destinatario}` : ''}{entry.partida ? ` · Partida: ${entry.partida}` : ''}</span>{entry.estado !== 'Cerrado' && <button onClick={() => closeEntry(entry.id)} className="flex items-center gap-1 font-black text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Cerrar folio</button>}</div></article>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">Aún no existen folios en el Libro de Obras de esta obra.</div>}
      </section>
    </div>
  </div>;
}
