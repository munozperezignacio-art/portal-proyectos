import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCheck2, Plus, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

const initialPac = { partida: '', procedimiento: '', criterios: '', puntos_inspeccion: '', puntos_espera: '', responsable: '' };
const initialRdi = { partida: '', pac_id: '', sector: '', cantidad: '', unidad: '', solicitado_por: '', observaciones: '' };
const initialNc = { partida: '', rdi_id: '', descripcion: '', clasificacion: 'Menor', responsable: '', fecha_compromiso: '', causa_raiz: '', accion_correctiva: '' };

const statusClass = (status) => ({
  Aprobada: 'bg-emerald-100 text-emerald-800', Cerrada: 'bg-emerald-100 text-emerald-800',
  Rechazada: 'bg-rose-100 text-rose-800', Abierta: 'bg-rose-100 text-rose-800',
  Observada: 'bg-amber-100 text-amber-800', Enviada: 'bg-blue-100 text-blue-800',
  Borrador: 'bg-slate-100 text-slate-700', 'En corrección': 'bg-amber-100 text-amber-800',
}[status] || 'bg-slate-100 text-slate-700');

export default function CalidadObras({ user, onBack }) {
  const [tab, setTab] = useState('resumen');
  const [obras, setObras] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [obraNombre, setObraNombre] = useState('');
  const [pacs, setPacs] = useState([]);
  const [rdis, setRdis] = useState([]);
  const [ncs, setNcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pacForm, setPacForm] = useState(initialPac);
  const [rdiForm, setRdiForm] = useState(initialRdi);
  const [ncForm, setNcForm] = useState(initialNc);

  const empresa = user?.empresa || null;
  const partidasEjecutables = useMemo(() => partidas.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)), [partidas]);
  const pacPorPartida = useMemo(() => new Map(pacs.map(p => [p.partida, p])), [pacs]);
  const rdisPendientes = rdis.filter(r => ['Borrador', 'Enviada', 'Observada'].includes(r.estado));
  const ncsAbiertas = ncs.filter(n => !['Cerrada', 'Verificada'].includes(n.estado));

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: obrasData, error: obrasError } = await supabase.from('obras').select('nombre').eq('empresa', empresa).order('nombre');
      if (obrasError) throw obrasError;
      const nextObras = obrasData || [];
      setObras(nextObras);
      const target = obraNombre || nextObras[0]?.nombre || '';
      if (!obraNombre && target) setObraNombre(target);
      if (!target) { setPacs([]); setRdis([]); setNcs([]); setPartidas([]); return; }
      const [partidasRes, pacRes, rdiRes, ncRes] = await Promise.all([
        supabase.from('partidas_obra').select('partida, unidad, es_titulo').eq('obra_nombre', target),
        supabase.from('calidad_pac').select('*').eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_rdi').select('*').eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_no_conformidades').select('*').eq('obra_nombre', target).order('created_at', { ascending: false }),
      ]);
      if (partidasRes.error) throw partidasRes.error;
      if (pacRes.error || rdiRes.error || ncRes.error) throw (pacRes.error || rdiRes.error || ncRes.error);
      setPartidas(partidasRes.data || []); setPacs(pacRes.data || []); setRdis(rdiRes.data || []); setNcs(ncRes.data || []);
    } catch (error) {
      setMessage(error.message?.includes('calidad_') ? 'Falta habilitar Calidad en Supabase. Ejecuta schema_calidad_obras.sql y actualiza.' : `No fue posible cargar Calidad: ${error.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [empresa]);
  useEffect(() => { if (obraNombre) load(); }, [obraNombre]);

  const savePac = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('calidad_pac').insert({ empresa, obra_nombre: obraNombre, ...pacForm, estado: 'Activo' });
      if (error) throw error;
      setPacForm(initialPac); setMessage('PAC creado y disponible para solicitudes RDI.'); await load();
    } catch (error) { setMessage(`No se pudo guardar el PAC: ${error.message}`); }
  };
  const saveRdi = async (e) => {
    e.preventDefault();
    try {
      const codigo = `RDI-${new Date().getFullYear()}-${String(rdis.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('calidad_rdi').insert({ empresa, obra_nombre: obraNombre, ...rdiForm, codigo, estado: 'Enviada', fecha_solicitud: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
      setRdiForm(initialRdi); setMessage(`${codigo} enviada a inspección.`); await load();
    } catch (error) { setMessage(`No se pudo registrar la RDI: ${error.message}`); }
  };
  const saveNc = async (e) => {
    e.preventDefault();
    try {
      const codigo = `NC-${new Date().getFullYear()}-${String(ncs.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('calidad_no_conformidades').insert({ empresa, obra_nombre: obraNombre, ...ncForm, codigo, estado: 'Abierta' });
      if (error) throw error;
      setNcForm(initialNc); setMessage(`${codigo} registrada para seguimiento.`); await load();
    } catch (error) { setMessage(`No se pudo registrar la no conformidad: ${error.message}`); }
  };
  const updateStatus = async (table, id, estado) => {
    try {
      const extra = table === 'calidad_no_conformidades' && estado === 'Cerrada' ? { fecha_cierre: new Date().toISOString().slice(0, 10) } : {};
      const { error } = await supabase.from(table).update({ estado, ...extra }).eq('id', id);
      if (error) throw error;
      await load();
    } catch (error) { setMessage(`No se pudo actualizar: ${error.message}`); }
  };
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none';

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-emerald-700" /><h1 className="text-xl font-black text-slate-900">Calidad de Obras</h1></div><p className="mt-1 text-xs text-slate-500">PAC, solicitudes RDI, recepción de partidas y no conformidades con trazabilidad.</p></div>
      <div className="flex flex-wrap gap-2"><select value={obraNombre} onChange={e => setObraNombre(e.target.value)} className="min-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"><option value="">Selecciona una obra</option>{obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}</select><button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button><button onClick={onBack} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Volver</button></div>
    </div>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{message}</div>}
    <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5">{[['resumen','Resumen'],['pac','PAC por partida'],['rdi','Solicitudes RDI'],['nc','No conformidades']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}</div>
    {!obraNombre ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Selecciona una obra para comenzar su control de calidad.</div> : loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando calidad de obra…</div> : <>
      {tab === 'resumen' && <div className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ClipboardCheck />} label="PAC activos" value={pacs.filter(p => p.estado === 'Activo').length} detail={`${pacs.length} creados`} color="emerald" />
        <Metric icon={<FileCheck2 />} label="RDI pendientes" value={rdisPendientes.length} detail={`${rdis.filter(r => r.estado === 'Aprobada').length} aprobadas`} color="blue" />
        <Metric icon={<AlertTriangle />} label="NC abiertas" value={ncsAbiertas.length} detail={`${ncs.filter(n => n.estado === 'Cerrada').length} cerradas`} color="rose" />
        <Metric icon={<CheckCircle2 />} label="Recepción a la primera" value={`${rdis.length ? Math.round((rdis.filter(r => r.estado === 'Aprobada').length / rdis.length) * 100) : 0}%`} detail="RDIs aprobadas" color="amber" />
      </div><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 text-sm font-black text-slate-800">Partidas bloqueadas o por inspeccionar</h3>{rdisPendientes.length ? <div className="space-y-2">{rdisPendientes.slice(0,6).map(r => <RdiRow key={r.id} rdi={r} onStatus={updateStatus} />)}</div> : <Empty text="No hay RDI pendientes en esta obra." />}</section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 text-sm font-black text-slate-800">No conformidades prioritarias</h3>{ncsAbiertas.length ? <div className="space-y-2">{ncsAbiertas.slice(0,6).map(n => <NcRow key={n.id} nc={n} onStatus={updateStatus} />)}</div> : <Empty text="No hay no conformidades abiertas." />}</section></div></div>}
      {tab === 'pac' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={savePac} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-emerald-700" />Crear PAC / ITP</h3><SelectPartida value={pacForm.partida} onChange={v => setPacForm({...pacForm,partida:v})} partidas={partidasEjecutables} /><input required placeholder="Procedimiento aplicable" value={pacForm.procedimiento} onChange={e=>setPacForm({...pacForm,procedimiento:e.target.value})} className={input}/><textarea required placeholder="Criterios de aceptación" value={pacForm.criterios} onChange={e=>setPacForm({...pacForm,criterios:e.target.value})} className={input}/><textarea placeholder="Puntos de inspección (separados por línea)" value={pacForm.puntos_inspeccion} onChange={e=>setPacForm({...pacForm,puntos_inspeccion:e.target.value})} className={input}/><textarea placeholder="Puntos de espera / liberación" value={pacForm.puntos_espera} onChange={e=>setPacForm({...pacForm,puntos_espera:e.target.value})} className={input}/><input placeholder="Responsable de calidad" value={pacForm.responsable} onChange={e=>setPacForm({...pacForm,responsable:e.target.value})} className={input}/><button className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white">Guardar PAC</button></form><section className="space-y-3">{pacs.length ? pacs.map(p => <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-800">{p.partida}</p><p className="mt-1 text-xs font-semibold text-emerald-800">{p.procedimiento}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(p.estado)}`}>{p.estado}</span></div><div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-3"><Info label="Criterios" value={p.criterios} /><Info label="Inspección" value={p.puntos_inspeccion || 'Sin definir'} /><Info label="Puntos de espera" value={p.puntos_espera || 'Sin definir'} /></div></div>) : <Empty text="Aún no hay PAC creados. Crea uno por cada partida o actividad crítica." />}</section></div>}
      {tab === 'rdi' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={saveRdi} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-blue-700" />Nueva Solicitud RDI</h3><SelectPartida value={rdiForm.partida} onChange={v => setRdiForm({...rdiForm,partida:v,pac_id:pacPorPartida.get(v)?.id || ''})} partidas={partidasEjecutables}/><select required value={rdiForm.pac_id} onChange={e=>setRdiForm({...rdiForm,pac_id:e.target.value})} className={input}><option value="">PAC asociado</option>{pacs.filter(p=>!rdiForm.partida || p.partida===rdiForm.partida).map(p=><option key={p.id} value={p.id}>{p.procedimiento}</option>)}</select><input required placeholder="Sector / ubicación" value={rdiForm.sector} onChange={e=>setRdiForm({...rdiForm,sector:e.target.value})} className={input}/><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="any" placeholder="Cantidad" value={rdiForm.cantidad} onChange={e=>setRdiForm({...rdiForm,cantidad:e.target.value})} className={input}/><input placeholder="Unidad" value={rdiForm.unidad} onChange={e=>setRdiForm({...rdiForm,unidad:e.target.value})} className={input}/></div><input required placeholder="Solicitado por" value={rdiForm.solicitado_por} onChange={e=>setRdiForm({...rdiForm,solicitado_por:e.target.value})} className={input}/><textarea placeholder="Observaciones y evidencias disponibles" value={rdiForm.observaciones} onChange={e=>setRdiForm({...rdiForm,observaciones:e.target.value})} className={input}/><button className="w-full rounded-xl bg-blue-800 py-2.5 text-xs font-black text-white">Enviar RDI a inspección</button></form><section className="space-y-2">{rdis.length ? rdis.map(r => <RdiRow key={r.id} rdi={r} onStatus={updateStatus} full />) : <Empty text="No hay solicitudes RDI registradas." />}</section></div>}
      {tab === 'nc' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={saveNc} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-rose-700" />Registrar no conformidad</h3><SelectPartida value={ncForm.partida} onChange={v => setNcForm({...ncForm,partida:v})} partidas={partidasEjecutables}/><select value={ncForm.rdi_id} onChange={e=>setNcForm({...ncForm,rdi_id:e.target.value})} className={input}><option value="">RDI relacionada (opcional)</option>{rdis.map(r=><option key={r.id} value={r.id}>{r.codigo} · {r.partida}</option>)}</select><textarea required placeholder="Descripción de la desviación" value={ncForm.descripcion} onChange={e=>setNcForm({...ncForm,descripcion:e.target.value})} className={input}/><select value={ncForm.clasificacion} onChange={e=>setNcForm({...ncForm,clasificacion:e.target.value})} className={input}><option>Menor</option><option>Mayor</option><option>Crítica</option></select><input required placeholder="Responsable de corrección" value={ncForm.responsable} onChange={e=>setNcForm({...ncForm,responsable:e.target.value})} className={input}/><input type="date" value={ncForm.fecha_compromiso} onChange={e=>setNcForm({...ncForm,fecha_compromiso:e.target.value})} className={input}/><textarea placeholder="Causa raíz" value={ncForm.causa_raiz} onChange={e=>setNcForm({...ncForm,causa_raiz:e.target.value})} className={input}/><textarea placeholder="Acción correctiva" value={ncForm.accion_correctiva} onChange={e=>setNcForm({...ncForm,accion_correctiva:e.target.value})} className={input}/><button className="w-full rounded-xl bg-rose-700 py-2.5 text-xs font-black text-white">Abrir no conformidad</button></form><section className="space-y-2">{ncs.length ? ncs.map(n => <NcRow key={n.id} nc={n} onStatus={updateStatus} full />) : <Empty text="No hay no conformidades registradas." />}</section></div>}
    </>}
  </div>;
}

function Metric({ icon, label, value, detail, color }) { return <div className={`rounded-2xl border bg-white p-4 ${color === 'rose' ? 'border-rose-200' : 'border-slate-200'}`}><div className="flex items-center gap-2 text-slate-500">{React.cloneElement(icon,{className:`h-4 w-4 text-${color}-700`})}<span className="text-[10px] font-black uppercase tracking-wide">{label}</span></div><p className="mt-2 text-2xl font-black text-slate-900">{value}</p><p className="text-[10px] font-semibold text-slate-500">{detail}</p></div>; }
function Empty({ text }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">{text}</div>; }
function Info({ label, value }) { return <div><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 whitespace-pre-line text-xs">{value}</p></div>; }
function SelectPartida({ value, onChange, partidas }) { return <select required value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"><option value="">Selecciona partida</option>{partidas.map(p=><option key={p.id || p.partida} value={p.partida}>{p.partida}</option>)}</select>; }
function RdiRow({ rdi, onStatus, full }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-800">{rdi.codigo} · {rdi.partida}</p><p className="mt-1 text-[11px] text-slate-500">{rdi.sector} {rdi.cantidad ? `· ${rdi.cantidad} ${rdi.unidad || ''}` : ''} · Solicitó: {rdi.solicitado_por}</p>{full && rdi.observaciones && <p className="mt-2 text-[11px] text-slate-600">{rdi.observaciones}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(rdi.estado)}`}>{rdi.estado}</span>{['Enviada','Observada'].includes(rdi.estado) && <><button onClick={()=>onStatus('calidad_rdi',rdi.id,'Aprobada')} className="text-[10px] font-black text-emerald-700">Aprobar</button><button onClick={()=>onStatus('calidad_rdi',rdi.id,'Observada')} className="text-[10px] font-black text-amber-700">Observar</button></>}</div></div></div>; }
function NcRow({ nc, onStatus, full }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-800">{nc.codigo} · {nc.partida}</p><p className="mt-1 text-[11px] text-slate-500">{nc.clasificacion} · Responsable: {nc.responsable} {nc.fecha_compromiso ? `· Compromiso: ${nc.fecha_compromiso}` : ''}</p>{full && <p className="mt-2 text-[11px] text-slate-700">{nc.descripcion}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(nc.estado)}`}>{nc.estado}</span>{nc.estado !== 'Cerrada' && <button onClick={()=>onStatus('calidad_no_conformidades',nc.id,'Cerrada')} className="text-[10px] font-black text-emerald-700">Cerrar</button>}</div></div></div>; }
