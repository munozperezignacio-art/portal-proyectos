import React, { useMemo, useState } from 'react';
import { BarChart3, BookOpen, Building2, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, HardHat, KeyRound, Loader2, LogOut, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PublicObraxisHeader from './PublicObraxisHeader';

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = value => value ? new Date(value).toLocaleDateString('es-CL') : '—';

export default function PublicClientePortal({ token }) {
  const [clave, setClave] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [obraIndex, setObraIndex] = useState(0);
  const [tab, setTab] = useState('resumen');
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState('');

  const invoke = async body => {
    const { data: response, error: functionError } = await supabase.functions.invoke('portal-cliente', { body: { token, clave: clave.trim().toUpperCase(), ...body } });
    if (functionError) throw new Error(response?.error || functionError.message);
    if (response?.error) throw new Error(response.error);
    return response;
  };
  const login = async event => {
    event.preventDefault(); setLoading(true); setError('');
    try { const response = await invoke({ action: 'load' }); setData(response); setObraIndex(0); setTab('resumen'); }
    catch (err) { setError(err.message || 'No fue posible ingresar.'); }
    finally { setLoading(false); }
  };
  const sendComment = async () => {
    if (!comment.trim()) return;
    setLoading(true); setError('');
    try { await invoke({ action: 'comment', obra_nombre: current?.obra?.nombre, detalle: comment }); setComment(''); setNotice('Comentario enviado y registrado correctamente.'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const current = data?.obras?.[obraIndex];
  const p = current?.permisos || {};
  const tabs = useMemo(() => current ? [
    ['resumen','Resumen',Building2,true], ['avance','Avance',BarChart3,p.avance], ['programacion','Programación',CalendarDays,p.programacion],
    ['bitacora','Bitácora',Clock3,p.bitacora], ['calidad','Calidad',FileCheck2,p.calidad], ['prevencion','Prevención',HardHat,p.prevencion],
    ['estados_pago','Estados de pago',ClipboardCheck,p.estados_pago], ['libro_obra','Libro de obra',BookOpen,p.libro_obra],
  ].filter(x => x[3]) : [], [current]);
  const brand = data?.branding || {};
  const primary = brand.color_primario || '#0f172a';

  if (!data) return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-4xl"><PublicObraxisHeader /><section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white"><KeyRound className="h-7 w-7" /></div><h1 className="text-center text-2xl font-black text-slate-900">Portal del Cliente</h1><p className="mt-2 text-center text-sm text-slate-500">Ingresa la clave recibida por correo para consultar la información autorizada de tus obras.</p><form onSubmit={login} className="mt-6 space-y-3"><input value={clave} onChange={e => setClave(e.target.value.toUpperCase())} autoFocus maxLength={20} placeholder="CLAVE DE ACCESO" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-lg font-black tracking-[0.25em] outline-none focus:border-primary" />{error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<button disabled={loading || !clave.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}Ingresar de forma segura</button></form></section></div></main>;

  return <main className="min-h-screen bg-slate-100 p-3 sm:p-6"><div className="mx-auto max-w-7xl"><PublicObraxisHeader />
    <header className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7" style={{ borderTop: `5px solid ${primary}` }}><div className="flex items-center gap-4">{brand.logo_base64 ? <img src={brand.logo_base64} alt={brand.razon_social || brand.empresa} className="h-16 w-24 rounded-xl border border-slate-200 object-contain p-2" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Building2 className="h-7 w-7" /></div>}<div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Portal del cliente</p><h1 className="text-xl font-black text-slate-900 sm:text-2xl">{data.portal?.cliente_nombre}</h1><p className="text-sm text-slate-500">Bienvenido, {data.portal?.contacto_nombre}</p></div></div><button onClick={() => { setData(null); setClave(''); }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-600"><LogOut className="h-4 w-4" />Cerrar sesión</button></div></header>
    <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]"><aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Obras habilitadas</p><div className="mt-3 space-y-2">{data.obras.map((item,index) => <button key={item.obra?.nombre || index} onClick={() => { setObraIndex(index); setTab('resumen'); }} className={`w-full rounded-2xl p-3 text-left text-xs font-black ${obraIndex === index ? 'text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`} style={obraIndex === index ? { backgroundColor: primary } : {}}>{item.obra?.nombre || 'Obra'}</button>)}</div></aside>
      <section className="min-w-0 space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-slate-900">{current?.obra?.nombre}</h2><p className="mt-1 text-sm text-slate-500">{current?.obra?.ubicacion || current?.obra?.tipo || 'Información de la obra'}</p><div className="mt-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${tab === id ? 'text-white' : 'bg-slate-100 text-slate-600'}`} style={tab === id ? { backgroundColor: primary } : {}}><Icon className="h-4 w-4" />{label}</button>)}</div></div>
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}{notice && <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p>}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {tab === 'resumen' && <div className="grid gap-4 sm:grid-cols-3"><Stat label="Estatus" value={current?.obra?.estado || 'Sin informar'} /><Stat label="Tipo" value={current?.obra?.tipo || current?.obra?.area || '—'} /><Stat label="Ubicación" value={current?.obra?.ubicacion || '—'} /></div>}
        {tab === 'avance' && <ListEmpty items={current.avances}>{(item) => <Row key={item.id} title={item.partida || item.frente || 'Registro de avance'} detail={`${item.cantidad || 0} ${item.unidad || ''} · ${date(item.created_at)}`} />}</ListEmpty>}
        {tab === 'programacion' && <ListEmpty items={current.programacion}>{item => <div key={item.id} className="border-b border-slate-100 py-3 last:border-0"><div className="flex justify-between gap-4"><p className="text-sm font-black text-slate-800">{item.tarea}</p><span className="text-xs font-black">{Number(item.porcentaje_avance || 0).toFixed(0)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(item.porcentaje_avance || 0))}%`, backgroundColor: primary }} /></div><p className="mt-1 text-xs text-slate-500">{date(item.fecha_inicio)} — {date(item.fecha_fin)}</p></div>}</ListEmpty>}
        {tab === 'bitacora' && <ListEmpty items={current.bitacora}>{item => <Row key={item.id} title={`${item.categoria || 'Bitácora'} · ${item.accion || ''}`} detail={`${item.detalle || ''} · ${date(item.fecha)}`} />}</ListEmpty>}
        {tab === 'calidad' && <><SectionTitle>Solicitudes RDI</SectionTitle><ListEmpty items={current.rdi}>{item => <Row key={item.id} title={`${item.codigo || 'RDI'} · ${item.partida || ''}`} detail={`${item.estado || 'Sin estado'} · ${date(item.fecha_solicitud)}`} />}</ListEmpty><SectionTitle>Recepciones de partidas</SectionTitle><ListEmpty items={current.recepciones}>{item => <Row key={item.id} title={`${item.codigo || 'Recepción'} · ${item.partida || ''}`} detail={`${item.estado || 'Sin estado'} · ${date(item.fecha_entrega)}`} />}</ListEmpty></>}
        {tab === 'prevencion' && <ListEmpty items={current.prevencion}>{item => <Row key={item.id} title={`Registro preventivo · ${item.inspector || 'Sin informante'}`} detail={date(item.created_at)} />}</ListEmpty>}
        {tab === 'estados_pago' && <ListEmpty items={current.estados_pago}>{item => <Row key={item.id} title={`Estado de Pago N° ${item.numero} · ${item.estado || 'Sin estado'}`} detail={`Neto ${money(item.monto_neto)} · corte ${date(item.fecha_corte)}`} />}</ListEmpty>}
        {tab === 'libro_obra' && <ListEmpty items={current.libro_obra}>{item => <Row key={item.id} title={`${item.folio || 'Folio'} · ${item.asunto || item.tipo || 'Anotación'}`} detail={`${item.estado || item.flujo_estado || 'Sin estado'} · ${date(item.fecha)}`} />}</ListEmpty>}
      </div>
      {current?.permite_comentar && <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /><h3 className="font-black text-slate-900">Enviar comentario</h3></div><textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Escribe una observación para el equipo de la obra..." className="mt-3 w-full rounded-2xl border border-slate-300 p-3 text-sm outline-none focus:border-primary" /><div className="mt-3 flex justify-end"><button onClick={sendComment} disabled={loading || !comment.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />Enviar comentario</button></div></div>}
      </section></div>
  </div></main>;
}

function Stat({ label, value }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-2 text-sm font-black text-slate-800">{value}</p></div>; }
function Row({ title, detail }) { return <div className="border-b border-slate-100 py-3 last:border-0"><p className="text-sm font-black text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function ListEmpty({ items, children }) { return !items?.length ? <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No hay información publicada en este apartado.</p> : <div>{items.map(children)}</div>; }
function SectionTitle({ children }) { return <h3 className="mb-2 mt-5 first:mt-0 text-xs font-black uppercase tracking-widest text-slate-500">{children}</h3>; }
