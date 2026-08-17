import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ClipboardCheck, KeyRound } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PublicObraxisHeader from './PublicObraxisHeader';

const field = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const today = () => new Date().toISOString().slice(0, 10);

export default function SubcontractOperationsPortal({ token }) {
  const [credential, setCredential] = useState('');
  const [session, setSession] = useState(null);
  const [contractId, setContractId] = useState('');
  const [kind, setKind] = useState('avance');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ fecha: today() });
  const [message, setMessage] = useState('');

  const call = useCallback(async (action, data = {}, selectedContractId = contractId) => {
    const { data: result, error } = await supabase.functions.invoke('subcontrato-operacion', { body: { token, credential: credential.trim().toUpperCase(), contractId: selectedContractId || null, action, data } });
    if (error || result?.error) throw new Error(result?.error || 'No fue posible conectar con el minisitio.');
    return result;
  }, [contractId, credential, token]);

  const enter = async event => {
    event.preventDefault();
    try {
      const result = await call('access', {}, null);
      setSession(result);
      setContractId(result.contracts?.[0] ? String(result.contracts[0].id) : '');
      setMessage('');
    } catch (error) { setMessage(error.message); }
  };

  const load = useCallback(async () => {
    if (!session || !contractId) return;
    try { setRows((await call('list')).records || []); } catch (error) { setMessage(error.message); }
  }, [call, contractId, session]);
  useEffect(() => { load(); }, [load]);

  const contract = session?.contracts?.find(item => String(item.id) === String(contractId));
  const allowed = useMemo(() => contract ? [contract.reporta_avances && ['avance', 'Avance'], contract.reporta_asistencia && ['asistencia', 'Asistencia'], contract.reporta_estados_pago && ['pago', 'Estado de pago']].filter(Boolean) : [], [contract]);
  useEffect(() => {
    if (allowed.length && !allowed.some(item => item[0] === kind)) setKind(allowed[0][0]);
    setForm({ fecha: today() });
  }, [allowed, contractId, kind]);

  const send = async event => {
    event.preventDefault();
    try {
      await call(`create_${kind}`, form);
      setMessage('Registro enviado correctamente a revisión.');
      setForm({ fecha: today() });
      await load();
    } catch (error) { setMessage(error.message); }
  };

  if (!session) return <div className="min-h-screen bg-slate-100"><PublicObraxisHeader/><main className="mx-auto max-w-lg p-5"><form onSubmit={enter} className="mt-10 rounded-3xl bg-white p-7 shadow-xl"><KeyRound className="h-10 w-10 text-orange-600"/><h1 className="mt-4 text-2xl font-black">Portal operacional</h1><p className="mt-2 text-sm text-slate-500">Acceso independiente para reportar únicamente la información exigida por el contrato.</p>{message && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{message}</p>}<input required value={credential} onChange={event => setCredential(event.target.value.toUpperCase())} placeholder="Clave operacional" className={`${field} mt-5 font-mono font-black`}/><button className="mt-3 w-full rounded-xl bg-slate-950 py-3 font-black text-white">Ingresar</button></form></main></div>;

  return <div className="min-h-screen bg-slate-100"><PublicObraxisHeader/><main className="mx-auto max-w-5xl space-y-4 p-5"><header className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-orange-400"/><div><p className="text-xs font-black uppercase tracking-widest text-orange-300">Operación subcontratista</p><h1 className="text-2xl font-black">{session.subcontract.empresa_nombre}</h1><p className="text-sm text-slate-300">{session.work.nombre} · Contacto: {session.profile.contacto_nombre}</p></div></div></header>
    <section className="rounded-3xl bg-white p-5"><label className="text-xs font-black uppercase text-slate-500">Contrato, orden o servicio</label><select value={contractId} onChange={event => setContractId(event.target.value)} className={`${field} mt-2`}>{session.contracts.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select>{!session.contracts.length && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">No existen contratos vigentes habilitados para reportar.</p>}</section>
    {contract && <section className="rounded-3xl bg-white p-5"><div className="flex flex-wrap gap-2">{allowed.map(([id, label]) => <button key={id} onClick={() => setKind(id)} className={`rounded-xl px-4 py-2 text-xs font-black ${kind === id ? 'bg-blue-900 text-white' : 'bg-slate-100'}`}>{label}</button>)}</div>{message && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</p>}{allowed.length > 0 && <form onSubmit={send} className="mt-4 grid gap-3 md:grid-cols-2"><input type="date" required value={form.fecha || ''} onChange={event => setForm({...form, fecha: event.target.value})} className={field}/>{kind === 'avance' && <><select required value={form.contrato_item_id || ''} onChange={event => setForm({...form, contrato_item_id: event.target.value})} className={field}><option value="">Partida contratada</option>{contract.items.filter(item => item.tipo_item === 'Partida' && item.reporta_avance).map(item => <option key={item.id} value={item.id}>{item.codigo ? `${item.codigo} · ` : ''}{item.descripcion}</option>)}</select><input required type="number" min="0" step="any" placeholder="Cantidad ejecutada" value={form.cantidad || ''} onChange={event => setForm({...form, cantidad: event.target.value})} className={field}/><textarea placeholder="Comentario" value={form.comentario || ''} onChange={event => setForm({...form, comentario: event.target.value})} className={`${field} md:col-span-2`}/></>}{kind === 'asistencia' && <><input required type="number" min="0" placeholder="Presentes" value={form.presentes || ''} onChange={event => setForm({...form, presentes: event.target.value})} className={field}/><input type="number" min="0" placeholder="Ausentes" value={form.ausentes || ''} onChange={event => setForm({...form, ausentes: event.target.value})} className={field}/><input type="number" min="0" step=".5" placeholder="Horas hombre" value={form.horas_hombre || ''} onChange={event => setForm({...form, horas_hombre: event.target.value})} className={field}/></>}{kind === 'pago' && <><input required type="number" min="1" placeholder="N° estado de pago" value={form.numero || ''} onChange={event => setForm({...form, numero: event.target.value})} className={field}/><input required type="date" value={form.periodo_desde || ''} onChange={event => setForm({...form, periodo_desde: event.target.value})} className={field}/><input required type="date" value={form.periodo_hasta || ''} onChange={event => setForm({...form, periodo_hasta: event.target.value})} className={field}/><input required type="number" min="0" placeholder="Monto presentado" value={form.monto_presentado || ''} onChange={event => setForm({...form, monto_presentado: event.target.value})} className={field}/><input placeholder="Folio factura (si corresponde)" value={form.factura_folio || ''} onChange={event => setForm({...form, factura_folio: event.target.value})} className={field}/><textarea placeholder="Observaciones" value={form.observaciones || ''} onChange={event => setForm({...form, observaciones: event.target.value})} className={`${field} md:col-span-2`}/></>}<button className="rounded-xl bg-emerald-700 py-3 text-sm font-black text-white md:col-span-2">Enviar a revisión</button></form>}</section>}
    <section className="rounded-3xl bg-white p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-800"/><h2 className="font-black">Últimos envíos del contrato</h2></div>{rows.slice(0, 10).map((row, index) => <div key={`${row.tipo}-${row.id}-${index}`} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><b>{row.tipo}</b> · {row.fecha || row.created_at?.slice(0, 10)}<span className="float-right font-bold">{row.estado || 'Registrado'}</span></div>)}{!rows.length && <p className="mt-3 text-sm text-slate-500">Aún no existen envíos para este contrato.</p>}</section>
  </main></div>;
}
