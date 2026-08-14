import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, LockKeyhole, Send, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { registrarEventoBitacora } from '../utils/bitacoraService';
import { appendAudit, auditActor } from '../utils/documentAudit';
import PublicObraxisHeader from './PublicObraxisHeader';

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const percent = value => `${Number(value || 0).toFixed(2)}%`;
const hashAccessCode = async (value) => {
  const bytes = new TextEncoder().encode(String(value || '').trim().toUpperCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export default function PublicEstadoPago({ token, role }) {
  const [item, setItem] = useState(null);
  const [summary, setSummary] = useState({});
  const [proposal, setProposal] = useState([]);
  const [note, setNote] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [authorised, setAuthorised] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const typeLabel = role === 'aprobacion' ? 'aprobación contractual' : 'revisión técnica';

  const loadSupportingData = async (payment) => {
    setItem(payment);
    setProposal((payment.items || []).map(line => ({ ...line, cantidad_propuesta: line.cantidad_propuesta ?? line.executed ?? 0, comentario_externo: line.comentario_externo || '' })));
    const statesResult = await supabase.from('estados_pago_obra').select('numero,monto_bruto,retencion_monto,anticipo_descontado,monto_neto,estado').eq('empresa', payment.empresa).eq('obra_nombre', payment.obra_nombre).lte('numero', payment.numero);
    const valid = (statesResult.data || []).filter(row => row.estado !== 'Rechazado');
    const before = valid.filter(row => Number(row.numero) < Number(payment.numero));
    const total = field => valid.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    const prior = field => before.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    const contractFromSnapshot = (payment.items || []).reduce((sum, line) => sum + (Number(line.monto_contrato || 0) || Number(line.quantity || 0) * Number(line.unitPrice || 0)), 0);
    const contract = contractFromSnapshot;
    setSummary({
      bruto_anterior: prior('monto_bruto'), bruto_acumulado: total('monto_bruto'), retencion_acumulada: total('retencion_monto'), anticipo_acumulado: total('anticipo_descontado'), neto_acumulado: total('monto_neto'),
      avance_periodo_pct: contract > 0 ? Number(payment.monto_bruto || 0) / contract * 100 : 0,
      avance_acumulado_pct: contract > 0 ? total('monto_bruto') / contract * 100 : 0,
    });
  };

  const verifyAccess = async (event) => {
    event.preventDefault();
    if (!accessCode.trim()) { setMessage('Ingresa la clave recibida por correo.'); return; }
    setLoading(true); setMessage('');
    try {
      const codeColumn = role === 'aprobacion' ? 'clave_aprobacion_hash' : 'clave_revision_hash';
      const tokenColumn = role === 'aprobacion' ? 'token_aprobacion' : 'token_revision';
      const codeHash = await hashAccessCode(accessCode);
      const { data, error } = await supabase.from('estados_pago_obra').select('*').eq(tokenColumn, token).eq(codeColumn, codeHash).maybeSingle();
      if (error) throw error;
      if (!data) { setMessage('La clave o el enlace no son válidos. Revisa el correo recibido.'); return; }
      await loadSupportingData(data);
      setAuthorised(true);
    } catch (error) {
      setMessage(error.message?.includes('clave_') ? 'La obra debe actualizar la configuración de Estados de Pago antes de usar claves externas.' : `No fue posible validar el acceso: ${error.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    setAuthorised(false); setItem(null); setAccessCode(''); setMessage('');
  }, [token, role]);

  const reload = async () => {
    if (!item) return;
    const { data, error } = await supabase.from('estados_pago_obra').select('*').eq('id', item.id).maybeSingle();
    if (error || !data) { setMessage('El Estado de Pago ya no está disponible.'); return; }
    await loadSupportingData(data);
  };
  const resolve = async (approved) => {
    const estado = approved ? (role === 'aprobacion' ? 'Aprobado' : 'En aprobación') : 'Observado';
    const field = role === 'aprobacion' ? 'observacion_aprobacion' : 'observacion_revision';
    const actor = role === 'aprobacion' ? item.aprobador_nombre || 'Aprobador externo' : item.revisor_nombre || 'Revisor externo';
    const { data: savedDecision, error } = await supabase.from('estados_pago_obra').update({ estado, [field]: note || null, trazabilidad: appendAudit(item.trazabilidad, auditActor({ nombre: actor, empresa: item.empresa, cargo: role === 'aprobacion' ? 'Aprobador externo' : 'Revisor externo' }, approved ? (role === 'aprobacion' ? 'Estado de Pago aprobado' : 'Revisión técnica conforme') : 'Estado de Pago observado', estado, note)) }).eq('id', item.id).select('id,estado').maybeSingle();
    if (error || !savedDecision || savedDecision.estado !== estado) setMessage(`No fue posible registrar la decisión${error?.message ? `: ${error.message}` : '. El registro no fue actualizado.'}`);
    else { await registrarEventoBitacora({ empresa: item.empresa, obraNombre: item.obra_nombre, categoria: 'Estados de Pago', accion: `EP N° ${item.numero} ${approved ? (role === 'aprobacion' ? 'aprobado' : 'revisado conforme') : 'observado'}`, detalle: note || null, actor: role === 'aprobacion' ? item.aprobador_nombre || 'Aprobador externo' : item.revisor_nombre || 'Revisor externo' }); setMessage(approved ? 'Decisión registrada correctamente.' : 'El Estado de Pago fue devuelto con observaciones.'); await reload(); }
  };
  const submitProposal = async () => {
    const hasProposal = proposal.some(line => Number(line.cantidad_propuesta) !== Number(line.executed) || line.comentario_externo.trim());
    if (!hasProposal) { setMessage('Indica una cantidad distinta o un comentario en al menos una partida.'); return; }
    const { error } = await supabase.from('estados_pago_obra').update({ estado: 'Observado', items: proposal, observacion_revision: note || 'Se recibió una propuesta de ajuste por partidas.', trazabilidad: appendAudit(item.trazabilidad, auditActor({ nombre: item.revisor_nombre || 'Revisor externo', empresa: item.empresa, cargo: 'Revisor externo' }, 'Propuesta externa de ajuste', 'Observado', note || 'Se propusieron ajustes por partidas.')) }).eq('id', item.id);
    if (error) setMessage(`No fue posible enviar la propuesta: ${error.message}`);
    else { await registrarEventoBitacora({ empresa: item.empresa, obraNombre: item.obra_nombre, categoria: 'Estados de Pago', accion: `EP N° ${item.numero} observado con propuesta`, detalle: note || 'El revisor propuso ajustes por partidas.', actor: item.revisor_nombre || 'Revisor externo' }); setMessage('Propuesta enviada al preparador para su revisión.'); await reload(); }
  };

  if (!authorised) return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><PublicObraxisHeader /><section className="mx-auto mt-12 max-w-md rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2 text-emerald-800"><LockKeyhole className="h-5 w-5" /></div><div><h1 className="font-black text-slate-900">Acceso protegido</h1><p className="text-xs text-slate-500">Estado de Pago · {typeLabel}</p></div></div><p className="mt-5 text-sm text-slate-600">Ingresa la clave de 8 caracteres enviada al correo junto con este enlace.</p><form onSubmit={verifyAccess} className="mt-4 space-y-3"><input autoFocus value={accessCode} onChange={event => setAccessCode(event.target.value.toUpperCase())} maxLength={8} placeholder="Ej.: 7K4M9P2R" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.25em] uppercase focus:border-emerald-600 focus:outline-none" /><button disabled={loading} className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-black text-white disabled:opacity-60">{loading ? 'Validando…' : 'Ingresar al Estado de Pago'}</button></form>{message && <p className="mt-4 text-xs font-semibold text-rose-700">{message}</p>}</section></main>;
  if (!item) return <div className="min-h-screen grid place-items-center p-6 text-center text-rose-700">{message}</div>;
  const canAct = !['Aprobado', 'Pagado', 'Rechazado'].includes(item.estado);
  const editable = canAct && role === 'revision';
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><PublicObraxisHeader /><section className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center gap-2 border-b pb-4"><FileText className="text-emerald-700" /><div><h1 className="text-xl font-black text-slate-900">Estado de Pago N° {item.numero}</h1><p className="text-xs text-slate-500">{item.obra_nombre} · Corte {item.fecha_corte}</p></div></div>{editable && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><b>Propuesta externa por partidas.</b> Puedes ajustar la cantidad propuesta y dejar un comentario en cada partida antes de enviarla.</div>}<div className="mt-5 overflow-x-auto"><table className="min-w-full text-xs"><thead className="border-b text-left text-slate-500"><tr><th className="p-2">Partida</th><th className="p-2 text-right">Cantidad contratada</th><th className="p-2 text-right">P.U. contratado</th><th className="p-2 text-right">Anterior</th><th className="p-2 text-right">Cantidad propuesta</th><th className="p-2 text-right">Este EP</th><th className="p-2 text-right">Acumulado</th><th className="p-2">Comentario externo</th></tr></thead><tbody>{proposal.map((line, index) => <tr key={index} className="border-b border-slate-100 align-top"><td className="p-2 font-bold">{line.partida}</td><td className="p-2 text-right">{line.quantity} {line.unidad}</td><td className="p-2 text-right">{money(line.unitPrice)}</td><td className="p-2 text-right">{money(line.monto_anterior)}</td><td className="p-2 text-right">{editable ? <input type="number" min="0" max={line.quantity} value={line.cantidad_propuesta} onChange={event => setProposal(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cantidad_propuesta: event.target.value } : row))} className="w-24 rounded border p-1 text-right" /> : `${line.cantidad_propuesta} ${line.unidad}`}</td><td className="p-2 text-right font-bold">{money(line.amount)}</td><td className="p-2 text-right font-bold">{money(line.monto_acumulado)}</td><td className="p-2">{editable ? <textarea rows={2} value={line.comentario_externo} onChange={event => setProposal(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, comentario_externo: event.target.value } : row))} placeholder="Fundamento o comentario" className="min-w-40 rounded border p-1" /> : line.comentario_externo || '—'}</td></tr>)}</tbody></table></div><div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs"><h2 className="mb-3 text-sm font-black text-emerald-950">Liquidación del Estado de Pago</h2><div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2"><span>Avance acumulado a la fecha ({percent(summary.avance_acumulado_pct)})</span><b>{money(summary.bruto_acumulado)}</b><span>(-) Avance liquidado en EP anteriores</span><b>- {money(summary.bruto_anterior)}</b><span className="border-t border-emerald-200 pt-2 font-black">(=) Avance de este período ({percent(summary.avance_periodo_pct)})</span><b className="border-t border-emerald-200 pt-2">{money(item.monto_bruto)}</b><span>(-) Retención del período ({item.retencion_pct || 0}%)</span><b>- {money(item.retencion_monto)}</b><span>(-) Amortización de anticipo del período</span><b>- {money(item.anticipo_descontado)}</b><span className="border-t border-emerald-300 pt-2 text-sm font-black">Neto a pagar en este EP</span><b className="border-t border-emerald-300 pt-2 text-sm font-black">{money(item.monto_neto)}</b></div><p className="mt-3 text-[10px] text-emerald-900">Acumulado: retención {money(summary.retencion_acumulada)} · anticipo amortizado {money(summary.anticipo_acumulado)} · neto pagado {money(summary.neto_acumulado)}.</p></div>{canAct && <div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-sm font-black">{role === 'aprobacion' ? 'Aprobación contractual' : 'Revisión técnica y propuesta de ajuste'}</p><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Comentario general u observación" rows={3} className="mt-3 w-full rounded-lg border p-2 text-sm" /><div className="mt-3 flex flex-wrap gap-2">{editable && <button onClick={submitProposal} className="flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white"><Send className="h-4 w-4" />Enviar propuesta de ajuste</button>}<button onClick={() => resolve(true)} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" />{role === 'aprobacion' ? 'Aprobar' : 'Conforme, enviar a aprobación'}</button><button onClick={() => resolve(false)} className="flex items-center gap-1 rounded-lg bg-rose-700 px-4 py-2 text-xs font-black text-white"><XCircle className="h-4 w-4" />Devolver con observaciones</button></div></div>}{message && <p className="mt-4 text-sm font-bold text-slate-700">{message}</p>}</section></main>;
}
