import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCheck2, Mail, Plus, RefreshCw, Repeat2, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { registrarEventoBitacora } from '../utils/bitacoraService';
import { appendAudit, auditActor } from '../utils/documentAudit';
import DocumentAuditTrail from './DocumentAuditTrail';
import ModuleHeader from './ModuleHeader';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';
import { canTransitionNonConformity, nextNonConformityState } from '../utils/workflowRules';

const initialPac = { partida: '', procedimiento: '', criterios: '', puntos_inspeccion: '', puntos_espera: '', responsable: '' };
const initialRdi = { partida: '', pac_id: '', sector: '', cantidad: '', unidad: '', solicitado_por: '', inspector: '', observaciones: '' };
const initialNc = { partida: '', rdi_id: '', descripcion: '', clasificacion: 'Menor', origen: 'Ejecución', impacto: 'Calidad', responsable: '', fecha_compromiso: '', correccion_inmediata: '', metodo_causa_raiz: '5 Porqués', causa_categoria: 'Método / Procedimiento', causa_raiz: '', accion_correctiva: '' };
const CAUSA_CATEGORIAS = ['Método / Procedimiento', 'Mano de obra', 'Material', 'Maquinaria / Equipo', 'Medición / Inspección', 'Diseño / Información', 'Entorno', 'Gestión / Coordinación'];
const NC_ORIGENES = ['Ejecución', 'Recepción de partida', 'RDI', 'Inspección', 'Auditoría', 'Reclamo del cliente', 'Proveedor / Subcontrato'];
const NC_IMPACTOS = ['Calidad', 'Plazo', 'Costo', 'Seguridad', 'Medio ambiente', 'Cliente'];
const initialReception = { partida: '', rdi_id: '', fecha_entrega: new Date().toISOString().slice(0, 10), cantidad: '', unidad: '', sector: '', entrega_por: '', recibe_por: '', observaciones: '', controles_manual: '' };

const splitControlPoints = (value) => String(value || '').split(/\r?\n|;+/).map(item => item.replace(/^[\s•\-\d.)]+/, '').trim()).filter(Boolean);
const protocolFromPac = (pac, manualControls = '') => {
  const controls = [];
  if (pac?.criterios?.trim()) controls.push({ tipo: 'Criterio de aceptación', punto: pac.criterios.trim() });
  splitControlPoints(pac?.puntos_inspeccion).forEach(punto => controls.push({ tipo: 'Punto de inspección', punto }));
  splitControlPoints(pac?.puntos_espera).forEach(punto => controls.push({ tipo: 'Punto de espera / liberación', punto }));
  splitControlPoints(manualControls).forEach(punto => controls.push({ tipo: 'Control manual', punto }));
  return controls.filter((item, index, list) => list.findIndex(other => other.tipo === item.tipo && other.punto === item.punto) === index);
};

const receptionStatusFromControls = (controls) => {
  if (!controls.length || controls.some(control => control.resultado === 'Pendiente')) return 'Pendiente de recepción';
  if (controls.some(control => control.resultado === 'Rechazado')) return 'Rechazada';
  if (controls.some(control => control.resultado === 'Observado')) return 'Recibida con observaciones';
  return 'Recibida conforme';
};

const statusClass = (status) => ({
  Aprobada: 'bg-emerald-100 text-emerald-800', Cerrada: 'bg-emerald-100 text-emerald-800',
  Conforme: 'bg-emerald-100 text-emerald-800', 'Recibida conforme': 'bg-emerald-100 text-emerald-800',
  Rechazada: 'bg-rose-100 text-rose-800', Abierta: 'bg-rose-100 text-rose-800',
  Observada: 'bg-amber-100 text-amber-800', 'Recibida con observaciones': 'bg-amber-100 text-amber-800',
  Pendiente: 'bg-slate-100 text-slate-700', 'Pendiente de recepción': 'bg-slate-100 text-slate-700', 'No aplica': 'bg-slate-100 text-slate-700', Enviada: 'bg-blue-100 text-blue-800',
  Borrador: 'bg-slate-100 text-slate-700', 'En corrección': 'bg-amber-100 text-amber-800',
}[status] || 'bg-slate-100 text-slate-700');

