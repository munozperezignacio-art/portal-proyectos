import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Link2, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs';
const who = user => user?.nombre || user?.usuario || user?.correo || 'Usuario Obraxis';

export default function CollaborativeContracts({ obra, user }) {
  const company = user?.empresa || '';
  const [collaborations, setCollaborations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [works, setWorks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [parts, setParts] = useState({ principal: [], collaborator: [] });
  const [links, setLinks] = useState([]);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ colaboracion_id: '', codigo: '', nombre: '', monto_contrato: '', fecha_inicio: '', fecha_termino: '' });
  const [mapping, setMapping] = useState({ partida_contratista_id: '', partida_colaboradora_id: '', cantidad_contratada: '', ponderacion: '', factor_conversion: 1 });

  const load = async () => {
    const [c, k, o] = await Promise.all([
      supabase.from('colaboraciones_obra').select('*').eq('estado', 'Activa'),
      supabase.from('contratos_colaborativos').select('*').order('created_at', { ascending: false }),
      supabase.from('obras').select('id,nombre,empresa,estado').eq('empresa', company).order('nombre')
    ]);
    const error = c.error || k.error || o.error;
    if (error) return setMessage(error.message);
    setCollaborations((c.data || []).filter(x => (x.empresa_contratista === company && x.obra_nombre === obra.nombre) || x.empresa_colaboradora === company));
    setContracts((k.data || []).filter(x => x.obra_contratista_id === obra.id || x.obra_colaboradora_id === obra.id || x.obra_contratista_nombre === obra.nombre || x.obra_colaboradora_nombre === obra.nombre));
    setWorks(o.data || []);
  };

  useEffect(() => { load(); }, [obra.id, obra.nombre, company]);

  const open = async contract => {
    setSelected(contract);
    const principalScope = contract.obra_contratista_id
      ? supabase.from('partidas_obra').select('id,codigo,partida,unidad,cantidad_presupuestada').eq('empresa', contract.empresa_contratista).eq('obra_id', contract.obra_contratista_id).order('id')
      : supabase.from('partidas_obra').select('id,codigo,partida,unidad,cantidad_presupuestada').eq('empresa', contract.empresa_contratista).eq('obra_nombre', contract.obra_contratista_nombre).order('id');
    const collaboratorScope = contract.obra_colaboradora_id
      ? supabase.from('partidas_obra').select('id,codigo,partida,unidad,cantidad_presupuestada').eq('empresa', contract.empresa_colaboradora).eq('obra_id', contract.obra_colaboradora_id).order('id')
      : contract.obra_colaboradora_nombre
        ? supabase.from('partidas_obra').select('id,codigo,partida,unidad,cantidad_presupuestada').eq('empresa', contract.empresa_colaboradora).eq('obra_nombre', contract.obra_colaboradora_nombre).order('id')
        : Promise.resolve({ data: [] });
    const [m, a, b] = await Promise.all([
      supabase.from('contratos_colaborativos_partidas').select('*').eq('contrato_id', contract.id).order('created_at'),
      principalScope,
      collaboratorScope
    ]);
    const error = m.error || a.error || b.error;
    if (error) return setMessage(error.message);
    setLinks(m.data || []); setParts({ principal: a.data || [], collaborator: b.data || [] });
  };

  const create = async event => {
    event.preventDefault();
    const relation = collaborations.find(x => String(x.id) === String(form.colaboracion_id));
    if (!relation || relation.empresa_contratista !== company) return setMessage('Selecciona una empresa colaboradora activa.');
    const payload = {
      colaboracion_id: relation.id, codigo: form.codigo.trim().toUpperCase(), nombre: form.nombre.trim(),
      empresa_contratista: relation.empresa_contratista, rut_contratista: relation.rut_contratista,
      obra_contratista_id: obra.id, obra_contratista_nombre: obra.nombre,
      empresa_colaboradora: relation.empresa_colaboradora, rut_colaboradora: relation.rut_colaboradora,
      monto_contrato: Number(form.monto_contrato) || 0, fecha_inicio: form.fecha_inicio || null, fecha_termino: form.fecha_termino || null,
      estado: 'Pendiente contraparte', creado_por: who(user)
    };
    const { data, error } = await supabase.from('contratos_colaborativos').insert(payload).select().single();
    if (error) return setMessage(error.message);
    await supabase.from('contratos_colaborativos_eventos').insert({ contrato_id: data.id, empresa: company, accion: 'Contrato creado', estado_resultante: data.estado, actor_nombre: who(user) });
    setForm({ colaboracion_id: '', codigo: '', nombre: '', monto_contrato: '', fecha_inicio: '', fecha_termino: '' }); setCreating(false);
    setMessage('Contrato enviado a la empresa colaboradora.'); await load(); await open(data);
  };

  const accept = async workId => {
    const work = works.find(x => String(x.id) === String(workId));
    if (!work || selected?.empresa_colaboradora !== company) return;
    const { data, error } = await supabase.from('contratos_colaborativos').update({ obra_colaboradora_id: work.id, obra_colaboradora_nombre: work.nombre, estado: 'Activo', aceptado_por: who(user), aceptado_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', selected.id).select().single();
    if (error) return setMessage(error.message);
    await supabase.from('contratos_colaborativos_eventos').insert({ contrato_id: data.id, empresa: company, accion: 'Contrato aceptado', estado_resultante: 'Activo', detalle: work.nombre, actor_nombre: who(user) });
    setMessage('Contrato activado y obra colaboradora vinculada.'); await load(); await open(data);
  };

  const mapParts = async event => {
    event.preventDefault();
    const a = parts.principal.find(x => String(x.id) === String(mapping.partida_contratista_id));
    const b = parts.collaborator.find(x => String(x.id) === String(mapping.partida_colaboradora_id));
    if (!a || !b) return;
    const { error } = await supabase.from('contratos_colaborativos_partidas').insert({
      contrato_id: selected.id, partida_contratista_id: a.id, partida_colaboradora_id: b.id,
      codigo_contratista: a.codigo, nombre_contratista: a.partida, unidad_contratista: a.unidad,
      codigo_colaboradora: b.codigo, nombre_colaboradora: b.partida, unidad_colaboradora: b.unidad,
      cantidad_contratada: Number(mapping.cantidad_contratada) || 0, ponderacion: (Number(mapping.ponderacion) || 0) / 100,
      factor_conversion: Number(mapping.factor_conversion) || 1, estado: 'Propuesto', creado_por: who(user)
    });
    if (error) return setMessage(error.code === '23505' ? 'Ese enlace ya existe.' : error.message);
    setMapping({ partida_contratista_id: '', partida_colaboradora_id: '', cantidad_contratada: '', ponderacion: '', factor_conversion: 1 });
    setMessage('Enlace de partidas propuesto.'); await open(selected);
  };

  const approveLink = async link => {
    const { error } = await supabase.from('contratos_colaborativos_partidas').update({ estado: 'Aceptado', aceptado_por: who(user), aceptado_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', link.id);
    if (error) return setMessage(error.message);
    await supabase.from('contratos_colaborativos_eventos').insert({ contrato_id: selected.id, empresa: company, accion: 'Enlace de partidas aceptado', detalle: `${link.nombre_contratista} ↔ ${link.nombre_colaboradora}`, actor_nombre: who(user) });
    await open(selected);
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-indigo-200 bg-indigo-50 p-5"><div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Integración empresa–empresa</p><h3 className="font-black">Contratos colaborativos y enlace de partidas</h3><p className="text-xs text-slate-600">Cada empresa conserva su análisis; solo se comparte el alcance contratado.</p></div>{collaborations.some(x => x.empresa_contratista === company && x.obra_nombre === obra.nombre) && <button onClick={() => setCreating(!creating)} className="flex items-center gap-2 rounded-xl bg-indigo-900 px-4 py-2.5 text-xs font-black text-white"><Plus className="h-4 w-4"/>Nuevo contrato</button>}</div>
    {message && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900">{message}</p>}
    {creating && <form onSubmit={create} className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-3"><select required className={input} value={form.colaboracion_id} onChange={e => setForm({...form,colaboracion_id:e.target.value})}><option value="">Empresa colaboradora</option>{collaborations.filter(x => x.empresa_contratista === company && x.obra_nombre === obra.nombre).map(x => <option key={x.id} value={x.id}>{x.empresa_colaboradora} · {x.rut_colaboradora}</option>)}</select><input required className={input} placeholder="Código contrato" value={form.codigo} onChange={e => setForm({...form,codigo:e.target.value})}/><input required className={input} placeholder="Nombre / alcance" value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})}/><input className={input} type="number" min="0" placeholder="Monto" value={form.monto_contrato} onChange={e => setForm({...form,monto_contrato:e.target.value})}/><input className={input} type="date" value={form.fecha_inicio} onChange={e => setForm({...form,fecha_inicio:e.target.value})}/><input className={input} type="date" value={form.fecha_termino} onChange={e => setForm({...form,fecha_termino:e.target.value})}/><button className="rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white md:col-span-3">Crear y enviar a contraparte</button></form>}
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]"><div className="space-y-2">{contracts.map(c => <button key={c.id} onClick={() => open(c)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id === c.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white'}`}><span className="text-[10px] font-black uppercase text-indigo-700">{c.codigo} · {c.estado}</span><p className="mt-1 font-black">{c.nombre}</p><p className="text-[11px] text-slate-500">{c.empresa_contratista} ↔ {c.empresa_colaboradora}</p></button>)}{!contracts.length && <p className="rounded-2xl border bg-white p-6 text-center text-xs text-slate-500">Sin contratos para esta obra.</p>}</div>
      {selected && <div className="space-y-3 rounded-2xl border bg-white p-5"><div className="border-b pb-3"><h4 className="font-black">{selected.codigo} · {selected.nombre}</h4><p className="text-xs text-slate-500">{selected.obra_contratista_nombre} ↔ {selected.obra_colaboradora_nombre || 'Obra colaboradora pendiente'}</p></div>{selected.empresa_colaboradora === company && !selected.obra_colaboradora_id && <select className={input} defaultValue="" onChange={e => e.target.value && accept(e.target.value)}><option value="">Selecciona tu obra y acepta el contrato…</option>{works.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}</select>}{selected.obra_colaboradora_id && <><form onSubmit={mapParts} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2"><select required className={input} value={mapping.partida_contratista_id} onChange={e => setMapping({...mapping,partida_contratista_id:e.target.value})}><option value="">Partida obra principal</option>{parts.principal.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.partida}</option>)}</select><select required className={input} value={mapping.partida_colaboradora_id} onChange={e => setMapping({...mapping,partida_colaboradora_id:e.target.value})}><option value="">Partida obra colaboradora</option>{parts.collaborator.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.partida}</option>)}</select><input required className={input} type="number" min="0" step="any" placeholder="Cantidad contratada" value={mapping.cantidad_contratada} onChange={e => setMapping({...mapping,cantidad_contratada:e.target.value})}/><div className="grid grid-cols-2 gap-2"><input className={input} type="number" min="0.000001" step="any" placeholder="Factor" value={mapping.factor_conversion} onChange={e => setMapping({...mapping,factor_conversion:e.target.value})}/><input className={input} type="number" min="0" max="100" step="any" placeholder="Ponderación %" value={mapping.ponderacion} onChange={e => setMapping({...mapping,ponderacion:e.target.value})}/></div><button className="flex items-center justify-center gap-2 rounded-xl bg-indigo-900 py-2.5 text-xs font-black text-white md:col-span-2"><Link2 className="h-4 w-4"/>Proponer enlace</button></form><div className="space-y-2">{links.map(x => <div key={x.id} className="grid items-center gap-2 rounded-xl border p-3 md:grid-cols-[1fr_auto_1fr_auto]"><p className="text-xs font-bold">{x.nombre_contratista}</p><ArrowRightLeft className="hidden h-4 w-4 text-indigo-500 md:block"/><div><p className="text-xs font-bold">{x.nombre_colaboradora}</p><small className="text-slate-500">{x.cantidad_contratada} {x.unidad_contratista || ''} · factor {x.factor_conversion}</small></div><div className="flex items-center gap-1"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black">{x.estado}</span>{x.estado !== 'Aceptado' && <button onClick={() => approveLink(x)} className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4"/></button>}</div></div>)}</div></>}</div>}
    </div>
    {selected?.estado === 'Activo' && selected.empresa_colaboradora === company && <CollaborativeSubmissions contract={selected} links={links.filter(x => x.estado === 'Aceptado')} user={user} onMessage={setMessage}/>} 
  </div>;
}

function CollaborativeSubmissions({ contract, links, user, onMessage }) {
  const [type, setType] = useState('avance');
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10) });

  const submit = async event => {
    event.preventDefault();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) return onMessage('Tu sesión debe estar autenticada.');
    const common = {
      contrato_colaborativo_id: contract.id, subcontrato_nombre: contract.empresa_colaboradora,
      empresa: contract.empresa_contratista, empresa_origen: contract.empresa_colaboradora,
      obra_nombre: contract.obra_contratista_nombre, obra_origen_id: contract.obra_colaboradora_id,
      enviado_por_auth_id: authData.user.id, estado: 'Enviado'
    };
    let table; let payload;
    if (type === 'avance') {
      const link = links.find(x => String(x.id) === String(form.enlace_partida_id));
      if (!link) return onMessage('Selecciona una partida enlazada y aceptada.');
      table = 'subcontrato_avances';
      payload = { ...common, fecha: form.fecha, enlace_partida_id: link.id, partida_nombre: link.nombre_contratista, cantidad: Number(form.cantidad) || 0, unidad: link.unidad_contratista, comentario: form.comentario || null };
    } else if (type === 'asistencia') {
      table = 'subcontrato_asistencia';
      payload = { ...common, fecha: form.fecha, presentes: Number(form.presentes) || 0, ausentes: Number(form.ausentes) || 0, horas_hombre: Number(form.horas_hombre) || 0 };
    } else {
      table = 'subcontrato_estados_pago';
      payload = { ...common, numero: Number(form.numero), periodo_desde: form.periodo_desde, periodo_hasta: form.periodo_hasta, monto_presentado: Number(form.monto_presentado) || 0, factura_folio: form.factura_folio || null, observaciones: form.observaciones || null };
    }
    const { error } = await supabase.from(table).insert(payload);
    if (error) return onMessage(error.message);
    await supabase.from('contratos_colaborativos_eventos').insert({ contrato_id: contract.id, empresa: contract.empresa_colaboradora, accion: type === 'avance' ? 'Avance enviado' : type === 'asistencia' ? 'Asistencia enviada' : 'Estado de pago enviado', estado_resultante: 'Enviado', actor_nombre: who(user) });
    onMessage('Información enviada a la empresa contratista con trazabilidad contractual.');
    setForm({ fecha: new Date().toISOString().slice(0, 10) });
  };

  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Operación desde tu propia obra</p><h4 className="font-black">Enviar información contractual</h4></div><div className="flex gap-1">{[['avance','Avance'],['asistencia','Asistencia'],['pago','Estado de pago']].map(([id,label]) => <button key={id} type="button" onClick={() => { setType(id); setForm({ fecha: new Date().toISOString().slice(0, 10) }); }} className={`rounded-lg px-3 py-2 text-[10px] font-black ${type === id ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700'}`}>{label}</button>)}</div></div><form onSubmit={submit} className="mt-4 grid gap-2 md:grid-cols-2"><input required type="date" className={input} value={form.fecha || ''} onChange={e => setForm({...form,fecha:e.target.value})}/>{type === 'avance' && <><select required className={input} value={form.enlace_partida_id || ''} onChange={e => setForm({...form,enlace_partida_id:e.target.value})}><option value="">Partida contratada</option>{links.map(x => <option key={x.id} value={x.id}>{x.nombre_colaboradora} → {x.nombre_contratista}</option>)}</select><input required type="number" min="0" step="any" className={input} placeholder="Cantidad ejecutada" value={form.cantidad || ''} onChange={e => setForm({...form,cantidad:e.target.value})}/><input className={input} placeholder="Comentario" value={form.comentario || ''} onChange={e => setForm({...form,comentario:e.target.value})}/></>}{type === 'asistencia' && <><input required type="number" min="0" className={input} placeholder="Presentes" value={form.presentes || ''} onChange={e => setForm({...form,presentes:e.target.value})}/><input type="number" min="0" className={input} placeholder="Ausentes" value={form.ausentes || ''} onChange={e => setForm({...form,ausentes:e.target.value})}/><input type="number" min="0" step=".5" className={input} placeholder="Horas hombre" value={form.horas_hombre || ''} onChange={e => setForm({...form,horas_hombre:e.target.value})}/></>}{type === 'pago' && <><input required type="number" min="1" className={input} placeholder="N° estado de pago" value={form.numero || ''} onChange={e => setForm({...form,numero:e.target.value})}/><input required type="date" className={input} value={form.periodo_desde || ''} onChange={e => setForm({...form,periodo_desde:e.target.value})}/><input required type="date" className={input} value={form.periodo_hasta || ''} onChange={e => setForm({...form,periodo_hasta:e.target.value})}/><input required type="number" min="0" className={input} placeholder="Monto presentado" value={form.monto_presentado || ''} onChange={e => setForm({...form,monto_presentado:e.target.value})}/><input className={input} placeholder="Folio factura (si existe)" value={form.factura_folio || ''} onChange={e => setForm({...form,factura_folio:e.target.value})}/><input className={input} placeholder="Observaciones" value={form.observaciones || ''} onChange={e => setForm({...form,observaciones:e.target.value})}/></>}<button className="rounded-xl bg-emerald-800 py-3 text-xs font-black text-white md:col-span-2">Enviar a la contratista</button></form></section>;
}
