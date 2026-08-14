import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Copy, KeyRound, Loader2, Plus, Save, Settings2, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sendSystemEmail } from '../utils/emailService';
import { formatRut } from '../utils/rutUtils';
import ModuleHeader from './ModuleHeader';

const PERMISSION_OPTIONS = [
  ['estatus', 'Estatus de la obra'], ['avance', 'Avance físico'], ['programacion', 'Programación'],
  ['estadisticas', 'Estadísticas'], ['bitacora', 'Bitácora'], ['calidad', 'Calidad'],
  ['prevencion', 'Prevención'], ['estados_pago', 'Estados de pago'], ['libro_obra', 'Libro de obra'],
];
const SAFE_DEFAULTS = { estatus: true, avance: true, programacion: true, estadisticas: true, bitacora: false, calidad: false, prevencion: false, estados_pago: false, libro_obra: false };
const newForm = () => ({ cliente_nombre: '', cliente_rut: '', contacto_nombre: '', contacto_email: '', contacto_cargo: '', obras: [], permisos: { ...SAFE_DEFAULTS }, permite_comentar: false });
const accessCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8))).map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('').slice(0, 10);
const hashCode = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toUpperCase())))).map(b => b.toString(16).padStart(2, '0')).join('');
const portalUrl = token => `${window.location.origin}/?cliente_portal=${token}`;