export default function CalidadObras({ user, onBack, obraInicial = '', embedded = false, obraPerfil = null }) {
  const [tab, setTab] = useState('resumen');
  const [obras, setObras] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [obraNombre, setObraNombre] = useState('');
  const [pacs, setPacs] = useState([]);
  const [rdis, setRdis] = useState([]);
  const [ncs, setNcs] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [procedimientosEmpresa, setProcedimientosEmpresa] = useState([]);
  const [receptionControls, setReceptionControls] = useState([]);
  const [expandedReceptionId, setExpandedReceptionId] = useState(null);
  const [protocolAvailable, setProtocolAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pacForm, setPacForm] = useState(initialPac);
  const [rdiForm, setRdiForm] = useState(initialRdi);
  const [ncForm, setNcForm] = useState(initialNc);
  const [receptionForm, setReceptionForm] = useState(initialReception);
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);

  const empresa = user?.empresa || null;
  const canView = can(user, permissions, 'obras.calidad.ver');
  const canCreate = can(user, permissions, 'obras.calidad.crear');
  const canEdit = can(user, permissions, 'obras.calidad.editar');
  const canSend = can(user, permissions, 'obras.calidad.enviar');
  const canReview = can(user, permissions, 'obras.calidad.revisar');
  const canApprove = can(user, permissions, 'obras.calidad.aprobar');
  const partidasEjecutables = useMemo(() => partidas.filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)), [partidas]);
  const pacPorPartida = useMemo(() => new Map(pacs.map(p => [p.partida, p])), [pacs]);
  const controlsByReception = useMemo(() => receptionControls.reduce((result, control) => {
    result[control.recepcion_id] = [...(result[control.recepcion_id] || []), control];
    return result;
  }, {}), [receptionControls]);
  const receptionPac = pacPorPartida.get(receptionForm.partida);
  const rdisPendientes = rdis.filter(r => ['Borrador', 'Enviada', 'Observada'].includes(r.estado));
  const ncsAbiertas = ncs.filter(n => !['Cerrada', 'Verificada'].includes(n.estado));
  const ncVencidas = ncsAbiertas.filter(n => n.fecha_compromiso && n.fecha_compromiso < new Date().toISOString().slice(0, 10));
  const recurrence = useMemo(() => {
    const groups = new Map();
    ncs.forEach(nc => {
      const key = `${String(nc.partida || 'Sin partida').trim().toLowerCase()}|${nc.causa_categoria || 'Sin clasificar'}`;
      const current = groups.get(key) || { partida: nc.partida || 'Sin partida', causa: nc.causa_categoria || 'Sin clasificar', total: 0, abiertas: 0, ultima: '' };
      current.total += 1;
      if (!['Cerrada', 'Verificada'].includes(nc.estado)) current.abiertas += 1;
      current.ultima = String(nc.created_at || '') > current.ultima ? String(nc.created_at || '') : current.ultima;
      groups.set(key, current);
    });
    return [...groups.values()].filter(item => item.total > 1).sort((a, b) => b.total - a.total || b.abiertas - a.abiertas);
  }, [ncs]);
  const obraActiva = useMemo(() => obraPerfil?.nombre === obraNombre ? obraPerfil : obras.find(obra => obra.nombre === obraNombre) || null, [obraPerfil, obras, obraNombre]);
  const clientName = obraActiva?.cliente || '';
  const clientEmail = obraActiva?.cliente_email || '';
  const clientPhone = obraActiva?.cliente_telefono || '';

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [{ data: obrasData, error: obrasError }, { data: procedimientosData, error: procedimientosError }] = await Promise.all([
        supabase.from('obras').select('id, nombre, cliente, cliente_email, cliente_telefono, admin_contrato').eq('empresa', empresa).order('nombre'),
        supabase.from('prevencion_procedimientos').select('*').eq('empresa', empresa).order('codigo')
      ]);
      if (obrasError) throw obrasError;
      if (procedimientosError) throw procedimientosError;
      setProcedimientosEmpresa(procedimientosData || []);
      const nextObras = obrasData || [];
      setObras(nextObras);
      const target = obraInicial || obraNombre || nextObras[0]?.nombre || '';
      const targetWork = nextObras.find(item => item.nombre === target);
      if (!obraNombre && target) setObraNombre(target);
      if (!target) { setPacs([]); setRdis([]); setNcs([]); setRecepciones([]); setReceptionControls([]); setPartidas([]); return; }
      const partidasQuery = targetWork?.id
        ? supabase.from('partidas_obra').select('partida, unidad').eq('empresa', empresa).eq('obra_id', targetWork.id)
        : supabase.from('partidas_obra').select('partida, unidad').eq('empresa', empresa).eq('obra_nombre', target);
      const [partidasRes, pacRes, rdiRes, ncRes, receptionRes, controlsRes] = await Promise.all([
        partidasQuery,
        supabase.from('calidad_pac').select('*').eq('empresa', empresa).eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_rdi').select('*').eq('empresa', empresa).eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_no_conformidades').select('*').eq('empresa', empresa).eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_recepciones_partidas').select('*').eq('empresa', empresa).eq('obra_nombre', target).order('created_at', { ascending: false }),
        supabase.from('calidad_recepcion_controles').select('*').order('created_at'),
      ]);
      if (partidasRes.error) throw partidasRes.error;
      if (pacRes.error || rdiRes.error || ncRes.error || receptionRes.error) throw (pacRes.error || rdiRes.error || ncRes.error || receptionRes.error);
      const missingProtocolTable = controlsRes.error?.message?.includes('calidad_recepcion_controles');
      if (controlsRes.error && !missingProtocolTable) throw controlsRes.error;
      setProtocolAvailable(!missingProtocolTable);
      const nextReceptions = receptionRes.data || [];
      const receptionIds = new Set(nextReceptions.map(item => item.id));
      setPartidas(partidasRes.data || []); setPacs(pacRes.data || []); setRdis(rdiRes.data || []); setNcs(ncRes.data || []); setRecepciones(nextReceptions); setReceptionControls((controlsRes.data || []).filter(control => receptionIds.has(control.recepcion_id)));
    } catch (error) {
      setMessage(error.message?.includes('calidad_') ? 'Calidad no está habilitada correctamente para esta empresa. Solicita al administrador revisar la configuración de Supabase.' : `No fue posible cargar Calidad: ${error.message}`);
    } finally { setLoading(false); }
  }, [empresa, obraInicial, obraNombre]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (obraInicial && obraInicial !== obraNombre) setObraNombre(obraInicial); }, [obraInicial, obraNombre]);
  useEffect(() => {
    if (obraActiva && !rdiForm.inspector) setRdiForm(current => ({ ...current, inspector: obraActiva.admin_contrato || obraActiva.cliente || '' }));
  }, [obraActiva, rdiForm.inspector]);

  const savePac = async (e) => {
    e.preventDefault();
    if (!canCreate) { setMessage('Tu perfil no está autorizado para crear PAC.'); return; }
    try {
      const { error } = await supabase.from('calidad_pac').insert({ empresa, obra_nombre: obraNombre, ...pacForm, estado: 'Activo' });
      if (error) throw error;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: 'PAC creado', detalle: `${pacForm.procedimiento} · ${pacForm.partida}`, actor: pacForm.responsable || user?.nombre || user?.email });
      setPacForm(initialPac); setMessage('PAC creado y disponible para solicitudes RDI.'); await load();
    } catch (error) { setMessage(`No se pudo guardar el PAC: ${error.message}`); }
  };
  const saveRdi = async (e) => {
    e.preventDefault();
    if (!(canCreate && canSend)) { setMessage('Tu perfil no está autorizado para crear y enviar solicitudes RDI.'); return; }
    try {
      const codigo = `RDI-${new Date().getFullYear()}-${String(rdis.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('calidad_rdi').insert({ empresa, obra_nombre: obraNombre, ...rdiForm, codigo, estado: 'Enviada', fecha_solicitud: new Date().toISOString().slice(0, 10), trazabilidad: [auditActor(user, 'Solicitud RDI emitida', 'Enviada', `${rdiForm.partida} · ${rdiForm.sector}`)] });
      if (error) throw error;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${codigo} enviada a inspección`, detalle: `${rdiForm.partida} · ${rdiForm.cantidad || 0} ${rdiForm.unidad || ''} · ${rdiForm.sector}`, actor: rdiForm.solicitado_por || user?.nombre || user?.email });
      setRdiForm(initialRdi); setMessage(`${codigo} enviada a inspección.`); await load();
    } catch (error) { setMessage(`No se pudo registrar la RDI: ${error.message}`); }
  };
  const saveNc = async (e) => {
    e.preventDefault();
    if (!canCreate) { setMessage('Tu perfil no está autorizado para registrar no conformidades.'); return; }
    try {
      const codigo = `NC-${new Date().getFullYear()}-${String(ncs.length + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('calidad_no_conformidades').insert({ empresa, obra_nombre: obraNombre, ...ncForm, codigo, estado: 'Abierta', trazabilidad: [auditActor(user, 'No conformidad abierta', 'Abierta', `${ncForm.clasificacion} · ${ncForm.partida}`)] });
      if (error) throw error;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${codigo} abierta`, detalle: `${ncForm.partida || 'Sin partida'} · ${ncForm.descripcion}`, actor: ncForm.responsable || user?.nombre || user?.email });
      setNcForm(initialNc); setMessage(`${codigo} registrada para seguimiento.`); await load();
    } catch (error) { setMessage(`No se pudo registrar la no conformidad: ${error.message}`); }
  };
  const saveReception = async (e) => {
    e.preventDefault();
    if (!canCreate) { setMessage('Tu perfil no está autorizado para entregar partidas a recepción.'); return; }
    try {
      const codigo = `REC-${new Date().getFullYear()}-${String(recepciones.length + 1).padStart(3, '0')}`;
      const { controles_manual, ...receptionPayload } = receptionForm;
      const rdi = rdis.find(item => String(item.id) === String(receptionPayload.rdi_id));
      const pac = pacPorPartida.get(receptionPayload.partida) || pacs.find(item => String(item.id) === String(rdi?.pac_id));
      const protocol = protocolFromPac(pac, controles_manual);
      const insertPayload = { empresa, obra_nombre: obraNombre, ...receptionPayload, codigo, estado: 'Pendiente de recepción', trazabilidad: [auditActor(user, 'Partida entregada para recepción', 'Pendiente de recepción', `${receptionForm.partida} · ${receptionForm.sector || 'Sin sector'}`)] };
      if (protocolAvailable) insertPayload.pac_id = pac?.id || null;
      const { data: createdReception, error } = await supabase.from('calidad_recepciones_partidas').insert(insertPayload).select().single();
      if (error) throw error;
      if (protocolAvailable && protocol.length) {
        const { error: protocolError } = await supabase.from('calidad_recepcion_controles').insert(protocol.map(control => ({ ...control, recepcion_id: createdReception.id, pac_id: pac?.id || null })));
        if (protocolError) throw protocolError;
      }
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${codigo} entregada para recepción`, detalle: `${receptionForm.partida} · ${receptionForm.cantidad || 0} ${receptionForm.unidad || ''} · ${receptionForm.sector || 'Sin sector'}`, actor: receptionForm.entrega_por || user?.nombre || user?.email, fecha: receptionForm.fecha_entrega });
      setReceptionForm(initialReception); setExpandedReceptionId(createdReception.id); setMessage(protocolAvailable ? `${codigo} registrada con ${protocol.length} control${protocol.length === 1 ? '' : 'es'} de protocolo.` : `${codigo} registrada. El protocolo se habilitará al ejecutar el esquema de Calidad en Supabase.`); await load();
    } catch (error) { setMessage(`No se pudo registrar la recepción: ${error.message}`); }
  };
  const updateStatus = async (table, id, estado) => {
    const approvalStates = ['Aprobada', 'Cerrada', 'Verificada'];
    if (approvalStates.includes(estado) ? !canApprove : !(canReview || canEdit)) {
      setMessage('Tu perfil no está autorizado para cambiar este estado de calidad.');
      return;
    }
    try {
      const nc = table === 'calidad_no_conformidades' ? ncs.find(item => item.id === id) : null;
      if (nc && ['Verificada', 'Cerrada'].includes(estado) && (!nc.causa_raiz?.trim() || !nc.accion_correctiva?.trim())) { setMessage('Antes de verificar una NC registra su causa raíz y acción correctiva.'); return; }
      if (nc && !canTransitionNonConformity(nc.estado, estado)) { setMessage('La transición solicitada no corresponde a la etapa actual de la no conformidad.'); return; }
      const extra = table === 'calidad_no_conformidades' ? {
        ...(estado === 'Verificada' ? { verificado_por: user?.nombre || user?.usuario || user?.correo || 'Usuario autorizado', fecha_verificacion: new Date().toISOString(), eficacia_verificada: true } : {}),
        ...(estado === 'Cerrada' ? { fecha_cierre: new Date().toISOString().slice(0, 10) } : {}),
        trazabilidad: appendAudit(nc?.trazabilidad, auditActor(user, 'Estado de no conformidad actualizado', estado))
      } : {};
      const record = table === 'calidad_rdi' ? rdis.find(item => item.id === id) : ncs.find(item => item.id === id);
      const { error } = await supabase.from(table).update({ estado, ...extra, ...(table === 'calidad_rdi' ? { trazabilidad: appendAudit(record?.trazabilidad, auditActor(user, 'Estado de RDI actualizado', estado)) } : {}) }).eq('id', id);
      if (error) throw error;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${record?.codigo || 'Registro de calidad'} actualizado a ${estado}`, detalle: record?.partida || record?.descripcion || '', actor: user?.nombre || user?.email || 'Usuario autorizado' });
      await load();
    } catch (error) { setMessage(`No se pudo actualizar: ${error.message}`); }
  };
  const updateNcDetails = async (nc, changes) => {
    if (!(canEdit || canReview)) { setMessage('Tu perfil no está autorizado para gestionar acciones correctivas.'); return; }
    try {
      const nextStatus = nc.estado === 'Abierta' && (changes.correccion_inmediata || changes.causa_raiz || changes.accion_correctiva) ? 'En corrección' : nc.estado;
      const payload = { ...changes, estado: nextStatus, trazabilidad: appendAudit(nc.trazabilidad, auditActor(user, 'Análisis y acción de NC actualizados', nextStatus, changes.observacion_verificacion || 'Actualización del plan correctivo')) };
      const { error } = await supabase.from('calidad_no_conformidades').update(payload).eq('empresa', empresa).eq('obra_nombre', obraNombre).eq('id', nc.id);
      if (error) throw error;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${nc.codigo} · plan correctivo actualizado`, detalle: changes.accion_correctiva || changes.causa_raiz || changes.correccion_inmediata || '', actor: user?.nombre || user?.correo || 'Usuario autorizado' });
      setMessage(`${nc.codigo} actualizado.`); await load();
    } catch (error) { setMessage(`No se pudo actualizar la NC: ${error.message}`); }
  };
  const updateReceptionControl = async (control, changes) => {
    if (!canReview) { setMessage('Tu perfil no está autorizado para revisar protocolos de recepción.'); return; }
    try {
      const reviewer = user?.nombre || user?.email || 'Usuario autorizado';
      const nextControl = { ...control, ...changes };
      const { error } = await supabase.from('calidad_recepcion_controles').update({ ...changes, revisado_por: reviewer, fecha_revision: new Date().toISOString() }).eq('id', control.id);
      if (error) throw error;
      const reception = recepciones.find(item => item.id === control.recepcion_id);
      const nextControls = (controlsByReception[control.recepcion_id] || []).map(item => item.id === control.id ? nextControl : item);
      const estado = receptionStatusFromControls(nextControls);
      const { error: receptionError } = await supabase.from('calidad_recepciones_partidas').update({ estado, recibe_por: reviewer, trazabilidad: appendAudit(reception?.trazabilidad, auditActor(user, `Control de recepción ${nextControl.resultado}`, estado, `${nextControl.tipo}: ${nextControl.punto}${nextControl.observacion ? ` · ${nextControl.observacion}` : ''}`)) }).eq('id', control.recepcion_id);
      if (receptionError) throw receptionError;
      await registrarEventoBitacora({ empresa, obraNombre, categoria: 'Calidad', accion: `${reception?.codigo || 'Recepción'} · ${nextControl.resultado}`, detalle: `${nextControl.tipo}: ${nextControl.punto}${nextControl.observacion ? ` · ${nextControl.observacion}` : ''}`, actor: reviewer });
      await load();
    } catch (error) { setMessage(`No se pudo actualizar el control de recepción: ${error.message}`); }
  };
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none';

  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando permisos…</div>;
  if (!canView) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">Tu perfil no tiene permiso para ver Calidad de Obra.</div>;

  return <div className="space-y-5">
    <ModuleHeader title={embedded ? `Calidad · ${obraInicial}` : 'Control Corporativo de Calidad'} subtitle="PAC, solicitudes RDI, recepción de partidas y no conformidades con trazabilidad." Icon={ShieldCheck} onBack={onBack} actions={<>{!embedded && <select value={obraNombre} onChange={e => setObraNombre(e.target.value)} className="min-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"><option value="">Selecciona una obra</option>{obras.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}</select>}<button onClick={load} className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-3.5 w-3.5" />Actualizar</button></>} />
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">{message}</div>}
    {!canCreate && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">Acceso de consulta. La creación de PAC, RDI, recepciones y no conformidades está restringida por tu rol.</div>}
    {(clientName || clientEmail || clientPhone) && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-950"><Mail className="h-3.5 w-3.5" /><span className="font-black">Mandante / inspección:</span><span>{clientName || 'Sin nombre'}{clientEmail ? ` · ${clientEmail}` : ''}{clientPhone ? ` · ${clientPhone}` : ''}</span></div>}
    <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5">{[['resumen','Resumen'],['pac','PAC por partida'],['rdi','Solicitudes RDI'],['recepciones','Entrega y recepción'],['nc','No conformidades']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}</div>
    {!obraNombre ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Selecciona una obra para comenzar su control de calidad.</div> : loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando calidad de obra…</div> : <>
      {tab === 'resumen' && <div className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ClipboardCheck />} label="PAC activos" value={pacs.filter(p => p.estado === 'Activo').length} detail={`${pacs.length} creados`} color="emerald" />
        <Metric icon={<FileCheck2 />} label="RDI pendientes" value={rdisPendientes.length} detail={`${rdis.filter(r => r.estado === 'Aprobada').length} aprobadas`} color="blue" />
        <Metric icon={<AlertTriangle />} label="NC abiertas" value={ncsAbiertas.length} detail={`${ncVencidas.length} vencidas`} color="rose" />
        <Metric icon={<CheckCircle2 />} label="Recepción a la primera" value={`${rdis.length ? Math.round((rdis.filter(r => r.estado === 'Aprobada').length / rdis.length) * 100) : 0}%`} detail="RDIs aprobadas" color="amber" />
      </div><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 text-sm font-black text-slate-800">Partidas bloqueadas o por inspeccionar</h3>{rdisPendientes.length ? <div className="space-y-2">{rdisPendientes.slice(0,6).map(r => <RdiRow key={r.id} rdi={r} onStatus={updateStatus} />)}</div> : <Empty text="No hay RDI pendientes en esta obra." />}</section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 text-sm font-black text-slate-800">No conformidades prioritarias</h3>{ncsAbiertas.length ? <div className="space-y-2">{ncsAbiertas.slice(0,6).map(n => <NcRow key={n.id} nc={n} onStatus={updateStatus} />)}</div> : <Empty text="No hay no conformidades abiertas." />}</section></div><section className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-violet-800"/><h3 className="text-sm font-black text-violet-950">Recurrencia y focos sistémicos</h3><span className="ml-auto rounded-full bg-white px-2 py-1 text-[9px] font-black text-violet-800">Sin consumo de IA</span></div>{recurrence.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{recurrence.slice(0,8).map(item => <button key={`${item.partida}-${item.causa}`} type="button" onClick={()=>setTab('nc')} className="rounded-xl border border-violet-100 bg-white p-3 text-left"><p className="text-xs font-black text-slate-900">{item.partida}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.causa}</p><p className="mt-2 text-[10px] font-black text-violet-800">{item.total} NC · {item.abiertas} abierta(s)</p></button>)}</div> : <p className="mt-3 text-xs text-slate-600">Aún no existen combinaciones repetidas de partida y categoría de causa.</p>}</section></div>}
      {tab === 'pac' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={savePac} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-emerald-700" />Crear PAC / ITP</h3><SelectPartida value={pacForm.partida} onChange={v => setPacForm({...pacForm,partida:v})} partidas={partidasEjecutables} /><input required list="procedimientos-empresa" placeholder="No aplica o selecciona un PTS de Prevención" value={pacForm.procedimiento} onChange={e=>setPacForm({...pacForm,procedimiento:e.target.value})} className={input}/><datalist id="procedimientos-empresa"><option value="No aplica" />{procedimientosEmpresa.map(pts=>{ const label = pts.codigo ? `${pts.codigo} · ${pts.nombre}` : pts.nombre; return <option key={pts.codigo || pts.nombre} value={label} />; })}</datalist><p className="-mt-2 text-[10px] text-slate-500">También puedes escribir un procedimiento específico.</p><textarea required placeholder="Criterios de aceptación" value={pacForm.criterios} onChange={e=>setPacForm({...pacForm,criterios:e.target.value})} className={input}/><textarea placeholder="Puntos de inspección (separados por línea)" value={pacForm.puntos_inspeccion} onChange={e=>setPacForm({...pacForm,puntos_inspeccion:e.target.value})} className={input}/><textarea placeholder="Puntos de espera / liberación" value={pacForm.puntos_espera} onChange={e=>setPacForm({...pacForm,puntos_espera:e.target.value})} className={input}/><input placeholder="Responsable de calidad" value={pacForm.responsable} onChange={e=>setPacForm({...pacForm,responsable:e.target.value})} className={input}/><button className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white">Guardar PAC</button></form><section className="space-y-3">{pacs.length ? pacs.map(p => <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-800">{p.partida}</p><p className="mt-1 text-xs font-semibold text-emerald-800">{p.procedimiento}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(p.estado)}`}>{p.estado}</span></div><div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-3"><Info label="Criterios" value={p.criterios} /><Info label="Inspección" value={p.puntos_inspeccion || 'Sin definir'} /><Info label="Puntos de espera" value={p.puntos_espera || 'Sin definir'} /></div></div>) : <Empty text="Aún no hay PAC creados. Crea uno por cada partida o actividad crítica." />}</section></div>}
      {tab === 'rdi' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={saveRdi} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-blue-700" />Nueva Solicitud RDI</h3><SelectPartida value={rdiForm.partida} onChange={v => setRdiForm({...rdiForm,partida:v,pac_id:pacPorPartida.get(v)?.id || ''})} partidas={partidasEjecutables}/><select required value={rdiForm.pac_id} onChange={e=>setRdiForm({...rdiForm,pac_id:e.target.value})} className={input}><option value="">PAC asociado</option>{pacs.filter(p=>!rdiForm.partida || p.partida===rdiForm.partida).map(p=><option key={p.id} value={p.id}>{p.procedimiento}</option>)}</select><input required placeholder="Sector / ubicación" value={rdiForm.sector} onChange={e=>setRdiForm({...rdiForm,sector:e.target.value})} className={input}/><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="any" placeholder="Cantidad" value={rdiForm.cantidad} onChange={e=>setRdiForm({...rdiForm,cantidad:e.target.value})} className={input}/><input placeholder="Unidad" value={rdiForm.unidad} onChange={e=>setRdiForm({...rdiForm,unidad:e.target.value})} className={input}/></div><input required placeholder="Solicitado por" value={rdiForm.solicitado_por} onChange={e=>setRdiForm({...rdiForm,solicitado_por:e.target.value})} className={input}/><textarea placeholder="Observaciones y evidencias disponibles" value={rdiForm.observaciones} onChange={e=>setRdiForm({...rdiForm,observaciones:e.target.value})} className={input}/><button className="w-full rounded-xl bg-blue-800 py-2.5 text-xs font-black text-white">Enviar RDI a inspección</button></form><section className="space-y-2">{rdis.length ? rdis.map(r => <RdiRow key={r.id} rdi={r} onStatus={updateStatus} full />) : <Empty text="No hay solicitudes RDI registradas." />}</section></div>}
      {tab === 'nc' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]"><form onSubmit={saveNc} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><Plus className="h-4 w-4 text-rose-700" />Registrar no conformidad</h3><SelectPartida value={ncForm.partida} onChange={v => setNcForm({...ncForm,partida:v})} partidas={partidasEjecutables}/><select value={ncForm.rdi_id} onChange={e=>setNcForm({...ncForm,rdi_id:e.target.value})} className={input}><option value="">RDI relacionada (opcional)</option>{rdis.map(r=><option key={r.id} value={r.id}>{r.codigo} · {r.partida}</option>)}</select><textarea required placeholder="Descripción objetiva de la desviación" value={ncForm.descripcion} onChange={e=>setNcForm({...ncForm,descripcion:e.target.value})} className={input}/><div className="grid grid-cols-2 gap-2"><select value={ncForm.clasificacion} onChange={e=>setNcForm({...ncForm,clasificacion:e.target.value})} className={input}><option>Menor</option><option>Mayor</option><option>Crítica</option></select><select value={ncForm.origen} onChange={e=>setNcForm({...ncForm,origen:e.target.value})} className={input}>{NC_ORIGENES.map(x=><option key={x}>{x}</option>)}</select></div><select value={ncForm.impacto} onChange={e=>setNcForm({...ncForm,impacto:e.target.value})} className={input}>{NC_IMPACTOS.map(x=><option key={x}>{x}</option>)}</select><input required placeholder="Responsable de corrección" value={ncForm.responsable} onChange={e=>setNcForm({...ncForm,responsable:e.target.value})} className={input}/><input type="date" value={ncForm.fecha_compromiso} onChange={e=>setNcForm({...ncForm,fecha_compromiso:e.target.value})} className={input}/><textarea required placeholder="Corrección o contención inmediata" value={ncForm.correccion_inmediata} onChange={e=>setNcForm({...ncForm,correccion_inmediata:e.target.value})} className={input}/><div className="grid grid-cols-2 gap-2"><select value={ncForm.metodo_causa_raiz} onChange={e=>setNcForm({...ncForm,metodo_causa_raiz:e.target.value})} className={input}><option>5 Porqués</option><option>Ishikawa</option><option>Árbol de causas</option><option>Análisis de barreras</option><option>Otro</option></select><select value={ncForm.causa_categoria} onChange={e=>setNcForm({...ncForm,causa_categoria:e.target.value})} className={input}>{CAUSA_CATEGORIAS.map(x=><option key={x}>{x}</option>)}</select></div><textarea placeholder="Causa raíz (puede completarse durante el análisis)" value={ncForm.causa_raiz} onChange={e=>setNcForm({...ncForm,causa_raiz:e.target.value})} className={input}/><textarea placeholder="Acción correctiva para evitar recurrencia" value={ncForm.accion_correctiva} onChange={e=>setNcForm({...ncForm,accion_correctiva:e.target.value})} className={input}/><button className="w-full rounded-xl bg-rose-700 py-2.5 text-xs font-black text-white">Abrir no conformidad</button></form><section className="space-y-3">{ncs.length ? ncs.map(n => <NcRow key={n.id} nc={n} onStatus={updateStatus} onUpdate={updateNcDetails} full />) : <Empty text="No hay no conformidades registradas." />}</section></div>}
      {tab === 'recepciones' && <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <form onSubmit={saveReception} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800"><ClipboardCheck className="h-4 w-4 text-emerald-700" />Entrega y protocolo de recepción</h3>
          <SelectPartida value={receptionForm.partida} onChange={v => setReceptionForm({ ...receptionForm, partida: v })} partidas={partidasEjecutables}/>
          {receptionForm.partida && <div className={`rounded-xl border p-3 text-[11px] ${receptionPac ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <p className="font-black">{receptionPac ? `Protocolo desde PAC: ${receptionPac.procedimiento}` : 'Sin PAC asociado'}</p>
            <p className="mt-1">{receptionPac ? `${protocolFromPac(receptionPac).length} controles se crearán automáticamente.` : 'Agrega controles manuales para elaborar el protocolo.'}</p>
          </div>}
          <select value={receptionForm.rdi_id} onChange={e=>setReceptionForm({...receptionForm,rdi_id:e.target.value})} className={input}><option value="">RDI aprobada relacionada (opcional)</option>{rdis.filter(r=>r.estado==='Aprobada').map(r=><option key={r.id} value={r.id}>{r.codigo} · {r.partida}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="date" required value={receptionForm.fecha_entrega} onChange={e=>setReceptionForm({...receptionForm,fecha_entrega:e.target.value})} className={input}/><input placeholder="Sector / ubicación" value={receptionForm.sector} onChange={e=>setReceptionForm({...receptionForm,sector:e.target.value})} className={input}/></div>
          <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="any" placeholder="Cantidad entregada" value={receptionForm.cantidad} onChange={e=>setReceptionForm({...receptionForm,cantidad:e.target.value})} className={input}/><input placeholder="Unidad" value={receptionForm.unidad} onChange={e=>setReceptionForm({...receptionForm,unidad:e.target.value})} className={input}/></div>
          <input required placeholder="Entregado por" value={receptionForm.entrega_por} onChange={e=>setReceptionForm({...receptionForm,entrega_por:e.target.value})} className={input}/>
          <input placeholder="Recibe / inspecciona" value={receptionForm.recibe_por} onChange={e=>setReceptionForm({...receptionForm,recibe_por:e.target.value})} className={input}/>
          <textarea placeholder="Controles adicionales (uno por línea)" value={receptionForm.controles_manual} onChange={e=>setReceptionForm({...receptionForm,controles_manual:e.target.value})} className={input}/>
          <textarea placeholder="Observaciones generales de entrega" value={receptionForm.observaciones} onChange={e=>setReceptionForm({...receptionForm,observaciones:e.target.value})} className={input}/>
          <button className="w-full rounded-xl bg-emerald-700 py-3 text-xs font-black text-white">Crear protocolo de recepción</button>
        </form>
        <section className="space-y-3">{recepciones.length ? recepciones.map(item => <ReceptionProtocol key={item.id} item={item} controls={controlsByReception[item.id] || []} expanded={expandedReceptionId === item.id} onToggle={() => setExpandedReceptionId(expandedReceptionId === item.id ? null : item.id)} onUpdate={updateReceptionControl} />) : <Empty text="Aún no hay partidas entregadas para recepción." />}</section>
      </div>}
    </>}
  </div>;
}

function Metric({ icon, label, value, detail, color }) { return <div className={`rounded-2xl border bg-white p-4 ${color === 'rose' ? 'border-rose-200' : 'border-slate-200'}`}><div className="flex items-center gap-2 text-slate-500">{React.cloneElement(icon,{className:`h-4 w-4 text-${color}-700`})}<span className="text-[10px] font-black uppercase tracking-wide">{label}</span></div><p className="mt-2 text-2xl font-black text-slate-900">{value}</p><p className="text-[10px] font-semibold text-slate-500">{detail}</p></div>; }
function Empty({ text }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">{text}</div>; }
function Info({ label, value }) { return <div><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 whitespace-pre-line text-xs">{value}</p></div>; }
function ReceptionProtocol({ item, controls, expanded, onToggle, onUpdate }) {
  const resolved = controls.filter(control => control.resultado !== 'Pendiente').length;
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 p-4 text-left active:bg-slate-50">
      <div><p className="text-xs font-black text-slate-800">{item.codigo} · {item.partida}</p><p className="mt-1 text-[11px] text-slate-500">{item.fecha_entrega} · {item.sector || 'Sin sector'} · {item.cantidad || 0} {item.unidad || ''}</p><p className="mt-1 text-[11px] text-slate-600">{controls.length ? `${resolved} de ${controls.length} controles revisados` : 'Sin controles definidos'}</p></div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${statusClass(item.estado)}`}>{item.estado}</span>
    </button>
    {expanded && <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600"><span>Entregó: <b>{item.entrega_por}</b></span>{item.recibe_por && <span>Inspecciona: <b>{item.recibe_por}</b></span>}</div>
      {item.observaciones && <p className="mb-3 rounded-lg bg-white p-2 text-[11px] text-slate-600">{item.observaciones}</p>}
      <DocumentAuditTrail records={item.trazabilidad} title="Registro de recepción y firmas" />
      {controls.length ? <div className="space-y-3">{controls.map(control => <ProtocolControl key={control.id} control={control} onUpdate={onUpdate} />)}</div> : <Empty text="Esta recepción no tiene controles. Crea un PAC o agrega controles manuales en la siguiente entrega." />}
    </div>}
  </article>;
}
function ProtocolControl({ control, onUpdate }) {
  const [note, setNote] = useState(control.observacion || '');
  const commit = (resultado = control.resultado) => onUpdate(control, { resultado, observacion: note || null });
  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{control.tipo}</p><p className="mt-1 whitespace-pre-line text-xs font-bold text-slate-800">{control.punto}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(control.resultado)}`}>{control.resultado}</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{['Conforme', 'Observado', 'Rechazado', 'No aplica'].map(result => <button type="button" key={result} onClick={() => commit(result)} className={`min-h-10 rounded-lg border px-3 py-2 text-[11px] font-black ${control.resultado === result ? statusClass(result) : 'border-slate-200 text-slate-600 active:bg-slate-100'}`}>{result}</button>)}</div>
    <div className="mt-3 flex gap-2"><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Observación del chequeo (obligatoria para observar o rechazar)" className="min-h-16 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"/><button type="button" onClick={() => commit()} className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-black text-white">Guardar</button></div>
    {control.revisado_por && <p className="mt-2 text-[10px] text-slate-400">Última revisión: {control.revisado_por}</p>}
  </div>;
}
function SelectPartida({ value, onChange, partidas }) { return <select required value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"><option value="">Selecciona partida</option>{partidas.map(p=><option key={p.id || p.partida} value={p.partida}>{p.partida}</option>)}</select>; }
function RdiRow({ rdi, onStatus, full }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-slate-800">{rdi.codigo} · {rdi.partida}</p><p className="mt-1 text-[11px] text-slate-500">{rdi.sector} {rdi.cantidad ? `· ${rdi.cantidad} ${rdi.unidad || ''}` : ''} · Solicitó: {rdi.solicitado_por}</p>{full && rdi.observaciones && <p className="mt-2 text-[11px] text-slate-600">{rdi.observaciones}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(rdi.estado)}`}>{rdi.estado}</span>{['Enviada','Observada'].includes(rdi.estado) && <><button onClick={()=>onStatus('calidad_rdi',rdi.id,'Aprobada')} className="text-[10px] font-black text-emerald-700">Aprobar</button><button onClick={()=>onStatus('calidad_rdi',rdi.id,'Observada')} className="text-[10px] font-black text-amber-700">Observar</button></>}</div></div></div>; }
function NcRow({ nc, onStatus, onUpdate, full }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ correccion_inmediata: nc.correccion_inmediata || '', metodo_causa_raiz: nc.metodo_causa_raiz || '5 Porqués', causa_categoria: nc.causa_categoria || 'Método / Procedimiento', causa_raiz: nc.causa_raiz || '', accion_correctiva: nc.accion_correctiva || '', observacion_verificacion: nc.observacion_verificacion || '', fecha_verificacion_eficacia: nc.fecha_verificacion_eficacia || '' });
  const overdue = !['Cerrada','Verificada'].includes(nc.estado) && nc.fecha_compromiso && nc.fecha_compromiso < new Date().toISOString().slice(0,10);
  const next = nextNonConformityState(nc.estado) || '';
  return <div className={`rounded-xl border bg-white p-3 ${overdue ? 'border-rose-300' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-2"><button type="button" onClick={()=>full&&setOpen(!open)} className="min-w-0 text-left"><p className="text-xs font-black text-slate-800">{nc.codigo} · {nc.partida}</p><p className="mt-1 text-[11px] text-slate-500">{nc.clasificacion} · {nc.origen || 'Origen no clasificado'} · Impacto: {nc.impacto || 'Calidad'}</p><p className={`mt-1 text-[10px] font-bold ${overdue ? 'text-rose-700' : 'text-slate-500'}`}>Responsable: {nc.responsable}{nc.fecha_compromiso ? ` · Compromiso: ${nc.fecha_compromiso}` : ''}{overdue ? ' · VENCIDA' : ''}</p>{full && <p className="mt-2 text-[11px] text-slate-700">{nc.descripcion}</p>}</button><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(nc.estado)}`}>{nc.estado}</span>{next && <button type="button" onClick={()=>onStatus('calidad_no_conformidades',nc.id,next)} className="text-[10px] font-black text-emerald-700">{next === 'En corrección' ? 'Iniciar corrección' : next === 'Verificada' ? 'Verificar eficacia' : 'Cerrar'}</button>}</div></div>
    {full && open && <div className="mt-3 space-y-3 border-t pt-3"><div className="grid gap-2 md:grid-cols-2"><Info label="Contención inmediata" value={nc.correccion_inmediata || 'Pendiente'} /><Info label={`Causa raíz · ${nc.metodo_causa_raiz || 'Sin método'}`} value={nc.causa_raiz || 'Pendiente'} /><Info label="Categoría de causa" value={nc.causa_categoria || 'Sin clasificar'} /><Info label="Acción correctiva" value={nc.accion_correctiva || 'Pendiente'} /></div>{nc.observacion_verificacion && <Info label="Verificación de eficacia" value={nc.observacion_verificacion}/>} {onUpdate && nc.estado !== 'Cerrada' && <div className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2"><textarea value={form.correccion_inmediata} onChange={e=>setForm({...form,correccion_inmediata:e.target.value})} placeholder="Corrección inmediata" className="rounded-lg border p-2 text-xs"/><textarea value={form.causa_raiz} onChange={e=>setForm({...form,causa_raiz:e.target.value})} placeholder="Causa raíz confirmada" className="rounded-lg border p-2 text-xs"/><select value={form.metodo_causa_raiz} onChange={e=>setForm({...form,metodo_causa_raiz:e.target.value})} className="rounded-lg border p-2 text-xs"><option>5 Porqués</option><option>Ishikawa</option><option>Árbol de causas</option><option>Análisis de barreras</option><option>Otro</option></select><select value={form.causa_categoria} onChange={e=>setForm({...form,causa_categoria:e.target.value})} className="rounded-lg border p-2 text-xs">{CAUSA_CATEGORIAS.map(x=><option key={x}>{x}</option>)}</select><textarea value={form.accion_correctiva} onChange={e=>setForm({...form,accion_correctiva:e.target.value})} placeholder="Acción correctiva" className="rounded-lg border p-2 text-xs md:col-span-2"/><input type="date" value={form.fecha_verificacion_eficacia} onChange={e=>setForm({...form,fecha_verificacion_eficacia:e.target.value})} className="rounded-lg border p-2 text-xs"/><input value={form.observacion_verificacion} onChange={e=>setForm({...form,observacion_verificacion:e.target.value})} placeholder="Criterio / resultado de eficacia" className="rounded-lg border p-2 text-xs"/><button type="button" onClick={()=>onUpdate(nc,form)} className="rounded-lg bg-slate-900 py-2 text-xs font-black text-white md:col-span-2">Guardar análisis y plan correctivo</button></div>}<DocumentAuditTrail records={nc.trazabilidad} title="Registro de la no conformidad" /></div>}
  </div>;
}
