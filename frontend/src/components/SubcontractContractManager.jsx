import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, ClipboardList, Copy, ExternalLink, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900';
const emptyContract = {
  codigo: '', nombre: '', tipo_vinculo: 'Ejecución de partidas', descripcion: '', moneda: 'CLP', monto_contrato: '',
  fecha_inicio: '', fecha_termino: '', estado: 'Borrador', reporta_avances: true, reporta_asistencia: true,
  reporta_estados_pago: true, responsable_operacion_nombre: '', responsable_operacion_email: '', observaciones: ''
};
const emptyItem = { tipo_item: 'Partida', partida_id: '', codigo: '', descripcion: '', unidad: '', cantidad: '', precio_unitario: '', reporta_avance: true };
const money = (value, currency = 'CLP') => `${currency} ${Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: currency === 'CLP' ? 0 : 2 })}`;
const actor = user => user?.nombre || user?.usuario || user?.correo || 'Usuario Obraxis';

const defaultsForType = type => ({
  reporta_avances: type === 'Ejecución de partidas',
  reporta_asistencia: type === 'Ejecución de partidas',
  reporta_estados_pago: true
});

export default function SubcontractContractManager({ obra, user, subcontracts = [] }) {
  const { permissions } = useUserPermissions(user);
  const mayConfigure = can(user, permissions, 'obras.subcontratos.configurar');
  const [contracts, setContracts] = useState([]);
  const [items, setItems] = useState([]);
  const [parts, setParts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyContract);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ contacto_nombre: '', contacto_email: '' });
  const [issuedKey, setIssuedKey] = useState('');

  const load = useCallback(async () => {
    const [contractResult, itemResult, partResult, profileResult] = await Promise.all([
      supabase.from('subcontrato_contratos').select('*').eq('empresa', user.empresa).eq('obra_id', obra.id).order('created_at', { ascending: false }),
      supabase.from('subcontrato_contrato_items').select('*').eq('empresa', user.empresa).order('orden'),
      supabase.from('partidas_obra').select('id,codigo,partida,unidad,cantidad_presupuestada,es_titulo').eq('empresa', user.empresa).eq('obra_id', obra.id).eq('es_titulo', false).order('orden'),
      supabase.from('subcontrato_operacion_perfiles').select('id,empresa,obra_id,subcontratista_id,contacto_nombre,contacto_email,token_acceso,activo,creado_por,created_at,updated_at').eq('empresa', user.empresa).eq('obra_id', obra.id)
    ]);
    const error = contractResult.error || itemResult.error || partResult.error || profileResult.error;
    if (error) return setMessage(error.message);
    setContracts(contractResult.data || []);
    setItems(itemResult.data || []);
    setParts(partResult.data || []);
    setProfiles(profileResult.data || []);
  }, [obra.id, user.empresa]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selectedSubId && subcontracts.length) setSelectedSubId(String(subcontracts[0].id));
  }, [selectedSubId, subcontracts]);

  const selectedSub = subcontracts.find(item => String(item.id) === String(selectedSubId));
  const selectedProfile = profiles.find(item => String(item.subcontratista_id) === String(selectedSubId));
  const subContracts = contracts.filter(item => String(item.subcontratista_id) === String(selectedSubId));
  const selectedContract = contracts.find(item => String(item.id) === String(selectedContractId));
  const selectedItems = items.filter(item => String(item.contrato_id) === String(selectedContractId));
  const calculatedTotal = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0), [selectedItems]);
  const contractItemTotal = contractId => items.filter(item => String(item.contrato_id) === String(contractId)).reduce((sum, item) => sum + Number(item.cantidad || 0) * Number(item.precio_unitario || 0), 0);
  const visibleTotal = contract => Number(contract.monto_contrato || 0) || contractItemTotal(contract.id);
  const operationUrl = selectedProfile ? `${window.location.origin}/?subcontrato_operacion=${encodeURIComponent(selectedProfile.token_acceso)}` : '';

  useEffect(() => {
    setProfileForm({ contacto_nombre: selectedProfile?.contacto_nombre || '', contacto_email: selectedProfile?.contacto_email || '' });
  }, [selectedProfile, selectedSubId]);

  const saveProfile = async event => {
    event.preventDefault();
    if (!mayConfigure || !selectedSub || !profileForm.contacto_nombre.trim()) return;
    const newKey = selectedProfile ? '' : generateKey();
    const newToken = selectedProfile?.token_acceso || `op_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
    const claveHash = newKey ? await sha256(`${newToken}:${newKey}`) : '';
    const payload = {
      empresa: user.empresa, obra_id: obra.id, subcontratista_id: selectedSub.id,
      contacto_nombre: profileForm.contacto_nombre.trim(), contacto_email: profileForm.contacto_email.trim().toLowerCase() || null,
      token_acceso: newToken,
      activo: true, creado_por: selectedProfile?.creado_por || actor(user), updated_at: new Date().toISOString()
    };
    if (claveHash) payload.clave_hash = claveHash;
    const query = selectedProfile
      ? supabase.from('subcontrato_operacion_perfiles').update(payload).eq('id', selectedProfile.id)
      : supabase.from('subcontrato_operacion_perfiles').insert(payload);
    const { error } = await query;
    if (error) return setMessage(error.message);
    if (newKey) setIssuedKey(newKey);
    setMessage(newKey ? 'Acceso creado. Copia ahora la clave: sólo se mostrará en esta sesión.' : 'Contacto operacional actualizado.'); await load();
  };

  const regenerateKey = async () => {
    if (!mayConfigure || !selectedProfile || !window.confirm('La clave anterior dejará de funcionar. ¿Regenerarla?')) return;
    const newKey = generateKey();
    const { error } = await supabase.from('subcontrato_operacion_perfiles').update({ clave_hash: await sha256(`${selectedProfile.token_acceso}:${newKey}`), updated_at: new Date().toISOString() }).eq('id', selectedProfile.id);
    if (error) return setMessage(error.message);
    setIssuedKey(newKey); setMessage('Clave regenerada. Cópiala ahora: no podrá volver a consultarse.');
  };

  const openNew = () => {
    if (!selectedSub) return setMessage('Selecciona un subcontratista.');
    setSelectedContractId(''); setForm(emptyContract); setItemForm(emptyItem); setFormOpen(true); setMessage('');
  };

  const openEdit = contract => {
    setSelectedContractId(String(contract.id));
    setForm({ ...emptyContract, ...contract, monto_contrato: contract.monto_contrato ?? '', fecha_inicio: contract.fecha_inicio || '', fecha_termino: contract.fecha_termino || '' });
    setItemForm(contract.tipo_vinculo === 'Ejecución de partidas' ? emptyItem : { ...emptyItem, tipo_item: contract.tipo_vinculo === 'Prestación de servicios' ? 'Servicio' : contract.tipo_vinculo, partida_id: '', reporta_avance: false });
    setFormOpen(true); setMessage('');
  };

  const saveContract = async event => {
    event.preventDefault();
    if (!mayConfigure) return setMessage('Tu perfil no puede configurar contratos de subcontratistas.');
    if (!selectedSub) return;
    setBusy(true); setMessage('');
    const payload = {
      ...form, empresa: user.empresa, obra_id: obra.id, obra_nombre: obra.nombre, subcontratista_id: selectedSub.id,
      codigo: form.codigo.trim().toUpperCase(), nombre: form.nombre.trim(), monto_contrato: Number(form.monto_contrato) || 0,
      fecha_inicio: form.fecha_inicio || null, fecha_termino: form.fecha_termino || null,
      descripcion: form.descripcion.trim() || null, responsable_operacion_nombre: form.responsable_operacion_nombre.trim() || null,
      responsable_operacion_email: form.responsable_operacion_email.trim().toLowerCase() || null, observaciones: form.observaciones.trim() || null,
      creado_por: selectedContractId ? selectedContract?.creado_por : actor(user), updated_at: new Date().toISOString()
    };
    const query = selectedContractId
      ? supabase.from('subcontrato_contratos').update(payload).eq('id', selectedContractId).select().single()
      : supabase.from('subcontrato_contratos').insert(payload).select().single();
    const { data, error } = await query;
    setBusy(false);
    if (error) return setMessage(error.code === '23505' ? 'El código de contrato ya existe en la empresa.' : error.message);
    setSelectedContractId(String(data.id)); setFormOpen(true); setMessage('Ficha contractual guardada.'); await load();
  };

  const selectPart = partId => {
    const part = parts.find(value => String(value.id) === String(partId));
    setItemForm(current => ({ ...current, partida_id: partId, codigo: part?.codigo || '', descripcion: part?.partida || '', unidad: part?.unidad || '', cantidad: part?.cantidad_presupuestada || '' }));
  };

  const addItem = async event => {
    event.preventDefault();
    if (!mayConfigure || !selectedContract) return;
    const payload = {
      ...itemForm, contrato_id: selectedContract.id, empresa: user.empresa, partida_id: itemForm.tipo_item === 'Partida' ? Number(itemForm.partida_id) : null,
      codigo: itemForm.codigo.trim() || null, descripcion: itemForm.descripcion.trim(), unidad: itemForm.unidad.trim() || null,
      cantidad: Number(itemForm.cantidad) || 0, precio_unitario: Number(itemForm.precio_unitario) || 0,
      orden: selectedItems.length * 10 + 10, updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('subcontrato_contrato_items').insert(payload);
    if (error) return setMessage(error.message);
    setItemForm(selectedContract.tipo_vinculo === 'Ejecución de partidas' ? emptyItem : { ...emptyItem, tipo_item: selectedContract.tipo_vinculo === 'Prestación de servicios' ? 'Servicio' : selectedContract.tipo_vinculo, partida_id: '', reporta_avance: false });
    setMessage('Ítem contractual agregado.'); await load();
  };

  const removeItem = async item => {
    if (!mayConfigure || !window.confirm(`¿Eliminar “${item.descripcion}” del contrato?`)) return;
    const { error } = await supabase.from('subcontrato_contrato_items').delete().eq('id', item.id);
    if (error) return setMessage(error.message);
    setMessage('Ítem eliminado.'); await load();
  };

  return <section id="subcontract-contract-manager" className="space-y-4 rounded-3xl border bg-white p-5">
    <style>{`#subcontract-contract-manager input[placeholder="Responsable operacional"], #subcontract-contract-manager input[placeholder^="Correo operacional"] { display: none; }`}</style>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-orange-50 p-2 text-orange-700"><BriefcaseBusiness className="h-5 w-5"/></div><div><h3 className="font-black">Ficha contractual del subcontratista</h3><p className="text-xs text-slate-500">Configura partidas, servicios, arriendos o suministros y define exactamente qué debe reportar.</p></div></div>
      {mayConfigure && <button onClick={openNew} disabled={!selectedSub} className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"><Plus className="h-4 w-4"/>Nuevo contrato</button>}
    </div>
    {message && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2"><p className="text-[10px] font-black uppercase text-slate-500">Subcontratista</p>{subcontracts.map(sub => <button key={sub.id} onClick={() => { setSelectedSubId(String(sub.id)); setSelectedContractId(''); setFormOpen(false); setIssuedKey(''); }} className={`w-full rounded-xl border p-3 text-left ${String(sub.id) === String(selectedSubId) ? 'border-orange-400 bg-orange-50' : 'bg-white'}`}><p className="text-xs font-black">{sub.empresa_nombre}</p><p className="text-[10px] text-slate-500">{sub.rut_empresa}</p></button>)}{!subcontracts.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Primero registra el subcontratista en Acreditaciones.</p>}</div>
      <div className="space-y-3"><p className="text-[10px] font-black uppercase text-slate-500">Contratos, órdenes o servicios</p>{subContracts.map(contract => { const total = visibleTotal(contract); return <button key={contract.id} onClick={() => openEdit(contract)} className={`w-full rounded-2xl border p-4 text-left ${String(contract.id) === String(selectedContractId) ? 'border-orange-400 bg-orange-50' : 'bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-orange-700">{contract.codigo} · {contract.tipo_vinculo}</p><p className="font-black">{contract.nombre}</p><p className="text-[11px] text-slate-500">{total > 0 ? money(total, contract.moneda) : 'Monto pendiente'}{!Number(contract.monto_contrato || 0) && total > 0 ? ' · suma de ítems' : ''} · {contract.estado}</p></div><Pencil className="h-4 w-4 text-slate-400"/></div><div className="mt-3 flex flex-wrap gap-1">{contract.reporta_avances && <Tag>Avances</Tag>}{contract.reporta_asistencia && <Tag>Asistencia</Tag>}{contract.reporta_estados_pago && <Tag>Estados de pago</Tag>}{!contract.reporta_avances && !contract.reporta_asistencia && !contract.reporta_estados_pago && <Tag>Sin reportes</Tag>}</div></button>; })}{selectedSub && !subContracts.length && <p className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-xs text-slate-500">Sin ficha contractual. Puede ser un subcontratista pendiente o un vínculo que no requiere operación.</p>}</div>
    </div>
    {selectedSub && <form onSubmit={saveProfile} className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3 flex items-center gap-2"><KeyRound className="h-5 w-5 text-blue-800"/><div><h4 className="font-black">Contacto y minisitio operacional</h4><p className="text-[11px] text-slate-600">Se configura una sola vez para todos los contratos de {selectedSub.empresa_nombre} en esta obra.</p></div></div><div className="grid gap-2 md:grid-cols-2"><input required disabled={!mayConfigure} className={input} placeholder="Nombre del contacto operacional" value={profileForm.contacto_nombre} onChange={e => setProfileForm({...profileForm,contacto_nombre:e.target.value})}/><input disabled={!mayConfigure} type="email" className={input} placeholder="Correo operacional" value={profileForm.contacto_email} onChange={e => setProfileForm({...profileForm,contacto_email:e.target.value})}/>{mayConfigure && <button className="rounded-xl bg-blue-900 py-2.5 text-xs font-black text-white md:col-span-2">{selectedProfile ? 'Actualizar contacto operacional' : 'Crear acceso operacional'}</button>}</div>{selectedProfile && <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1fr_auto_auto_auto]"><div className="min-w-0"><p className="text-[10px] font-black uppercase text-slate-500">Clave operacional</p><p className="font-mono text-sm font-black">{issuedKey || '•••••• · protegida'}</p><p className="truncate text-[10px] text-slate-500">{operationUrl}</p></div>{issuedKey && <button type="button" onClick={() => navigator.clipboard.writeText(`${operationUrl}\nClave: ${issuedKey}`)} className="flex items-center justify-center gap-1 rounded-xl border px-3 text-xs font-black"><Copy className="h-4 w-4"/>Copiar acceso</button>}<button type="button" onClick={regenerateKey} className="rounded-xl border px-3 text-xs font-black">Regenerar clave</button><a href={operationUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-slate-950 px-3 text-xs font-black text-white"><ExternalLink className="h-4 w-4"/>Abrir minisitio</a></div>}</form>}
    {formOpen && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><form onSubmit={saveContract} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input required className={input} placeholder="Código contrato / OC" value={form.codigo} onChange={e => setForm({...form,codigo:e.target.value})}/><input required className={`${input} xl:col-span-2`} placeholder="Nombre o alcance" value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})}/><select className={input} value={form.tipo_vinculo} onChange={e => setForm({...form,tipo_vinculo:e.target.value,...defaultsForType(e.target.value)})}>{['Ejecución de partidas','Prestación de servicios','Arriendo','Suministro','Otro'].map(value => <option key={value}>{value}</option>)}</select><textarea className={`${input} md:col-span-2 xl:col-span-4`} placeholder="Descripción del alcance" value={form.descripcion || ''} onChange={e => setForm({...form,descripcion:e.target.value})}/><select className={input} value={form.moneda} onChange={e => setForm({...form,moneda:e.target.value})}>{['CLP','UF','USD'].map(value => <option key={value}>{value}</option>)}</select><input className={input} type="number" min="0" step="any" placeholder="Monto global (opcional; si queda vacío se suman los ítems)" value={form.monto_contrato} onChange={e => setForm({...form,monto_contrato:e.target.value})}/><input className={input} type="date" value={form.fecha_inicio} onChange={e => setForm({...form,fecha_inicio:e.target.value})}/><input className={input} type="date" value={form.fecha_termino} onChange={e => setForm({...form,fecha_termino:e.target.value})}/><select className={input} value={form.estado} onChange={e => setForm({...form,estado:e.target.value})}>{['Borrador','Vigente','Suspendido','Terminado','Cerrado'].map(value => <option key={value}>{value}</option>)}</select><div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4"><Toggle checked={form.reporta_avances} onChange={value => setForm({...form,reporta_avances:value})}>Reporta avances</Toggle><Toggle checked={form.reporta_asistencia} onChange={value => setForm({...form,reporta_asistencia:value})}>Reporta asistencia</Toggle><Toggle checked={form.reporta_estados_pago} onChange={value => setForm({...form,reporta_estados_pago:value})}>Presenta estados de pago</Toggle></div><textarea className={`${input} md:col-span-2 xl:col-span-4`} placeholder="Observaciones contractuales" value={form.observaciones || ''} onChange={e => setForm({...form,observaciones:e.target.value})}/><button disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-black text-white md:col-span-2 xl:col-span-4"><Check className="h-4 w-4"/>{busy ? 'Guardando…' : 'Guardar ficha contractual'}</button></form>
      {selectedContract && <div className="mt-5 border-t border-orange-200 pt-4"><div className="mb-3 flex items-center justify-between"><div><h4 className="font-black">Partidas, servicios o recursos contratados</h4><p className="text-[11px] text-slate-500">Total de ítems: {calculatedTotal > 0 ? money(calculatedTotal, selectedContract.moneda) : 'pendiente de precios'}. Si existe monto global, éste prevalece.</p></div><ClipboardList className="h-5 w-5 text-orange-700"/></div><div className="space-y-2">{selectedItems.map(item => <div key={item.id} className="grid items-center gap-2 rounded-xl bg-white p-3 md:grid-cols-[auto_1fr_auto_auto]"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black">{item.tipo_item}</span><div><p className="text-xs font-black">{item.codigo ? `${item.codigo} · ` : ''}{item.descripcion}</p><p className="text-[10px] text-slate-500">{Number(item.cantidad).toLocaleString('es-CL')} {item.unidad || ''} × {Number(item.precio_unitario) > 0 ? money(item.precio_unitario, selectedContract.moneda) : 'precio pendiente'}</p></div><span className="text-xs font-black">{Number(item.precio_unitario) > 0 ? money(Number(item.cantidad) * Number(item.precio_unitario), selectedContract.moneda) : 'Pendiente'}</span>{mayConfigure && <button type="button" onClick={() => removeItem(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button>}</div>)}{!selectedItems.length && <p className="rounded-xl bg-white p-4 text-center text-xs text-slate-500">Aún no hay partidas o servicios agregados.</p>}</div>{mayConfigure && <form onSubmit={addItem} className="mt-3 grid gap-2 rounded-xl bg-white p-3 md:grid-cols-2 xl:grid-cols-6"><select className={input} value={itemForm.tipo_item} onChange={e => setItemForm({...itemForm,tipo_item:e.target.value,partida_id:'',codigo:'',descripcion:'',unidad:'',cantidad:'',precio_unitario:'',reporta_avance:e.target.value === 'Partida'})}>{['Partida','Servicio','Arriendo','Suministro','Otro'].map(value => <option key={value}>{value}</option>)}</select>{itemForm.tipo_item === 'Partida' ? <select required className={`${input} xl:col-span-2`} value={itemForm.partida_id} onChange={e => selectPart(e.target.value)}><option value="">Partida de la obra</option>{parts.map(part => <option key={part.id} value={part.id}>{part.codigo ? `${part.codigo} · ` : ''}{part.partida}</option>)}</select> : <input required className={`${input} xl:col-span-2`} placeholder="Descripción del servicio o recurso" value={itemForm.descripcion} onChange={e => setItemForm({...itemForm,descripcion:e.target.value})}/>}<input className={input} placeholder="Unidad" value={itemForm.unidad} onChange={e => setItemForm({...itemForm,unidad:e.target.value})}/><input required className={input} type="number" min="0.000001" step="any" placeholder="Cantidad" value={itemForm.cantidad} onChange={e => setItemForm({...itemForm,cantidad:e.target.value})}/><input required className={input} type="number" min="0.000001" step="any" placeholder="Precio unitario contratado" value={itemForm.precio_unitario} onChange={e => setItemForm({...itemForm,precio_unitario:e.target.value})}/><button className="flex items-center justify-center gap-1 rounded-xl bg-orange-600 py-2.5 text-xs font-black text-white md:col-span-2 xl:col-span-6"><Plus className="h-4 w-4"/>Agregar al contrato</button></form>}</div>}
    </div>}
  </section>;
}

function Tag({ children }) { return <span className="rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-800">{children}</span>; }
function Toggle({ checked, onChange, children }) { return <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${checked ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4"/>{children}</label>; }
async function sha256(value) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function generateKey() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const values = crypto.getRandomValues(new Uint8Array(10)); return Array.from(values, value => alphabet[value % alphabet.length]).join(''); }
