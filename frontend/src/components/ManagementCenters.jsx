import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';

export default function ManagementCenters({ user }) {
  const { permissions } = useUserPermissions(user);
  const allowed = can(user, permissions, 'facturacion.maestros.configurar') || can(user, permissions, 'admin.permisos.configurar');
  const [centers, setCenters] = useState([]);
  const [works, setWorks] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo: 'Obra' });
  const field = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-xs';
  const load = async () => {
    const [c, w] = await Promise.all([
      supabase.from('facturacion_centros_gestion').select('id,codigo,nombre,tipo,activo').eq('empresa', user.empresa).order('codigo'),
      supabase.from('obras').select('id,nombre,centro_gestion_id').eq('empresa', user.empresa).order('nombre')
    ]);
    if (c.error || w.error) return setMessage((c.error || w.error).message);
    setCenters(c.data || []); setWorks(w.data || []);
  };
  useEffect(() => { load(); }, [user.empresa]);
  const create = async event => {
    event.preventDefault(); if (!allowed || busy) return;
    setBusy(true);
    const { error } = await supabase.from('facturacion_centros_gestion').insert({ ...form, codigo: form.codigo.trim(), nombre: form.nombre.trim(), empresa: user.empresa, activo: true });
    setBusy(false);
    if (error) return setMessage(error.message);
    setForm({ codigo: '', nombre: '', tipo: 'Obra' }); setMessage('Centro creado. Ahora puedes asignarlo a su obra.'); await load();
  };
  const assign = async (work, value) => {
    if (!allowed || busy) return;
    if (value && works.some(item => item.id !== work.id && String(item.centro_gestion_id) === value)) return setMessage('Ese centro ya está asignado a otra obra.');
    setBusy(true);
    const { error } = await supabase.from('obras').update({ centro_gestion_id: value ? Number(value) : null }).eq('empresa', user.empresa).eq('id', work.id).select('id').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage('Centro de gestión asignado a la obra.'); await load();
  };
  return <div className="space-y-4"><div><h3 className="text-lg font-black">Centros de gestión</h3><p className="text-sm text-slate-500">Cada obra utiliza su propio centro. Los centros administrativos permiten agrupar personal y gastos sin obra.</p></div>{message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm">{message}</p>}<div className="grid gap-4 lg:grid-cols-2"><form onSubmit={create} className="space-y-3 rounded-2xl border bg-white p-5"><h4 className="font-bold">Crear centro</h4><input required pattern="[0-9]{3,10}" title="Entre 3 y 10 dígitos" placeholder="Código, por ejemplo 001" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} className={field}/><input required placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={field}/><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={field}><option>Obra</option><option>Administración</option><option>Otro</option></select><button disabled={!allowed || busy} className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-50">Crear centro de gestión</button><div className="divide-y">{centers.map(c => <p key={c.id} className="py-2 text-xs">{c.codigo} · {c.nombre} · {c.tipo}{!c.activo && ' · Inactivo'}</p>)}</div></form><section className="space-y-3 rounded-2xl border bg-white p-5"><h4 className="font-bold">Asignación por obra</h4>{works.map(work => <label key={work.id} className="block rounded-xl bg-slate-50 p-3"><span className="mb-2 block text-xs font-bold">{work.nombre}</span><select disabled={!allowed || busy} value={work.centro_gestion_id || ''} onChange={e => assign(work, e.target.value)} className={field}><option value="">Pendiente de asignar</option>{centers.filter(c => c.activo && c.tipo === 'Obra' && (!works.some(w => w.id !== work.id && String(w.centro_gestion_id) === String(c.id)) || String(work.centro_gestion_id) === String(c.id))).map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label>)}{!works.length && <p className="text-sm text-slate-500">Crea una obra para asignarle su centro.</p>}</section></div></div>;
}
