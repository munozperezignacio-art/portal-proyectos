import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, Download, ExternalLink, FileText,
  Plus, ReceiptText, Settings2, TrendingUp, Upload, Users, XCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';

const money = value => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const actorName = user => user?.nombre || user?.usuario || user?.correo || 'Usuario Obraxis';
const safeName = value => String(value || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');

export default function SubcontratosObra({ obra, user }) {
  const { permissions } = useUserPermissions(user);
  const [subs, setSubs] = useState([]);
  const [avances, setAvances] = useState([]);
  const [asistencia, setAsistencia] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [requisitos, setRequisitos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [tab, setTab] = useState('resumen');
  const [selectedEP, setSelectedEP] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [reqForm, setReqForm] = useState({ codigo: '', nombre: '', categoria: 'Contractual', obligatorio: true, requiere_vigencia: false });

  const mayReview = can(user, permissions, 'obras.subcontratos.revisar');
  const mayApprove = can(user, permissions, 'obras.subcontratos.aprobar');
  const mayConfigure = can(user, permissions, 'obras.subcontratos.configurar');

  const load = async () => {
    const [s, a, attendance, p, r, d] = await Promise.all([
      supabase.from('acreditaciones_subcontratos').select('*').eq('obra_asociada', obra.nombre).neq('estado', 'Archivado'),
      supabase.from('subcontrato_avances').select('*').eq('obra_nombre', obra.nombre).order('fecha', { ascending: false }),
      supabase.from('subcontrato_asistencia').select('*').eq('obra_nombre', obra.nombre).order('fecha', { ascending: false }),
      supabase.from('subcontrato_estados_pago').select('*').eq('obra_nombre', obra.nombre).order('created_at', { ascending: false }),
      supabase.from('subcontrato_ep_requisitos').select('*').eq('empresa', user.empresa).eq('activo', true).order('orden'),
      supabase.from('subcontrato_ep_documentos').select('*').order('created_at', { ascending: false })
    ]);
    setSubs(s.data || []); setAvances(a.data || []); setAsistencia(attendance.data || []); setPagos(p.data || []);
    setRequisitos((r.data || []).filter(item => !item.obra_nombre || item.obra_nombre === obra.nombre));
    setDocumentos(d.data || []);
  };

  useEffect(() => { load(); }, [obra.nombre, user.empresa]);

  const requirementsFor = ep => requisitos.filter(r => !r.obra_nombre || r.obra_nombre === ep.obra_nombre);
  const documentsFor = ep => documentos.filter(d => d.estado_pago_id === ep.id);
  const progressFor = ep => {
    const required = requirementsFor(ep).filter(r => r.obligatorio);
    const approved = required.filter(r => documentsFor(ep).some(d => d.requisito_id === r.id && d.estado === 'Aprobado')).length;
    return { required: required.length, approved, complete: required.length > 0 && approved === required.length };
  };

  const queueNotification = async (code, ep, payload = {}) => {
    const { data: rules } = await supabase.from('notificaciones_reglas').select('*').eq('empresa', user.empresa).eq('evento_codigo', code).eq('activa', true);
    if (!rules?.length) return;
    await supabase.from('notificaciones_entregas').insert(rules.map(rule => ({
      regla_id: rule.id, empresa: user.empresa, evento_codigo: code, obra_nombre: ep.obra_nombre,
      canal: rule.canal_plataforma ? 'Plataforma' : 'Email', destinatario: 'Destinatarios configurados',
      asunto: `Estado de Pago N° ${ep.numero} · ${ep.subcontrato_nombre}`, estado: 'Pendiente', payload: { estado_pago_id: ep.id, ...payload }
    })));
  };

  const uploadDocument = async (ep, requisito, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return setMsg('El archivo supera el máximo de 15 MB.');
    setBusy(`upload-${requisito.id}`); setMsg('');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) { setBusy(''); return setMsg('La sesión debe estar autenticada para cargar documentos.'); }
    const previous = documentsFor(ep).find(d => d.requisito_id === requisito.id);
    const path = `${authData.user.id}/${ep.id}/${requisito.id}-${Date.now()}-${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from('subcontratos-estados-pago').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setBusy(''); return setMsg(uploadError.message); }
    const payload = {
      estado_pago_id: ep.id, requisito_id: requisito.id, archivo_nombre: file.name, archivo_path: path,
      mime_type: file.type, tamano_bytes: file.size, estado: 'Pendiente', observacion_revision: null,
      cargado_por: actorName(user), version: Number(previous?.version || 0) + 1, updated_at: new Date().toISOString()
    };
    const query = previous
      ? supabase.from('subcontrato_ep_documentos').update(payload).eq('id', previous.id).select().single()
      : supabase.from('subcontrato_ep_documentos').insert(payload).select().single();
    const { data: saved, error } = await query;
    if (error) { setBusy(''); return setMsg(error.message); }
    await queueNotification('ep_subcontrato_documentos_pendientes', ep, { requisito: requisito.nombre, documento_id: saved.id });
    setMsg(`${requisito.nombre}: archivo cargado y enviado a revisión.`); setBusy(''); await load();
  };

  const openDocument = async document => {
    const { data, error } = await supabase.storage.from('subcontratos-estados-pago').createSignedUrl(document.archivo_path, 180);
    if (error) return setMsg(error.message);
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const reviewDocument = async (ep, document, nextState) => {
    if (!mayReview) return setMsg('Tu rol no tiene permiso para revisar documentos.');
    const observation = ['Observado', 'Rechazado'].includes(nextState) ? window.prompt('Indica claramente qué debe corregirse:') : '';
    if (['Observado', 'Rechazado'].includes(nextState) && !observation?.trim()) return;
    setBusy(`review-${document.id}`);
    const { data: resultingState, error } = await supabase.rpc('revisar_documento_ep_subcontrato', { p_documento_id: document.id, p_estado: nextState, p_observacion: observation || null });
    if (error) { setBusy(''); return setMsg(error.message); }
    const code = nextState === 'Aprobado' ? 'ep_subcontrato_documentos_pendientes' : 'ep_subcontrato_documento_observado';
    await queueNotification(code, ep, { documento_id: document.id, estado: nextState, observacion: observation });
    setBusy(''); await load();
    if (resultingState === 'Expediente aprobado') {
      await queueNotification('ep_subcontrato_expediente_aprobado', ep);
      setMsg('Expediente completo. El estado de pago ya puede pasar a aprobación.');
    } else setMsg(`Documento marcado como ${nextState.toLowerCase()}.`);
  };

  const approve = async ep => {
    if (!mayApprove) return setMsg('Tu rol no tiene permiso para aprobar estados de pago.');
    if (!ep.factura_folio) return setMsg('Para reconocer el costo real debe existir una factura asociada.');
    const { error } = await supabase.rpc('aprobar_ep_subcontrato_y_cargar_costo', { p_estado_pago_id: ep.id, p_aprobado_por: actorName(user) });
    if (error) return setMsg(error.message);
    setMsg('Estado de pago aprobado y cargado una sola vez como costo real.'); load();
  };

  const addRequirement = async event => {
    event.preventDefault();
    if (!mayConfigure) return setMsg('Tu rol no puede configurar requisitos documentales.');
    const maxOrder = requisitos.reduce((max, r) => Math.max(max, Number(r.orden) || 0), 0);
    const { error } = await supabase.from('subcontrato_ep_requisitos').insert({ ...reqForm, codigo: reqForm.codigo.trim().toUpperCase(), nombre: reqForm.nombre.trim(), empresa: user.empresa, obra_nombre: obra.nombre, orden: maxOrder + 10 });
    if (error) return setMsg(error.message);
    setReqForm({ codigo: '', nombre: '', categoria: 'Contractual', obligatorio: true, requiere_vigencia: false }); setMsg('Requisito agregado a esta obra.'); load();
  };

  const toggleRequirement = async requirement => {
    if (!mayConfigure) return;
    const { error } = await supabase.from('subcontrato_ep_requisitos').update({ obligatorio: !requirement.obligatorio }).eq('id', requirement.id);
    if (error) return setMsg(error.message); load();
  };

  const approved = pagos.filter(payment => payment.estado === 'Aprobado').reduce((sum, payment) => sum + Number(payment.monto_aprobado || payment.monto_presentado || 0), 0);
  const portal = subcontract => `${window.location.origin}/?acreditacion_subcontrato=${encodeURIComponent(subcontract.empresa_nombre)}&token=${encodeURIComponent(subcontract.token_acceso)}`;

  return <div className="space-y-4">
    <div className="rounded-3xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Gestión de subcontratos de la obra</h3><p className="text-xs text-slate-500">Avances, dotación, asistencia, expedientes documentales y estados de pago.</p></div><div className="flex flex-wrap gap-2">{[['resumen','Resumen'],['avances','Avances'],['asistencia','Asistencia'],['pagos','Estados de pago']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-3 py-2 text-xs font-black ${tab === id ? 'bg-slate-950 text-white' : 'bg-slate-100'}`}>{label}</button>)}</div></div></div>
    {msg && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900">{msg}</div>}
    {tab === 'resumen' && <><div className="grid gap-3 md:grid-cols-4">{[[Building2,'Empresas',subs.length],[TrendingUp,'Reportes de avance',avances.length],[Users,'Asistencias informadas',asistencia.reduce((sum,x) => sum + Number(x.presentes || 0),0)],[ReceiptText,'Aprobado',money(approved)]].map(([Icon,label,value]) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon className="h-5 w-5 text-blue-800"/><p className="mt-3 text-[10px] font-black uppercase text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div>)}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{subs.map(sub => <div key={sub.id} className="rounded-2xl border bg-white p-4"><b>{sub.empresa_nombre}</b><p className="text-xs text-slate-500">{sub.rut_empresa} · {sub.estado}</p><a href={portal(sub)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-[10px] font-black text-blue-800"><ExternalLink className="h-3 w-3"/>Portal operacional</a></div>)}</div></>}
    {tab === 'avances' && <Table heads={['Fecha','Subcontrato','Partida / actividad','Cantidad','Comentario']} rows={avances.map(x => [x.fecha,x.subcontrato_nombre,x.partida_nombre || x.actividad,`${x.cantidad} ${x.unidad || ''}`,x.comentario || '—'])}/>} 
    {tab === 'asistencia' && <Table heads={['Fecha','Subcontrato','Presentes','Ausentes','HH']} rows={asistencia.map(x => [x.fecha,x.subcontrato_nombre,x.presentes,x.ausentes || 0,x.horas_hombre || 0])}/>} 
    {tab === 'pagos' && <div className="space-y-3">
      <div className="flex justify-end">{mayConfigure && <button onClick={() => setConfigOpen(!configOpen)} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-black"><Settings2 className="h-4 w-4"/>Configurar carpeta documental</button>}</div>
      {configOpen && <RequirementConfig requisitos={requisitos} form={reqForm} setForm={setReqForm} onAdd={addRequirement} onToggle={toggleRequirement}/>} 
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-slate-100"><tr>{['N°','Subcontrato','Período','Presentado','Factura','Documentos','Estado','Acción'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody className="divide-y">{pagos.map(ep => { const progress = progressFor(ep); return <tr key={ep.id}><td className="p-3 font-black">{ep.numero}</td><td>{ep.subcontrato_nombre}</td><td>{ep.periodo_desde} — {ep.periodo_hasta}</td><td>{money(ep.monto_presentado)}</td><td>{ep.factura_folio || 'Pendiente'}</td><td><button onClick={() => setSelectedEP(ep)} className={`rounded-lg px-2 py-1.5 font-black ${progress.complete ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{progress.approved} de {progress.required} obligatorios</button></td><td>{ep.estado}</td><td>{ep.estado !== 'Aprobado' && <button onClick={() => approve(ep)} disabled={!progress.complete} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 className="h-3 w-3"/>Aprobar y cargar costo</button>}</td></tr>; })}</tbody></table>{!pagos.length && <p className="p-8 text-center text-slate-500">Aún no existen estados de pago.</p>}</div>
    </div>}
    {selectedEP && <DocumentDossier ep={selectedEP} requisitos={requirementsFor(selectedEP)} documentos={documentsFor(selectedEP)} busy={busy} mayReview={mayReview} onClose={() => setSelectedEP(null)} onUpload={uploadDocument} onOpen={openDocument} onReview={reviewDocument}/>} 
  </div>;
}

function RequirementConfig({ requisitos, form, setForm, onAdd, onToggle }) {
  return <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3"><h4 className="font-black text-blue-950">Requisitos documentales de esta obra</h4><p className="text-[11px] text-blue-800">La base legal y contractual es configurable. Los cambios aplican a los estados de pago de la obra.</p></div><div className="grid gap-2 md:grid-cols-2">{requisitos.map(r => <div key={r.id} className="flex items-center justify-between rounded-xl bg-white p-3"><div><p className="text-xs font-black">{r.codigo} · {r.nombre}</p><p className="text-[10px] text-slate-500">{r.categoria} · {r.fundamento || 'Definido por la empresa'}</p></div><button onClick={() => onToggle(r)} className={`rounded-lg px-2 py-1 text-[10px] font-black ${r.obligatorio ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{r.obligatorio ? 'Obligatorio' : 'Complementario'}</button></div>)}</div><form onSubmit={onAdd} className="mt-4 grid gap-2 rounded-xl bg-white p-3 md:grid-cols-5"><input required value={form.codigo} onChange={e => setForm({...form,codigo:e.target.value})} placeholder="Código" className="rounded-lg border px-3 py-2 text-xs"/><input required value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})} placeholder="Nombre del documento" className="rounded-lg border px-3 py-2 text-xs md:col-span-2"/><select value={form.categoria} onChange={e => setForm({...form,categoria:e.target.value})} className="rounded-lg border px-3 py-2 text-xs"><option>Legal</option><option>Laboral y previsional</option><option>Tributario</option><option>Contractual</option><option>Operacional</option></select><button className="flex items-center justify-center gap-1 rounded-lg bg-blue-900 px-3 py-2 text-xs font-black text-white"><Plus className="h-3 w-3"/>Agregar</button></form></section>;
}

function DocumentDossier({ ep, requisitos, documentos, busy, mayReview, onClose, onUpload, onOpen, onReview }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"><div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b pb-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Expediente documental</p><h3 className="text-xl font-black">Estado de Pago N° {ep.numero} · {ep.subcontrato_nombre}</h3><p className="text-xs text-slate-500">Período {ep.periodo_desde} al {ep.periodo_hasta}. La aprobación final exige que todos los documentos obligatorios estén aprobados.</p></div><button onClick={onClose} className="rounded-xl bg-slate-100 p-2"><XCircle className="h-5 w-5"/></button></div><div className="mt-4 space-y-2">{requisitos.map(req => { const doc = documentos.find(d => d.requisito_id === req.id); return <div key={req.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[1.4fr_1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black">{req.codigo} · {req.nombre}</span>{req.obligatorio && <span className="rounded-md bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700">OBLIGATORIO</span>}<span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">{req.categoria}</span></div><p className="mt-1 text-[11px] text-slate-500">{req.descripcion}</p>{doc?.observacion_revision && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-bold text-amber-900"><AlertTriangle className="mr-1 inline h-3 w-3"/>{doc.observacion_revision}</p>}</div><div>{doc ? <><button onClick={() => onOpen(doc)} className="flex items-center gap-2 text-left text-xs font-bold text-blue-800"><FileText className="h-4 w-4"/><span>{doc.archivo_nombre}<small className="block font-normal text-slate-500">Versión {doc.version} · {doc.estado}</small></span><Download className="h-3 w-3"/></button><label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black"><Upload className="h-3 w-3"/>Reemplazar<input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx" className="hidden" onChange={e => onUpload(ep,req,e.target.files?.[0])}/></label></> : <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-900 px-3 py-2 text-xs font-black text-white"><Upload className="h-4 w-4"/>{busy === `upload-${req.id}` ? 'Cargando...' : 'Subir documento'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx" className="hidden" onChange={e => onUpload(ep,req,e.target.files?.[0])}/></label>}</div><div className="flex flex-wrap items-center justify-end gap-1">{doc && mayReview && <><button disabled={busy === `review-${doc.id}`} onClick={() => onReview(ep,doc,'Aprobado')} className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700">Aprobar</button><button onClick={() => onReview(ep,doc,'Observado')} className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-black text-amber-800">Observar</button><button onClick={() => onReview(ep,doc,'Rechazado')} className="rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-black text-rose-700">Rechazar</button></>}</div></div>; })}{!requisitos.length && <p className="p-8 text-center text-slate-500">Configura primero los requisitos de la carpeta documental.</p>}</div></div></div>;
}

function Table({ heads, rows }) { return <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-100"><tr>{heads.map(head => <th key={head} className="p-3">{head}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-slate-500">Aún no existen registros.</p>}</div>; }
