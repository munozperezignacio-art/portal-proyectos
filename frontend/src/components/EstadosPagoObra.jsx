import React, { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Copy, FileText, RefreshCw, Send, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { canModifyOrDeleteRecords } from '../utils/userLevel';

const normalise = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const matchesPartida = (a, b) => {
  const left = normalise(a); const right = normalise(b);
  return left && right && (left === right || left.includes(right) || right.includes(left));
};
const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const percent = (value) => `${Number(value || 0).toFixed(2)}%`;
const initialForm = () => ({ fecha_corte: new Date().toISOString().slice(0, 10), retencion_pct: '5', observaciones: '' });
const token = () => `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const accessCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};
const hashAccessCode = async (value) => {
  const bytes = new TextEncoder().encode(String(value || '').trim().toUpperCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export default function EstadosPagoObra({ user, obraNombre, obra }) {
  const empresa = user?.empresa || null;
  const [partidas, setPartidas] = useState([]);
  const [avances, setAvances] = useState([]);
  const [rdis, setRdis] = useState([]);
  const [estados, setEstados] = useState([]);
  const [condiciones, setCondiciones] = useState(null);
  const [anticipoPct, setAnticipoPct] = useState('0');
  const [contactos, setContactos] = useState({ revisor_nombre: '', revisor_email: '', aprobador_nombre: '', aprobador_email: '' });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [visibleAccessCodes, setVisibleAccessCodes] = useState({});
  const [reviewingPayment, setReviewingPayment] = useState(null);
  const [reviewItems, setReviewItems] = useState([]);
  const canPreparePayment = canModifyOrDeleteRecords(user);
  const clientName = obra?.cliente || '';
  const clientEmail = obra?.cliente_email || '';
  const clientPhone = obra?.cliente_telefono || '';
  const applyClientContacts = () => setContactos(current => ({
    ...current,
    revisor_nombre: current.revisor_nombre || obra?.admin_contrato || clientName,
    revisor_email: current.revisor_email || clientEmail,
    aprobador_nombre: current.aprobador_nombre || clientName,
    aprobador_email: current.aprobador_email || clientEmail,
  }));

  const load = async () => {
    if (!obraNombre) return;
    setLoading(true); setMessage('');
    try {
      const [partidasResult, avancesResult, rdiResult, estadosResult, condicionesResult] = await Promise.all([
        supabase.from('partidas_obra').select('*').eq('obra_nombre', obraNombre),
        // La tabla vigente de reportes por partida; `reportes_avance` fue una tabla heredada.
        supabase.from('avances_produccion_partidas').select('*'),
        supabase.from('calidad_rdi').select('partida, cantidad, estado').eq('obra_nombre', obraNombre),
        supabase.from('estados_pago_obra').select('*').eq('empresa', empresa).eq('obra_nombre', obraNombre).order('numero', { ascending: false }),
        supabase.from('condiciones_pago_obra').select('*').eq('empresa', empresa).eq('obra_nombre', obraNombre).maybeSingle(),
      ]);
      if (partidasResult.error) throw partidasResult.error;
      if (avancesResult.error) throw avancesResult.error;
      if (rdiResult.error && !rdiResult.error.message?.includes('calidad_rdi')) throw rdiResult.error;
      if (estadosResult.error) throw estadosResult.error;
      if (condicionesResult.error) throw condicionesResult.error;
      setPartidas((partidasResult.data || []).filter(p => !['TITULO', 'GRUPO'].includes(p.unidad) && !p.es_titulo));
      setAvances((avancesResult.data || []).filter(r => String(r.obra_nombre || r.obra || '').trim() === obraNombre));
      setRdis(rdiResult.data || []);
      setEstados(estadosResult.data || []);
      setCondiciones(condicionesResult.data || null);
      setAnticipoPct(String(condicionesResult.data?.anticipo_pct || 0));
      setContactos({ revisor_nombre: condicionesResult.data?.revisor_nombre || '', revisor_email: condicionesResult.data?.revisor_email || '', aprobador_nombre: condicionesResult.data?.aprobador_nombre || '', aprobador_email: condicionesResult.data?.aprobador_email || '' });
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
    const accumulatedAmount = Math.round(executed * unitPrice);
    const alreadyValuated = Math.max(0, ...estados.filter(item => item.estado !== 'Rechazado').map(item => (item.items || []).filter(row => matchesPartida(row.partida, partida.partida)).reduce((max, row) => Math.max(max, Number(row.monto_acumulado ?? row.amount ?? 0)), 0)));
    const amount = Math.max(0, accumulatedAmount - alreadyValuated);
    return { partida: partida.partida, unidad: partida.unidad, quantity, unitPrice, executed, amount, monto_anterior: alreadyValuated, monto_acumulado: accumulatedAmount, avance_pct: quantity > 0 ? (executed / quantity) * 100 : 0, approvedRdi, requiresReview: approvedRdi > 0 && approvedRdi < executed };
  }).filter(line => line.executed > 0 || line.monto_anterior > 0), [partidas, avances, rdis, estados, form.fecha_corte]);

  const periodValuation = valuation.filter(line => line.amount > 0);
  const gross = periodValuation.reduce((sum, line) => sum + line.amount, 0);
  const contractAmount = partidas.reduce((sum, partida) => sum + (Number(partida.cantidad_presupuestada ?? partida.cantidad ?? 0) * (Number(partida.costo_por_dia) || Number(partida.pu) || 0)), 0);
  const advanceRate = Math.max(0, Math.min(100, Number(condiciones?.anticipo_pct || 0)));
  const contractAdvance = Math.round(contractAmount * advanceRate / 100);
  const priorStates = estados.filter(item => item.estado !== 'Rechazado');
  const priorGross = priorStates.reduce((sum, item) => sum + Number(item.monto_bruto || 0), 0);
  const priorRetention = priorStates.reduce((sum, item) => sum + Number(item.retencion_monto || 0), 0);
  const recoveredAdvance = priorStates.reduce((sum, item) => sum + Number(item.anticipo_descontado || 0), 0);
  const priorNet = priorStates.reduce((sum, item) => sum + Number(item.monto_neto || 0), 0);
  const advanceAvailable = Math.max(0, contractAdvance - recoveredAdvance);
  const retention = Math.round(gross * (Number(form.retencion_pct) || 0) / 100);
  // Se recupera del anticipo el mismo porcentaje que representa el avance neto de este EP dentro del contrato.
  const netProgressBeforeAdvance = Math.max(0, gross - retention);
  const paymentProgressPct = contractAmount > 0 ? (netProgressBeforeAdvance / contractAmount) * 100 : 0;
  const automaticAdvanceDeduction = Math.min(advanceAvailable, Math.round(contractAdvance * paymentProgressPct / 100));
  const advanceDeduction = automaticAdvanceDeduction;
  const net = Math.max(0, gross - retention - advanceDeduction);
  const accumulatedGross = priorGross + gross;
  const accumulatedRetention = priorRetention + retention;
  const accumulatedAdvance = recoveredAdvance + advanceDeduction;
  const accumulatedNet = priorNet + net;
  const reviewCount = periodValuation.filter(line => line.requiresReview).length;
  const paymentSummary = {
    monto_contrato: contractAmount, bruto_anterior: priorGross, bruto_periodo: gross, bruto_acumulado: accumulatedGross,
    retencion_anterior: priorRetention, retencion_periodo: retention, retencion_acumulada: accumulatedRetention,
    anticipo_contrato: contractAdvance, anticipo_anterior: recoveredAdvance, anticipo_periodo: advanceDeduction, anticipo_acumulado: accumulatedAdvance,
    neto_anterior: priorNet, neto_periodo: net, neto_acumulado: accumulatedNet,
    avance_periodo_pct: contractAmount > 0 ? (gross / contractAmount) * 100 : 0,
    avance_acumulado_pct: contractAmount > 0 ? (accumulatedGross / contractAmount) * 100 : 0,
  };

  const createPayment = async () => {
    if (!canPreparePayment) { setMessage('Tu perfil no está autorizado para preparar estados de pago.'); return; }
    if (!periodValuation.length) { setMessage('No hay avance valorizable al corte seleccionado.'); return; }
    try {
      const number = Math.max(0, ...estados.map(item => Number(item.numero) || 0)) + 1;
      const payload = {
        empresa, obra_nombre: obraNombre, numero: number, fecha_corte: form.fecha_corte,
        monto_bruto: gross, retencion_pct: Number(form.retencion_pct) || 0, retencion_monto: retention,
        anticipo_descontado: advanceDeduction, monto_neto: net, observaciones: form.observaciones || null,
        estado: 'Borrador', items: periodValuation, preparado_por: user?.nombre || user?.email || 'Usuario autorizado',
        revisor_nombre: contactos.revisor_nombre || null, revisor_email: contactos.revisor_email || null, aprobador_nombre: contactos.aprobador_nombre || null, aprobador_email: contactos.aprobador_email || null,
        token_revision: token(), token_aprobacion: token(),
      };
      const { error } = await supabase.from('estados_pago_obra').insert(payload);
      if (error) throw error;
      setMessage(`Estado de Pago N° ${number} creado como borrador.`);
      setForm(initialForm());
      await load();
    } catch (error) { setMessage(`No se pudo crear el estado de pago: ${error.message}`); }
  };

  const saveConditions = async () => {
    try {
      const payload = { empresa, obra_nombre: obraNombre, anticipo_pct: Math.max(0, Math.min(100, Number(anticipoPct) || 0)), ...contactos };
      const { error } = await supabase.from('condiciones_pago_obra').upsert(payload, { onConflict: 'empresa,obra_nombre' });
      if (error) throw error;
      setMessage('Condiciones de anticipo guardadas. La amortización se calculará automáticamente en cada estado de pago.');
      await load();
    } catch (error) { setMessage(`No se pudieron guardar las condiciones: ${error.message}`); }
  };

  const publicUrl = (item, type) => `${window.location.origin}/?estado_pago=${type === 'revision' ? item.token_revision : item.token_aprobacion}&rol_ep=${type}`;
  const copyLink = async (item, type) => { await navigator.clipboard.writeText(publicUrl(item, type)); setMessage(`Enlace de ${type} copiado.`); };
  const copyAccessCode = async (code) => { await navigator.clipboard.writeText(code); setMessage('Clave de acceso copiada.'); };
  const sendExternal = async (item, type) => {
    if (!canPreparePayment) { setMessage('Tu perfil no está autorizado para enviar estados de pago.'); return; }
    const email = type === 'revision' ? item.revisor_email : item.aprobador_email;
    const name = type === 'revision' ? item.revisor_nombre : item.aprobador_nombre;
    if (!email) { setMessage(`Configura el correo del ${type === 'revision' ? 'revisor' : 'aprobador'} contractual.`); return; }
    const link = publicUrl(item, type);
    const code = accessCode();
    const codeColumn = type === 'revision' ? 'clave_revision_hash' : 'clave_aprobacion_hash';
    const { error: codeError } = await supabase.from('estados_pago_obra').update({ [codeColumn]: await hashAccessCode(code) }).eq('id', item.id);
    if (codeError) { setMessage(`No se pudo generar la clave de acceso: ${codeError.message}`); return; }
    const result = await sendSystemEmail({ to: email, subject: `Estado de Pago N° ${item.numero} · ${obraNombre}`, htmlContent: `<p>Hola ${name || ''},</p><p>Se solicita ${type === 'revision' ? 'revisión técnica' : 'aprobación contractual'} del Estado de Pago N° ${item.numero} de <b>${obraNombre}</b>.</p><p><a href="${link}">Abrir Estado de Pago</a></p><p><b>Clave de acceso: ${code}</b></p><p>Por seguridad, necesitarás esta clave de 8 caracteres para ingresar al enlace.</p>` });
    if (!result.success) { setMessage(`No se pudo enviar el correo: ${result.error}`); return; }
    setVisibleAccessCodes(current => ({ ...current, [`${item.id}-${type}`]: code }));
    await changeStatus(item.id, type === 'revision' ? 'En revisión' : 'En aprobación');
    setMessage(`Enlace enviado a ${email}.`);
  };

  const changeStatus = async (id, estado) => {
    const { error } = await supabase.from('estados_pago_obra').update({ estado }).eq('id', id);
    if (error) { setMessage(`No se pudo actualizar el estado: ${error.message}`); return; }
    await load();
  };
  const deletePayment = async (item) => {
    if (!canPreparePayment) { setMessage('Tu perfil no está autorizado para eliminar estados de pago.'); return; }
    if (!window.confirm(`¿Eliminar definitivamente el Estado de Pago N° ${item.numero}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('estados_pago_obra').delete().eq('id', item.id);
    if (error) { setMessage(`No se pudo eliminar el Estado de Pago: ${error.message}`); return; }
    setMessage(`Estado de Pago N° ${item.numero} eliminado.`);
    await load();
  };
  const startReview = (item) => {
    setReviewingPayment(item);
    setReviewItems((item.items || []).map(line => ({ ...line, cantidad_final: line.cantidad_propuesta ?? line.executed ?? 0 })));
  };
  const prepareForApproval = async () => {
    if (!reviewingPayment) return;
    const finalItems = reviewItems.map(line => {
      const quantity = Math.max(0, Math.min(Number(line.quantity || 0), Number(line.cantidad_final || 0)));
      const accumulated = Math.round(quantity * Number(line.unitPrice || 0));
      return { ...line, executed: quantity, monto_acumulado: accumulated, amount: Math.max(0, accumulated - Number(line.monto_anterior || 0)) };
    });
    const grossFinal = finalItems.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const retentionFinal = Math.round(grossFinal * Number(reviewingPayment.retencion_pct || 0) / 100);
    const previousRecovery = estados.filter(row => row.id !== reviewingPayment.id && row.estado !== 'Rechazado').reduce((sum, row) => sum + Number(row.anticipo_descontado || 0), 0);
    const advanceTotal = Math.round(contractAmount * Math.max(0, Number(condiciones?.anticipo_pct || 0)) / 100);
    const netBeforeAdvance = Math.max(0, grossFinal - retentionFinal);
    const advanceFinal = Math.min(Math.max(0, advanceTotal - previousRecovery), Math.round(advanceTotal * (contractAmount > 0 ? netBeforeAdvance / contractAmount : 0)));
    const { error } = await supabase.from('estados_pago_obra').update({ items: finalItems, monto_bruto: grossFinal, retencion_monto: retentionFinal, anticipo_descontado: advanceFinal, monto_neto: Math.max(0, grossFinal - retentionFinal - advanceFinal), estado: 'En aprobación' }).eq('id', reviewingPayment.id);
    if (error) { setMessage(`No se pudo preparar el Estado de Pago: ${error.message}`); return; }
    setReviewingPayment(null); setReviewItems([]); setMessage('Propuesta revisada y valorización actualizada. Ya puedes enviarla a aprobación.'); await load();
  };

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none';
  return <div className="space-y-5 animate-in fade-in duration-200">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><BadgeDollarSign className="h-6 w-6 text-emerald-700" /><h2 className="text-xl font-black text-slate-900">Estados de Pago</h2></div><p className="mt-1 text-xs text-slate-500">Valorización contractual basada en el avance acumulado de esta obra, con retención y trazabilidad de revisión.</p></div>
      <button onClick={load} className="flex w-fit items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button>
    </header>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{message}</div>}
    {(clientName || clientEmail || clientPhone) && <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-blue-950">Contacto contractual de la obra</p><p className="mt-1 text-xs text-blue-900">{clientName || 'Mandante'}{clientEmail ? ` · ${clientEmail}` : ''}{clientPhone ? ` · ${clientPhone}` : ''}</p></div><button type="button" onClick={applyClientContacts} className="w-fit rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-black text-blue-900">Usar en revisión y aprobación</button></div>}
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><FileText className="h-4 w-4 text-emerald-700" />Nuevo estado de pago</h3>
        <label className="block text-[11px] font-bold text-slate-600">Fecha de corte<input type="date" value={form.fecha_corte} onChange={event => setForm({ ...form, fecha_corte: event.target.value })} className={`${input} mt-1`} /></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-600">Retención (%)<input type="number" min="0" max="100" step="0.1" value={form.retencion_pct} onChange={event => setForm({ ...form, retencion_pct: event.target.value })} className={`${input} mt-1`} /></label><div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[10px] font-bold text-emerald-800">Descuento anticipo</p><p className="mt-1 text-xs font-black text-emerald-800">{money(advanceDeduction)}</p></div></div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2"><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-[11px] font-bold text-blue-900">Anticipo de contrato (%)<input type="number" min="0" max="100" step="0.1" value={anticipoPct} onChange={event => setAnticipoPct(event.target.value)} className={`${input} mt-1`} /></label><button onClick={saveConditions} type="button" className="rounded-lg bg-blue-800 px-3 py-2 text-[11px] font-black text-white">Guardar</button></div><div className="grid grid-cols-2 gap-2"><input placeholder="Nombre revisor externo" value={contactos.revisor_nombre} onChange={e => setContactos({...contactos,revisor_nombre:e.target.value})} className={input}/><input type="email" placeholder="Correo revisor" value={contactos.revisor_email} onChange={e => setContactos({...contactos,revisor_email:e.target.value})} className={input}/><input placeholder="Nombre aprobador externo" value={contactos.aprobador_nombre} onChange={e => setContactos({...contactos,aprobador_nombre:e.target.value})} className={input}/><input type="email" placeholder="Correo aprobador" value={contactos.aprobador_email} onChange={e => setContactos({...contactos,aprobador_email:e.target.value})} className={input}/></div><p className="text-[10px] text-blue-800">Anticipo contractual: {money(contractAdvance)} · Pendiente: {money(advanceAvailable)}. Este EP representa {paymentProgressPct.toFixed(2)}% de avance neto; se recupera esa misma proporción del anticipo.</p></div>
        <textarea rows={3} placeholder="Observaciones del estado de pago" value={form.observaciones} onChange={event => setForm({ ...form, observaciones: event.target.value })} className={input} />
        {reviewCount > 0 && <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">{reviewCount} partida(s) tienen avance superior al volumen con RDI aprobado. Revísalas antes de enviar.</p>}
        <button onClick={createPayment} disabled={loading || !canPreparePayment} className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white disabled:opacity-50">Crear borrador de estado de pago</button>{!canPreparePayment && <p className="text-[10px] font-semibold text-amber-700">Solo un perfil autorizado puede preparar y enviar estados de pago.</p>}
      </section>
      <section className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-black text-slate-800">Valorización al corte</h3><p className="text-[11px] text-slate-500">Detalle tipo estado de pago: anterior, período y acumulado por partida.</p></div>{loading ? <div className="p-10 text-center text-sm text-slate-500">Calculando valorización…</div> : valuation.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Partida</th><th className="p-3 text-right">Cantidad contratada</th><th className="p-3 text-right">P.U. contratado</th><th className="p-3 text-right">Avance acum.</th><th className="p-3 text-right">Anterior</th><th className="p-3 text-right">Este EP</th><th className="p-3 text-right">Acumulado</th><th className="p-3">Calidad</th></tr></thead><tbody>{valuation.map(line => <tr key={line.partida} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-700">{line.partida}</td><td className="p-3 text-right">{line.quantity} {line.unidad}</td><td className="p-3 text-right">{money(line.unitPrice)}</td><td className="p-3 text-right">{line.executed} {line.unidad}<small className="block text-slate-500">{percent(line.avance_pct)}</small></td><td className="p-3 text-right text-slate-500">{money(line.monto_anterior)}</td><td className="p-3 text-right font-black text-emerald-700">{money(line.amount)}</td><td className="p-3 text-right font-bold">{money(line.monto_acumulado)}</td><td className="p-3">{line.requiresReview ? <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Revisar RDI</span> : <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Conforme</span>}</td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">No hay avance valorizable para la fecha seleccionada.</div>}</div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs"><h3 className="mb-3 text-sm font-black text-emerald-950">Liquidación del Estado de Pago</h3><div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2"><span>Avance acumulado a la fecha ({percent(paymentSummary.avance_acumulado_pct)})</span><b>{money(accumulatedGross)}</b><span>(-) Avance liquidado en EP anteriores</span><b>- {money(priorGross)}</b><span className="border-t border-emerald-200 pt-2 font-black">(=) Avance de este período ({percent(paymentSummary.avance_periodo_pct)})</span><b className="border-t border-emerald-200 pt-2">{money(gross)}</b><span>(-) Retención del período ({form.retencion_pct}%)</span><b>- {money(retention)}</b><span>(-) Amortización de anticipo del período</span><b>- {money(advanceDeduction)}</b><span className="border-t border-emerald-300 pt-2 text-sm font-black">Neto a cobrar en este EP</span><b className="border-t border-emerald-300 pt-2 text-sm font-black">{money(net)}</b></div><p className="mt-3 text-[10px] text-emerald-900">Acumulado contractual: retención {money(accumulatedRetention)} · anticipo amortizado {money(accumulatedAdvance)} · neto pagado {money(accumulatedNet)}.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-black text-slate-800">Historial contractual</h3>
          {estados.length ? <div className="space-y-2">{estados.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black text-slate-800">Estado de Pago N° {item.numero}</p><p className="text-[11px] text-slate-500">Corte {item.fecha_corte} · Neto {money(item.monto_neto)}</p></div>
              <div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">{item.estado}</span>{canPreparePayment && <button type="button" onClick={() => deletePayment(item)} title="Eliminar Estado de Pago" className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
            </div>
            {item.estado === 'Observado' && (item.items || []).some(line => line.comentario_externo || Number(line.cantidad_propuesta) !== Number(line.executed)) && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900"><b>Propuesta externa por partidas</b>{(item.items || []).filter(line => line.comentario_externo || Number(line.cantidad_propuesta) !== Number(line.executed)).map((line, index) => <p key={index} className="mt-1">{line.partida}: propone {line.cantidad_propuesta} {line.unidad} (emitido: {line.executed} {line.unidad}){line.comentario_externo ? ` · ${line.comentario_externo}` : ''}</p>)}{canPreparePayment && <button type="button" onClick={() => startReview(item)} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-[11px] font-black text-white">Revisar propuesta y preparar aprobación</button>}</div>}
            {reviewingPayment?.id === item.id && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs"><p className="font-black text-blue-950">Revisión interna de la propuesta</p><p className="mt-1 text-[11px] text-blue-900">Ajusta la cantidad final que aceptas para cada partida. Se recalculará el monto de este Estado de Pago antes de enviarlo a aprobación.</p><div className="mt-3 space-y-2">{reviewItems.map((line, index) => <div key={`${line.partida}-${index}`} className="grid gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1fr_120px_auto]"><span className="font-bold text-slate-700">{line.partida}<small className="mt-1 block font-normal text-slate-500">Propuesta externa: {line.cantidad_propuesta} {line.unidad}</small></span><label className="text-[10px] font-bold text-slate-500">Cantidad final<input type="number" min="0" max={line.quantity} value={line.cantidad_final} onChange={event => setReviewItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cantidad_final: event.target.value } : row))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-right text-xs" /></label><span className="self-end pb-1 text-right font-bold text-slate-700">{money(Math.max(0, Number(line.cantidad_final || 0) * Number(line.unitPrice || 0) - Number(line.monto_anterior || 0)))}</span></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={prepareForApproval} className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-black text-white">Guardar corrección y preparar aprobación</button><button type="button" onClick={() => { setReviewingPayment(null); setReviewItems([]); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700">Cancelar</button></div></div>}
            {Object.entries(visibleAccessCodes).filter(([key]) => key.startsWith(`${item.id}-`)).map(([key, code]) => <div key={key} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-950"><span className="font-black">Clave de {key.endsWith('-revision') ? 'revisión' : 'aprobación'}:</span><code className="rounded bg-white px-2 py-1 font-black tracking-[0.18em]">{code}</code><button type="button" onClick={() => copyAccessCode(code)} className="flex items-center gap-1 font-black text-emerald-800"><Copy className="h-3 w-3" />Copiar clave</button><span className="text-[10px] text-emerald-800">Visible solo mientras mantengas abierta esta sesión.</span></div>)}
            {item.estado !== 'Aprobado' && item.estado !== 'Pagado' && <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">{(item.estado === 'En aprobación' ? ['aprobacion'] : ['revision']).map(type => <React.Fragment key={type}><button onClick={() => sendExternal(item, type)} className="flex items-center gap-1 text-blue-700"><Send className="h-3 w-3" />Enviar a {type === 'revision' ? 'revisión' : 'aprobación'}</button><button onClick={() => copyLink(item, type)} className="flex items-center gap-1 text-slate-600"><Copy className="h-3 w-3" />Copiar enlace</button></React.Fragment>)}</div>}
          </div>)}</div> : <p className="text-xs text-slate-500">Aún no existen estados de pago para esta obra.</p>}
        </div>
      </section>
    </div>
  </div>;
}
