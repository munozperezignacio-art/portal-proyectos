import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const normalise = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const matchesPartida = (a, b) => {
  const left = normalise(a); const right = normalise(b);
  return left && right && (left === right || left.includes(right) || right.includes(left));
};
const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const initialForm = () => ({ fecha_corte: new Date().toISOString().slice(0, 10), retencion_pct: '5', anticipo_descontado: '0', observaciones: '' });

export default function EstadosPagoObra({ user, obraNombre }) {
  const empresa = user?.empresa || null;
  const [partidas, setPartidas] = useState([]);
  const [avances, setAvances] = useState([]);
  const [rdis, setRdis] = useState([]);
  const [estados, setEstados] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!obraNombre) return;
    setLoading(true); setMessage('');
    try {
      const [partidasResult, avancesResult, rdiResult, estadosResult] = await Promise.all([
        supabase.from('partidas_obra').select('*').eq('obra_nombre', obraNombre),
        supabase.from('reportes_avance').select('*'),
        supabase.from('calidad_rdi').select('partida, cantidad, estado').eq('obra_nombre', obraNombre),
        supabase.from('estados_pago_obra').select('*').eq('empresa', empresa).eq('obra_nombre', obraNombre).order('numero', { ascending: false }),
      ]);
      if (partidasResult.error) throw partidasResult.error;
      if (avancesResult.error) throw avancesResult.error;
      if (rdiResult.error && !rdiResult.error.message?.includes('calidad_rdi')) throw rdiResult.error;
      if (estadosResult.error) throw estadosResult.error;
      setPartidas((partidasResult.data || []).filter(p => !['TITULO', 'GRUPO'].includes(p.unidad) && !p.es_titulo));
      setAvances((avancesResult.data || []).filter(r => String(r.obra_nombre || r.obra || '').trim() === obraNombre));
      setRdis(rdiResult.data || []);
      setEstados(estadosResult.data || []);
    } catch (error) {
      setMessage(error.message?.includes('estados_pago_obra') ? 'Falta habilitar Estados de Pago en Supabase. Ejecuta schema_estados_pago.sql y actualiza.' : `No fue posible cargar Estados de Pago: ${error.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [empresa, obraNombre]);

  const valuation = useMemo(() => partidas.map(partida => {
    const quantity = Number(partida.cantidad_presupuestada ?? partida.cantidad ?? 0);
    const unitPrice = Number(partida.costo_por_dia) || Number(partida.pu) || 0;
    const reported = avances.filter(report => matchesPartida(report.partida, partida.partida))
      .filter(report => (report.fecha || report.fecha_avance || String(report.created_at || '').slice(0, 10)) <= form.fecha_corte)
      .reduce((sum, report) => sum + Number(report.cantidad || 0), 0);
    const approvedRdi = rdis.filter(rdi => matchesPartida(rdi.partida, partida.partida) && ['Aprobada', 'Cerrada'].includes(rdi.estado))
      .reduce((sum, rdi) => sum + Number(rdi.cantidad || 0), 0);
    const executed = Math.min(quantity, reported);
    const amount = Math.round(executed * unitPrice);
    return { partida: partida.partida, unidad: partida.unidad, quantity, unitPrice, executed, amount, approvedRdi, requiresReview: approvedRdi > 0 && approvedRdi < executed };
  }).filter(line => line.amount > 0), [partidas, avances, rdis, form.fecha_corte]);

  const gross = valuation.reduce((sum, line) => sum + line.amount, 0);
  const retention = Math.round(gross * (Number(form.retencion_pct) || 0) / 100);
  const advanceDeduction = Number(form.anticipo_descontado) || 0;
  const net = Math.max(0, gross - retention - advanceDeduction);
  const reviewCount = valuation.filter(line => line.requiresReview).length;

  const createPayment = async () => {
    if (!valuation.length) { setMessage('No hay avance valorizable al corte seleccionado.'); return; }
    try {
      const number = Math.max(0, ...estados.map(item => Number(item.numero) || 0)) + 1;
      const payload = {
        empresa, obra_nombre: obraNombre, numero: number, fecha_corte: form.fecha_corte,
        monto_bruto: gross, retencion_pct: Number(form.retencion_pct) || 0, retencion_monto: retention,
        anticipo_descontado: advanceDeduction, monto_neto: net, observaciones: form.observaciones || null,
        estado: 'Borrador', items: valuation,
      };
      const { error } = await supabase.from('estados_pago_obra').insert(payload);
      if (error) throw error;
      setMessage(`Estado de Pago N° ${number} creado como borrador.`);
      setForm(initialForm());
      await load();
    } catch (error) { setMessage(`No se pudo crear el estado de pago: ${error.message}`); }
  };

  const changeStatus = async (id, estado) => {
    const { error } = await supabase.from('estados_pago_obra').update({ estado }).eq('id', id);
    if (error) { setMessage(`No se pudo actualizar el estado: ${error.message}`); return; }
    await load();
  };

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none';
  return <div className="space-y-5 animate-in fade-in duration-200">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><BadgeDollarSign className="h-6 w-6 text-emerald-700" /><h2 className="text-xl font-black text-slate-900">Estados de Pago</h2></div><p className="mt-1 text-xs text-slate-500">Valorización contractual basada en el avance acumulado de esta obra, con retención y trazabilidad de revisión.</p></div>
      <button onClick={load} className="flex w-fit items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button>
    </header>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{message}</div>}
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><FileText className="h-4 w-4 text-emerald-700" />Nuevo estado de pago</h3>
        <label className="block text-[11px] font-bold text-slate-600">Fecha de corte<input type="date" value={form.fecha_corte} onChange={event => setForm({ ...form, fecha_corte: event.target.value })} className={`${input} mt-1`} /></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-600">Retención (%)<input type="number" min="0" max="100" step="0.1" value={form.retencion_pct} onChange={event => setForm({ ...form, retencion_pct: event.target.value })} className={`${input} mt-1`} /></label><label className="text-[11px] font-bold text-slate-600">Descuento anticipo<input type="number" min="0" value={form.anticipo_descontado} onChange={event => setForm({ ...form, anticipo_descontado: event.target.value })} className={`${input} mt-1`} /></label></div>
        <textarea rows={3} placeholder="Observaciones del estado de pago" value={form.observaciones} onChange={event => setForm({ ...form, observaciones: event.target.value })} className={input} />
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-xs"><div className="flex justify-between"><span>Avance valorizado</span><b>{money(gross)}</b></div><div className="flex justify-between"><span>Retención</span><b>- {money(retention)}</b></div><div className="flex justify-between"><span>Anticipo</span><b>- {money(advanceDeduction)}</b></div><div className="flex justify-between border-t border-emerald-200 pt-2 text-sm"><span>Neto a cobrar</span><b>{money(net)}</b></div></div>
        {reviewCount > 0 && <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">{reviewCount} partida(s) tienen avance superior al volumen con RDI aprobado. Revísalas antes de enviar.</p>}
        <button onClick={createPayment} disabled={loading} className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white disabled:opacity-50">Crear borrador de estado de pago</button>
      </section>
      <section className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-black text-slate-800">Valorización al corte</h3><p className="text-[11px] text-slate-500">Solo se incluyen partidas con avance registrado.</p></div>{loading ? <div className="p-10 text-center text-sm text-slate-500">Calculando valorización…</div> : valuation.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Partida</th><th className="p-3 text-right">Avance</th><th className="p-3 text-right">Monto</th><th className="p-3">Calidad</th></tr></thead><tbody>{valuation.map(line => <tr key={line.partida} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-700">{line.partida}</td><td className="p-3 text-right">{line.executed} / {line.quantity} {line.unidad}</td><td className="p-3 text-right font-black text-emerald-700">{money(line.amount)}</td><td className="p-3">{line.requiresReview ? <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Revisar RDI</span> : <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Conforme</span>}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">No hay avance valorizable para la fecha seleccionada.</div>}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-sm font-black text-slate-800">Historial contractual</h3>{estados.length ? <div className="space-y-2">{estados.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-black text-slate-800">Estado de Pago N° {item.numero}</p><p className="text-[11px] text-slate-500">Corte {item.fecha_corte} · Neto {money(item.monto_neto)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">{item.estado}</span>{item.estado === 'Borrador' && <button onClick={() => changeStatus(item.id, 'En revisión')} className="text-[11px] font-black text-blue-700">Enviar a revisión</button>}{item.estado === 'En revisión' && <button onClick={() => changeStatus(item.id, 'Aprobado')} className="flex items-center gap-1 text-[11px] font-black text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Aprobar</button>}</div></div>)}</div> : <p className="text-xs text-slate-500">Aún no existen estados de pago para esta obra.</p>}</div>
      </section>
    </div>
  </div>;
}