export default function ClientesPortal({ user, onBack }) {
  const empresa = user?.empresa;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portals, setPortals] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [events, setEvents] = useState([]);
  const [obras, setObras] = useState([]);
  const [form, setForm] = useState(newForm());
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState('portales');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState({});

  const load = async () => {
    if (!empresa) return;
    setLoading(true); setError('');
    const [p, a, e, o] = await Promise.all([
      supabase.from('clientes_portales').select('*').eq('empresa', empresa).order('created_at', { ascending: false }),
      supabase.from('clientes_portal_obras').select('*').eq('empresa', empresa).order('obra_nombre'),
      supabase.from('clientes_portal_eventos').select('*').eq('empresa', empresa).order('created_at', { ascending: false }).limit(100),
      supabase.from('obras').select('nombre,estado,cliente').eq('empresa', empresa).order('nombre'),
    ]);
    const firstError = [p, a, e, o].find(x => x.error)?.error;
    if (firstError) setError(firstError.message);
    setPortals(p.data || []); setAccesses(a.data || []); setEvents(e.data || []); setObras(o.data || []); setLoading(false);
  };
  useEffect(() => { load(); }, [empresa]);

  const accessByPortal = useMemo(() => accesses.reduce((acc, item) => { (acc[item.portal_id] ||= []).push(item); return acc; }, {}), [accesses]);
  const clearForm = () => { setEditing(null); setForm(newForm()); setTab('portales'); setError(''); };
  const toggleObra = nombre => setForm(v => ({ ...v, obras: v.obras.includes(nombre) ? v.obras.filter(x => x !== nombre) : [...v.obras, nombre] }));

  const editPortal = portal => {
    const rows = accessByPortal[portal.id] || [];
    setEditing(portal.id);
    setForm({ cliente_nombre: portal.cliente_nombre, cliente_rut: portal.cliente_rut, contacto_nombre: portal.contacto_nombre, contacto_email: portal.contacto_email, contacto_cargo: portal.contacto_cargo || '', obras: rows.map(r => r.obra_nombre), permisos: { ...SAFE_DEFAULTS, ...(rows[0]?.permisos || {}) }, permite_comentar: Boolean(rows[0]?.permite_comentar) });
    setTab('configurar');
  };

  const syncAccesses = async portalId => {
    const existing = accessByPortal[portalId] || [];
    const removed = existing.filter(row => !form.obras.includes(row.obra_nombre)).map(row => row.id);
    if (removed.length) await supabase.from('clientes_portal_obras').delete().in('id', removed);
    if (form.obras.length) {
      const rows = form.obras.map(obra_nombre => ({ portal_id: portalId, empresa, obra_nombre, permisos: form.permisos, permite_comentar: form.permite_comentar, publicada: true, updated_at: new Date().toISOString() }));
      const { error: accessError } = await supabase.from('clientes_portal_obras').upsert(rows, { onConflict: 'portal_id,obra_nombre' });
      if (accessError) throw accessError;
    }
  };

  const save = async () => {
    setError(''); setMessage('');
    if (!form.cliente_nombre.trim() || !form.cliente_rut.trim() || !form.contacto_nombre.trim() || !form.contacto_email.trim() || !form.obras.length) return setError('Completa cliente, RUT, contacto, correo y al menos una obra.');
    setSaving(true);
    try {
      if (editing) {
        const { error: updateError } = await supabase.from('clientes_portales').update({ cliente_nombre: form.cliente_nombre.trim(), cliente_rut: formatRut(form.cliente_rut), contacto_nombre: form.contacto_nombre.trim(), contacto_email: form.contacto_email.trim().toLowerCase(), contacto_cargo: form.contacto_cargo.trim(), updated_at: new Date().toISOString() }).eq('id', editing);
        if (updateError) throw updateError;
        await syncAccesses(editing);
        setMessage('Portal y permisos actualizados.');
      } else {
        const code = accessCode();
        const { data, error: insertError } = await supabase.from('clientes_portales').insert({ empresa, cliente_nombre: form.cliente_nombre.trim(), cliente_rut: formatRut(form.cliente_rut), contacto_nombre: form.contacto_nombre.trim(), contacto_email: form.contacto_email.trim().toLowerCase(), contacto_cargo: form.contacto_cargo.trim(), clave_hash: await hashCode(code), creado_por: user?.nombre || user?.correo }).select().single();
        if (insertError) throw insertError;
        await syncAccesses(data.id);
        setRevealed(v => ({ ...v, [data.id]: code }));
        const mail = await sendSystemEmail({
          to: data.contacto_email,
          subject: `Acceso al Portal del Cliente - ${empresa}`,
          htmlContent: `<div style="max-width:650px;margin:auto;background:white;border-radius:18px;padding:28px"><h2 style="color:#0f172a">Portal del Cliente</h2><p>${data.contacto_nombre}, ${empresa} habilitó un espacio para consultar la información autorizada de sus obras.</p><p><a href="${portalUrl(data.token)}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:white;border-radius:10px;text-decoration:none;font-weight:bold">Ingresar al portal</a></p><p>Clave de acceso: <strong style="font-size:20px;letter-spacing:2px">${code}</strong></p><p style="color:#64748b">La clave es personal. No la compartas.</p></div>`,
          permissionKey: 'clientes.portales.enviar',
        });
        setMessage(mail.success ? 'Portal creado y credenciales enviadas.' : `Portal creado. No se pudo enviar el correo: ${mail.error || 'revisa la configuración de correo'}.`);
      }
      await load(); setTab('portales'); setEditing(null); setForm(newForm());
    } catch (err) { setError(err.message || 'No fue posible guardar el portal.'); }
    finally { setSaving(false); }
  };

  const regenerate = async portal => {
    const code = accessCode();
    const { error: updateError } = await supabase.from('clientes_portales').update({ clave_hash: await hashCode(code), updated_at: new Date().toISOString() }).eq('id', portal.id);
    if (updateError) return setError(updateError.message);
    setRevealed(v => ({ ...v, [portal.id]: code })); setMessage('Nueva clave generada. Cópiala o reenvíala al contacto.');
  };
  const toggleActive = async portal => { await supabase.from('clientes_portales').update({ activo: !portal.activo, updated_at: new Date().toISOString() }).eq('id', portal.id); load(); };
  const copy = async value => { await navigator.clipboard.writeText(value); setMessage('Copiado al portapapeles.'); };

  return <div className="space-y-5">
    <ModuleHeader title="Clientes y Portal del Cliente" subtitle="Habilita espacios protegidos y define qué puede consultar cada cliente en sus obras." Icon={Users} onBack={onBack} actions={<button onClick={() => { setForm(newForm()); setEditing(null); setTab('configurar'); }} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" />Nuevo portal</button>} />
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">{[['portales','Portales'],['configurar', editing ? 'Editar portal' : 'Configurar portal'],['actividad','Actividad']].map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === id ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div>
    {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div>}
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</div>}
    {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : tab === 'portales' ? <div className="grid gap-4 xl:grid-cols-2">
      {portals.length === 0 && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aún no existen portales de clientes.</div>}
      {portals.map(portal => <article key={portal.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-slate-900">{portal.cliente_nombre}</p><p className="text-xs font-bold text-slate-500">RUT {portal.cliente_rut}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${portal.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{portal.activo ? 'Activo' : 'Archivado'}</span></div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-800">{portal.contacto_nombre}</p><p className="text-xs text-slate-500">{portal.contacto_cargo || 'Contacto'} · {portal.contacto_email}</p></div>
        <div className="mt-4 flex flex-wrap gap-2">{(accessByPortal[portal.id] || []).map(row => <span key={row.id} className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600">{row.obra_nombre}</span>)}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => copy(portalUrl(portal.token))} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black"><Copy className="h-4 w-4" />Copiar enlace</button><button onClick={() => editPortal(portal)} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"><Settings2 className="h-4 w-4" />Permisos y obras</button></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2"><button onClick={() => regenerate(portal)} className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 px-3 py-2 text-xs font-black text-amber-800"><KeyRound className="h-4 w-4" />Regenerar clave</button><button onClick={() => toggleActive(portal)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-600"><Archive className="h-4 w-4" />{portal.activo ? 'Archivar' : 'Reactivar'}</button></div>
        {revealed[portal.id] && <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"><span className="text-xs font-bold text-amber-900">Clave nueva: <strong className="ml-2 tracking-widest">{revealed[portal.id]}</strong></span><button onClick={() => copy(revealed[portal.id])}><Copy className="h-4 w-4" /></button></div>}
        <p className="mt-3 text-[11px] text-slate-400">Último acceso: {portal.ultimo_acceso ? new Date(portal.ultimo_acceso).toLocaleString('es-CL') : 'Sin accesos'}</p>
      </article>)}
    </div> : tab === 'configurar' ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[['cliente_nombre','Nombre o razón social del cliente'],['cliente_rut','RUT de la empresa cliente'],['contacto_nombre','Nombre del contacto'],['contacto_email','Correo del contacto'],['contacto_cargo','Cargo del contacto']].map(([key,label]) => <label key={key} className="text-xs font-black text-slate-600">{label}<input value={form[key]} onChange={e => setForm(v => ({ ...v, [key]: key === 'cliente_rut' ? formatRut(e.target.value) : e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-primary" /></label>)}</div>
      <div className="mt-6"><h3 className="text-sm font-black text-slate-900">Obras visibles</h3><p className="mt-1 text-xs text-slate-500">El cliente sólo tendrá acceso a las obras seleccionadas.</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{obras.map(obra => <button type="button" key={obra.nombre} onClick={() => toggleObra(obra.nombre)} className={`flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold ${form.obras.includes(obra.nombre) ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 text-slate-600'}`}><span>{obra.nombre}</span>{form.obras.includes(obra.nombre) && <Check className="h-4 w-4" />}</button>)}</div></div>
      <div className="mt-6"><h3 className="text-sm font-black text-slate-900">Información autorizada</h3><p className="mt-1 text-xs text-slate-500">Los costos reales, márgenes y antecedentes internos nunca forman parte del portal.</p><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{PERMISSION_OPTIONS.map(([key,label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={Boolean(form.permisos[key])} onChange={e => setForm(v => ({ ...v, permisos: { ...v.permisos, [key]: e.target.checked } }))} className="h-4 w-4 accent-primary" />{label}</label>)}</div></div>
      <label className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900"><input type="checkbox" checked={form.permite_comentar} onChange={e => setForm(v => ({ ...v, permite_comentar: e.target.checked }))} className="h-4 w-4" />Permitir que el contacto envíe comentarios desde el portal</label>
      <div className="mt-6 flex justify-end gap-2"><button onClick={clearForm} className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-black text-slate-600">Cancelar</button><button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editing ? 'Guardar cambios' : 'Crear y enviar credenciales'}</button></div>
    </section> : <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h3 className="font-black text-slate-900">Trazabilidad de accesos y comentarios</h3></div>{events.length === 0 ? <p className="p-8 text-sm text-slate-500">Aún no hay actividad.</p> : <div className="divide-y divide-slate-100">{events.map(event => <div key={event.id} className="grid gap-1 p-4 md:grid-cols-[180px_1fr_200px]"><span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('es-CL')}</span><div><p className="text-sm font-black text-slate-800">{event.accion}</p><p className="text-xs text-slate-500">{event.detalle || event.obra_nombre || 'Portal del cliente'}</p></div><span className="text-xs font-bold text-slate-600">{event.actor || 'Sistema Obraxis'}</span></div>)}</div>}</section>}
  </div>;
}
