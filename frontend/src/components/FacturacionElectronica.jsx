import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, FileInput,
  FileOutput, Link2, Plus, RefreshCw, Save, Settings2, WalletCards
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import ModuleHeader from './ModuleHeader';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';

const money = value => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const today = () => new Date().toISOString().slice(0, 10);
const dteName = code => ({ 33: 'Factura afecta', 34: 'Factura exenta', 56: 'Nota de débito', 61: 'Nota de crédito' }[Number(code)] || `DTE ${code}`);
const emptyCentro = { codigo: '', nombre: '', tipo: 'Obra', descripcion: '' };
const emptyPurchase = { tipo_dte: 33, folio: '', fecha_emision: today(), rut_emisor: '', nombre_emisor: '', centro_gestion_id: '', monto_neto: '', monto_iva: '', monto_total: '', estado_acuse: 'Pendiente' };
const emptySale = { tipo_dte: 33, folio: '', fecha_emision: today(), estado_pago_id: '', estado_sii: 'Aceptado', estado_pago: 'Pendiente' };

export default function FacturacionElectronica({ user, onBack, embedded = false }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const canView = can(user, permissions, 'facturacion.documentos.ver');
  const canCreate = can(user, permissions, 'facturacion.documentos.crear');
  const canEdit = can(user, permissions, 'facturacion.documentos.editar');
  const canReview = can(user, permissions, 'facturacion.documentos.revisar');
  const canConfigure = can(user, permissions, 'facturacion.documentos.configurar');
  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState({ facturacion_habilitada: false, proveedor_integracion: '', ultima_sincronizacion: null });
  const [centros, setCentros] = useState([]);
  const [obras, setObras] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [estadosPago, setEstadosPago] = useState([]);
  const [centroForm, setCentroForm] = useState(emptyCentro);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [saleForm, setSaleForm] = useState(emptySale);
  const empresa = user?.empresa || '';

  const load = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    setMessage('');
    try {
      const [configRes, centrosRes, obrasRes, docsRes, epRes] = await Promise.all([
        supabase.from('facturacion_config').select('*').eq('empresa', empresa).maybeSingle(),
        supabase.from('facturacion_centros_gestion').select('*').eq('empresa', empresa).order('codigo'),
        supabase.from('obras').select('id,nombre,estado,cliente,cliente_email,centro_gestion_id').eq('empresa', empresa).order('nombre'),
        supabase.from('facturacion_documentos').select('*').eq('empresa', empresa).order('fecha_emision', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('estados_pago_obra').select('id,obra_nombre,numero,fecha_corte,monto_neto,estado,factura_documento_id').eq('empresa', empresa).order('numero', { ascending: false })
      ]);
      const error = configRes.error || centrosRes.error || obrasRes.error || docsRes.error || epRes.error;
      if (error) throw error;
      setConfig(configRes.data || { facturacion_habilitada: false, proveedor_integracion: '', ultima_sincronizacion: null });
      setCentros(centrosRes.data || []);
      setObras(obrasRes.data || []);
      setDocumentos(docsRes.data || []);
      setEstadosPago(epRes.data || []);
    } catch (error) {
      setMessage(`No fue posible cargar Facturación Electrónica: ${error.message}`);
    } finally { setLoading(false); }
  }, [empresa]);

  useEffect(() => { load(); }, [load]);

  const centerMap = useMemo(() => new Map(centros.map(center => [String(center.id), center])), [centros]);
  const obraByCenter = useMemo(() => new Map(obras.filter(obra => obra.centro_gestion_id).map(obra => [String(obra.centro_gestion_id), obra])), [obras]);
  const compras = documentos.filter(doc => doc.direccion_flujo === 'Compra');
  const ventas = documentos.filter(doc => doc.direccion_flujo === 'Venta');
  const acceptedPurchases = compras.filter(doc => doc.estado_acuse !== 'Reclamado' && doc.estado_sii !== 'Rechazado');
  const realCost = acceptedPurchases.reduce((sum, doc) => sum + (Number(doc.monto_neto) > 0 ? Number(doc.monto_neto) : Number(doc.monto_total) || 0), 0);
  const billed = ventas.reduce((sum, doc) => sum + (Number(doc.monto_total) || 0), 0);
  const obrasWithoutCenter = obras.filter(obra => !obra.centro_gestion_id);

  const saveConfig = async () => {
    if (!canConfigure) return setMessage('Tu perfil no puede configurar facturación.');
    if (config.facturacion_habilitada && obrasWithoutCenter.length > 0) {
      return setMessage(`Antes de habilitar facturación debes asignar un centro de gestión a ${obrasWithoutCenter.length} obra${obrasWithoutCenter.length === 1 ? '' : 's'}.`);
    }
    const payload = { empresa, facturacion_habilitada: Boolean(config.facturacion_habilitada), proveedor_integracion: config.proveedor_integracion?.trim() || null };
    const { error } = await supabase.from('facturacion_config').upsert(payload, { onConflict: 'empresa' });
    if (error) return setMessage(`No se pudo guardar la configuración: ${error.message}`);
    setMessage('Configuración de facturación guardada.');
    await load();
  };

  const createCenter = async event => {
    event.preventDefault();
    if (!canConfigure) return setMessage('Tu perfil no puede crear centros de gestión.');
    if (!/^\d{3,10}$/.test(centroForm.codigo.trim())) return setMessage('El código debe contener entre 3 y 10 dígitos.');
    const { error } = await supabase.from('facturacion_centros_gestion').insert({ empresa, ...centroForm, codigo: centroForm.codigo.trim(), nombre: centroForm.nombre.trim(), activo: true });
    if (error) return setMessage(`No se pudo crear el centro: ${error.message}`);
    setCentroForm(emptyCentro);
    setMessage('Centro de gestión creado.');
    await load();
  };

  const assignCenter = async (obra, centerId) => {
    if (!canConfigure) return setMessage('Tu perfil no puede asignar centros de gestión.');
    const { error } = await supabase.from('obras').update({ centro_gestion_id: centerId ? Number(centerId) : null }).eq('id', obra.id).eq('empresa', empresa);
    if (error) return setMessage(`No se pudo asignar el centro: ${error.message}`);
    setMessage(`${obra.nombre} quedó ${centerId ? 'asignada al centro de gestión' : 'sin centro asignado'}.`);
    await load();
  };

  const registerPurchase = async event => {
    event.preventDefault();
    if (!canCreate) return setMessage('Tu perfil no puede registrar facturas recibidas.');
    const center = centerMap.get(String(purchaseForm.centro_gestion_id));
    const obra = obraByCenter.get(String(purchaseForm.centro_gestion_id));
    if (!center) return setMessage('Selecciona un centro de gestión.');
    if (center.tipo === 'Obra' && !obra) return setMessage('Este centro debe estar asignado a una obra antes de recibir gastos.');
    const net = Number(purchaseForm.monto_neto) || 0;
    const iva = purchaseForm.tipo_dte === 34 ? 0 : (Number(purchaseForm.monto_iva) || Math.round(net * 0.19));
    const total = Number(purchaseForm.monto_total) || net + iva;
    const { error } = await supabase.from('facturacion_documentos').insert({
      empresa, direccion_flujo: 'Compra', ...purchaseForm,
      folio: Number(purchaseForm.folio), centro_gestion_id: Number(purchaseForm.centro_gestion_id),
      obra_nombre: obra?.nombre || null, monto_neto: net, monto_iva: iva, monto_total: total,
      rut_receptor: config.rut_empresa || empresa, nombre_receptor: config.razon_social || empresa,
      estado_sii: purchaseForm.estado_acuse === 'Reclamado' ? 'Rechazado' : 'Aceptado',
      fecha_recepcion: new Date().toISOString(), origen: 'Manual'
    });
    if (error) return setMessage(`No se pudo registrar el DTE: ${error.message}`);
    setPurchaseForm(emptyPurchase);
    setMessage(obra ? `Factura registrada y cargada automáticamente como gasto real de ${obra.nombre}.` : 'Factura registrada en el centro corporativo.');
    await load();
  };

  const registerSale = async event => {
    event.preventDefault();
    if (!canCreate) return setMessage('Tu perfil no puede registrar facturas emitidas.');
    const ep = estadosPago.find(item => String(item.id) === String(saleForm.estado_pago_id));
    if (!ep) return setMessage('Selecciona el Estado de Pago asociado.');
    if (!['Aprobado', 'Enviado', 'Pagado'].includes(ep.estado)) return setMessage('El Estado de Pago debe estar aprobado antes de asociar una factura.');
    const obra = obras.find(item => item.nombre === ep.obra_nombre);
    if (!obra?.centro_gestion_id) return setMessage('La obra del Estado de Pago no tiene centro de gestión asignado.');
    const total = Number(ep.monto_neto) || 0;
    const net = saleForm.tipo_dte === 34 ? total : Math.round(total / 1.19);
    const iva = total - net;
    const { error } = await supabase.from('facturacion_documentos').insert({
      empresa, direccion_flujo: 'Venta', ...saleForm, folio: Number(saleForm.folio),
      estado_pago_id: Number(ep.id), obra_nombre: ep.obra_nombre, centro_gestion_id: obra.centro_gestion_id,
      rut_receptor: obra.cliente_rut || 'Sin RUT informado', nombre_receptor: obra.cliente || 'Cliente de la obra',
      rut_emisor: config.rut_empresa || empresa, nombre_emisor: config.razon_social || empresa,
      monto_neto: net, monto_iva: iva, monto_total: total, origen: 'Manual'
    });
    if (error) return setMessage(`No se pudo vincular la factura: ${error.message}`);
    setSaleForm(emptySale);
    setMessage(`Factura vinculada al Estado de Pago N° ${ep.numero} de ${ep.obra_nombre}.`);
    await load();
  };

  const updateDocument = async (doc, changes) => {
    if (!canReview && !canEdit) return setMessage('Tu perfil no puede actualizar documentos tributarios.');
    const { error } = await supabase.from('facturacion_documentos').update(changes).eq('id', doc.id).eq('empresa', empresa);
    if (error) return setMessage(`No se pudo actualizar el documento: ${error.message}`);
    setMessage('Documento actualizado y relaciones recalculadas.');
    await load();
  };

  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando permisos…</div>;
  if (!canView) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">Tu perfil no tiene permiso para ver Facturación Electrónica.</div>;

  const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600';
  const tabs = [['resumen', 'Resumen'], ['centros', 'Centros de gestión'], ['compras', 'Facturas recibidas'], ['ventas', 'Facturas emitidas'], ['configuracion', 'Configuración']];
  return <div className="space-y-5">
    {!embedded && <ModuleHeader title="Facturación Electrónica" subtitle="Centros de gestión, documentos recibidos, facturación de Estados de Pago y gasto real por obra." Icon={WalletCards} onBack={onBack} actions={<button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black"><RefreshCw className="h-4 w-4" />Actualizar</button>} />}
    {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-950">{message}</div>}
    <div className={`rounded-2xl border p-4 ${config.facturacion_habilitada ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{config.facturacion_habilitada ? 'Integración financiera habilitada' : 'Facturación disponible en modo manual'}</p><p className="mt-1 text-xs text-slate-600">{config.facturacion_habilitada ? `${obras.length - obrasWithoutCenter.length} de ${obras.length} obras tienen centro asignado.` : `Puedes operar manualmente. Para imputación automática, crea centros de gestión y asigna las ${obrasWithoutCenter.length} obra${obrasWithoutCenter.length === 1 ? '' : 's'} pendiente${obrasWithoutCenter.length === 1 ? '' : 's'}.`}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-700">{config.proveedor_integracion || 'Carga manual disponible · API no conectada'}</span></div>
    </div>
    <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === id ? 'bg-slate-950 text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{label}</button>)}</div>
    {loading ? <div className="p-12 text-center text-sm text-slate-500">Cargando circuito financiero…</div> : <>
      {tab === 'resumen' && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Kpi icon={FileInput} label="Compras aceptadas" value={money(realCost)} detail={`${acceptedPurchases.length} documentos imputables`} /><Kpi icon={FileOutput} label="Ventas emitidas" value={money(billed)} detail={`${ventas.length} documentos`} /><Kpi icon={Building2} label="Obras vinculadas" value={`${obras.length - obrasWithoutCenter.length}/${obras.length}`} detail={`${obrasWithoutCenter.length} pendientes`} /><Kpi icon={Link2} label="EP facturados" value={ventas.filter(d => d.estado_pago_id).length} detail={`${estadosPago.filter(ep => !ep.factura_documento_id && ['Aprobado','Enviado','Pagado'].includes(ep.estado)).length} aprobados pendientes`} /></div><DocumentTable docs={documentos.slice(0, 10)} centerMap={centerMap} onUpdate={updateDocument} /></div>}
      {tab === 'centros' && <div className="grid gap-4 xl:grid-cols-[360px_1fr]"><form onSubmit={createCenter} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 text-sm font-black"><Plus className="h-4 w-4" />Nuevo centro de gestión</h3><input required placeholder="Código (ej. 001)" value={centroForm.codigo} onChange={e => setCentroForm({ ...centroForm, codigo: e.target.value })} className={input}/><input required placeholder="Nombre del centro" value={centroForm.nombre} onChange={e => setCentroForm({ ...centroForm, nombre: e.target.value })} className={input}/><select value={centroForm.tipo} onChange={e => setCentroForm({ ...centroForm, tipo: e.target.value })} className={input}><option>Obra</option><option>Administración</option><option>Otro</option></select><textarea placeholder="Descripción" value={centroForm.descripcion} onChange={e => setCentroForm({ ...centroForm, descripcion: e.target.value })} className={input}/><button className="w-full rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white">Crear centro</button></form><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black">Asignación obligatoria por obra</h3><p className="mt-1 text-xs text-slate-500">Las facturas recibidas heredan la obra desde el centro seleccionado.</p><div className="mt-4 space-y-2">{obras.map(obra => <div key={obra.id} className="grid items-center gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_280px]"><div><p className="text-xs font-black text-slate-800">{obra.nombre}</p><p className="text-[10px] text-slate-500">{obra.estado || 'Sin estado'}</p></div><select value={obra.centro_gestion_id || ''} onChange={e => assignCenter(obra, e.target.value)} className={input}><option value="">Sin centro asignado</option>{centros.filter(c => c.activo && c.tipo === 'Obra').map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></div>)}</div></section></div>}
      {tab === 'compras' && <div className="space-y-4"><form onSubmit={registerPurchase} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-4"><h3 className="md:col-span-2 xl:col-span-4 text-sm font-black">Registrar factura recibida</h3><select value={purchaseForm.tipo_dte} onChange={e => setPurchaseForm({ ...purchaseForm, tipo_dte: Number(e.target.value) })} className={input}><option value="33">33 · Factura afecta</option><option value="34">34 · Factura exenta</option><option value="61">61 · Nota de crédito</option></select><input required type="number" placeholder="Folio" value={purchaseForm.folio} onChange={e => setPurchaseForm({ ...purchaseForm, folio: e.target.value })} className={input}/><input required type="date" value={purchaseForm.fecha_emision} onChange={e => setPurchaseForm({ ...purchaseForm, fecha_emision: e.target.value })} className={input}/><select required value={purchaseForm.centro_gestion_id} onChange={e => setPurchaseForm({ ...purchaseForm, centro_gestion_id: e.target.value })} className={input}><option value="">Centro de gestión / obra</option>{centros.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}{obraByCenter.get(String(c.id)) ? ` · ${obraByCenter.get(String(c.id)).nombre}` : ''}</option>)}</select><input required placeholder="RUT emisor" value={purchaseForm.rut_emisor} onChange={e => setPurchaseForm({ ...purchaseForm, rut_emisor: e.target.value })} className={input}/><input required placeholder="Razón social emisor" value={purchaseForm.nombre_emisor} onChange={e => setPurchaseForm({ ...purchaseForm, nombre_emisor: e.target.value })} className={input}/><input required type="number" min="0" placeholder="Monto neto / exento" value={purchaseForm.monto_neto} onChange={e => setPurchaseForm({ ...purchaseForm, monto_neto: e.target.value })} className={input}/><select value={purchaseForm.estado_acuse} onChange={e => setPurchaseForm({ ...purchaseForm, estado_acuse: e.target.value })} className={input}><option>Pendiente</option><option>Aceptado</option><option>Reclamado</option></select><button className="rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white md:col-span-2 xl:col-span-4">Registrar y cargar a gasto real</button></form><DocumentTable docs={compras} centerMap={centerMap} onUpdate={updateDocument} /></div>}
      {tab === 'ventas' && <div className="space-y-4"><form onSubmit={registerSale} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-4"><h3 className="md:col-span-2 xl:col-span-4 text-sm font-black">Vincular factura emitida a Estado de Pago</h3><select value={saleForm.tipo_dte} onChange={e => setSaleForm({ ...saleForm, tipo_dte: Number(e.target.value) })} className={input}><option value="33">33 · Factura afecta</option><option value="34">34 · Factura exenta</option></select><input required type="number" placeholder="Folio emitido" value={saleForm.folio} onChange={e => setSaleForm({ ...saleForm, folio: e.target.value })} className={input}/><input required type="date" value={saleForm.fecha_emision} onChange={e => setSaleForm({ ...saleForm, fecha_emision: e.target.value })} className={input}/><select required value={saleForm.estado_pago_id} onChange={e => setSaleForm({ ...saleForm, estado_pago_id: e.target.value })} className={input}><option value="">Estado de Pago aprobado</option>{estadosPago.filter(ep => ['Aprobado','Enviado','Pagado'].includes(ep.estado) && !ep.factura_documento_id).map(ep => <option key={ep.id} value={ep.id}>{ep.obra_nombre} · EP N° {ep.numero} · {money(ep.monto_neto)}</option>)}</select><button className="rounded-xl bg-blue-800 py-2.5 text-xs font-black text-white md:col-span-2 xl:col-span-4">Vincular factura al Estado de Pago</button></form><DocumentTable docs={ventas} centerMap={centerMap} onUpdate={updateDocument} /></div>}
      {tab === 'configuracion' && <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-start gap-3"><Settings2 className="h-6 w-6 text-blue-800"/><div><h3 className="text-base font-black">Configuración de facturación</h3><p className="text-xs text-slate-500">La recepción automática requiere contratar o conectar un proveedor DTE/SII. Obraxis procesará los documentos recibidos por esa integración sin simular respuestas tributarias.</p></div></div><label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-xs font-black"><span>Habilitar facturación para esta empresa</span><input type="checkbox" checked={Boolean(config.facturacion_habilitada)} onChange={e => setConfig({ ...config, facturacion_habilitada: e.target.checked })} className="h-5 w-5"/></label><label className="block text-xs font-black">Proveedor o conector DTE<input value={config.proveedor_integracion || ''} onChange={e => setConfig({ ...config, proveedor_integracion: e.target.value })} placeholder="Ej. API DTE certificada / integración SII" className={`mt-1 ${input}`}/></label><div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600"><p><b>Última sincronización:</b> {config.ultima_sincronizacion ? new Date(config.ultima_sincronizacion).toLocaleString('es-CL') : 'Aún no ejecutada por un conector'}</p><p className="mt-2">Al habilitar: toda obra activa debe tener un centro de gestión; los DTE de compra aceptados alimentan su gasto real; los DTE de venta se vinculan al Estado de Pago correspondiente.</p></div><button onClick={saveConfig} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white"><Save className="h-4 w-4"/>Guardar configuración</button></section>}
    </>}
  </div>;
}

function Kpi({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="h-5 w-5 text-blue-800"/><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>;
}

function DocumentTable({ docs, centerMap, onUpdate }) {
  if (!docs.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-xs text-slate-500">No existen documentos en esta vista.</div>;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500"><tr><th className="px-3 py-3">Documento</th><th className="px-3 py-3">Contraparte</th><th className="px-3 py-3">Centro / obra</th><th className="px-3 py-3">Neto</th><th className="px-3 py-3">IVA</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{docs.map(doc => <tr key={doc.id} className="hover:bg-slate-50"><td className="px-3 py-3"><b>{dteName(doc.tipo_dte)} N° {doc.folio}</b><p className="text-[10px] text-slate-500">{doc.fecha_emision} · {doc.origen || 'Manual'}</p></td><td className="px-3 py-3">{doc.direccion_flujo === 'Compra' ? (doc.nombre_emisor || doc.nombre_receptor) : doc.nombre_receptor}<p className="text-[10px] text-slate-500">{doc.direccion_flujo}</p></td><td className="px-3 py-3">{centerMap.get(String(doc.centro_gestion_id))?.nombre || 'Sin centro'}<p className="text-[10px] text-slate-500">{doc.obra_nombre || 'Corporativo'}</p></td><td className="px-3 py-3 font-mono">{money(doc.monto_neto)}</td><td className="px-3 py-3 font-mono">{money(doc.monto_iva)}</td><td className="px-3 py-3 font-mono font-black">{money(doc.monto_total)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${doc.estado_sii === 'Rechazado' || doc.estado_acuse === 'Reclamado' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{doc.estado_acuse || doc.estado_sii}</span>{doc.estado_pago_id && <p className="mt-1 text-[10px] font-bold text-blue-800">Vinculado a EP</p>}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{doc.direccion_flujo === 'Compra' && doc.estado_acuse === 'Pendiente' && <><button onClick={() => onUpdate(doc, { estado_acuse: 'Aceptado', estado_sii: 'Aceptado' })} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800">Aceptar</button><button onClick={() => onUpdate(doc, { estado_acuse: 'Reclamado', estado_sii: 'Rechazado' })} className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-800">Reclamar</button></>}{doc.direccion_flujo === 'Venta' && doc.estado_pago !== 'Pagada' && <button onClick={() => onUpdate(doc, { estado_pago: 'Pagada' })} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-800">Marcar pagada</button>}</div></td></tr>)}</tbody></table></div>;
}
