import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { parseNumberFromDots } from '../utils/rutUtils';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary';
const money = value => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(value || 0));
const emptyItem = { codigo: '', partida: '', unidad: 'UN', cantidad_contratada: '', precio_unitario: '', moneda: 'CLP', fecha_inicio: '', fecha_termino: '' };
const defaultFields = [{ key: 'detalle', label: 'Detalle', type: 'textarea', required: true }];

export default function MandanteControlContractual({ company, contracts = [], onMessage, onError }) {
  const [contractId, setContractId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(emptyItem);
  const [loading, setLoading] = useState(false);
  const contract = useMemo(() => contracts.find(row => row.id === contractId), [contracts, contractId]);

  useEffect(() => { if (!contractId && contracts.length) setContractId(contracts[0].id); }, [contracts, contractId]);
  useEffect(() => {
    if (!contractId) return;
    (async () => {
      setLoading(true);
      const [templateResult, itemResult] = await Promise.all([
        supabase.from('mandante_plantillas_entrega').select('*').eq('contrato_id', contractId).order('orden'),
        supabase.from('mandante_control_partidas').select('*').eq('contrato_id', contractId).eq('activa', true).order('orden'),
      ]);
      setLoading(false);
      if (templateResult.error || itemResult.error) return onError?.(templateResult.error?.message || itemResult.error?.message);
      setTemplates(templateResult.data || []); setItems(itemResult.data || []);
    })();
  }, [contractId, onError]);

  const refresh = async () => {
    const [a, b] = await Promise.all([
      supabase.from('mandante_plantillas_entrega').select('*').eq('contrato_id', contractId).order('orden'),
      supabase.from('mandante_control_partidas').select('*').eq('contrato_id', contractId).eq('activa', true).order('orden'),
    ]);
    if (a.error || b.error) return onError?.(a.error?.message || b.error?.message);
    setTemplates(a.data || []); setItems(b.data || []);
  };
  const saveTemplate = async template => {
    const { error } = await supabase.from('mandante_plantillas_entrega').update({
      nombre: template.nombre.trim(), instrucciones: template.instrucciones?.trim() || null,
      documento_obligatorio: Boolean(template.documento_obligatorio), max_archivos: Number(template.max_archivos || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', template.id);
    if (error) return onError?.(error.message); onMessage?.(`Plantilla de ${template.apartado} actualizada.`); await refresh();
  };
  const addTemplate = async () => {
    if (!contract) return;
    const { error } = await supabase.from('mandante_plantillas_entrega').insert({ contrato_id: contract.id, empresa_mandante: company, apartado: 'Documento', nombre: 'Nuevo requisito documental', instrucciones: 'Indica los antecedentes requeridos.', campos: defaultFields, documento_obligatorio: true, orden: templates.length + 1 });
    if (error) return onError?.(error.message); onMessage?.('Plantilla creada.'); await refresh();
  };
  const addItem = async event => {
    event.preventDefault(); if (!contract || !item.partida.trim()) return;
    const { error } = await supabase.from('mandante_control_partidas').insert({ ...item, contrato_id: contract.id, empresa_mandante: company, cantidad_contratada: Number(item.cantidad_contratada || 0), precio_unitario: parseNumberFromDots(item.precio_unitario), fecha_inicio: item.fecha_inicio || null, fecha_termino: item.fecha_termino || null, orden: items.length + 1 });
    if (error) return onError?.(error.message); setItem(emptyItem); onMessage?.('Partida contractual agregada.'); await refresh();
  };
  const removeItem = async row => {
    if (!window.confirm(`¿Quitar la partida “${row.partida}” del control contractual?`)) return;
    const { error } = await supabase.from('mandante_control_partidas').update({ activa: false, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) return onError?.(error.message); await refresh();
  };

  return <section className="space-y-5">
    <div className="rounded-3xl border bg-white p-5">
      <div className="flex items-center gap-3"><span className="rounded-2xl bg-slate-950 p-3 text-white"><ClipboardList className="h-5 w-5" /></span><div><h3 className="font-black">Control contractual por contrato</h3><p className="text-xs text-slate-500">Configura la línea base de presupuesto, planificación y una plantilla específica para cada entrega.</p></div></div>
      <label className="mt-4 block text-xs font-black text-slate-600">Contrato<select className={input} value={contractId} onChange={event => setContractId(event.target.value)}>{contracts.filter(row => row.empresa_mandante === company).map(row => <option key={row.id} value={row.id}>{row.codigo} · {row.empresa_contratista}</option>)}</select></label>
    </div>
    {contract && <><div className="rounded-3xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Plantillas y documentación requerida</h3><p className="text-xs text-slate-500">Cada apartado solicita únicamente sus datos y respaldos correspondientes.</p></div><button onClick={addTemplate} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" />Agregar requisito</button></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{templates.map((row, index) => <article key={row.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex justify-between gap-3"><span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase text-primary">{row.apartado}</span><label className="text-[10px] font-black"><input type="checkbox" checked={row.documento_obligatorio} onChange={event => setTemplates(list => list.map((value, i) => i === index ? { ...value, documento_obligatorio: event.target.checked } : value))} /> Documento obligatorio</label></div><input className={input} value={row.nombre} onChange={event => setTemplates(list => list.map((value, i) => i === index ? { ...value, nombre: event.target.value } : value))} /><textarea rows={2} className={input} value={row.instrucciones || ''} onChange={event => setTemplates(list => list.map((value, i) => i === index ? { ...value, instrucciones: event.target.value } : value))} /><div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-slate-500">{row.campos?.length || 0} campos · máx. {row.max_archivos} archivos</span><button onClick={() => saveTemplate(row)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[10px] font-black text-white"><Save className="h-3.5 w-3.5" />Guardar</button></div></article>)}{!templates.length && !loading && <p className="text-sm text-slate-500">No hay plantillas configuradas.</p>}</div></div>
    <div className="rounded-3xl border bg-white p-5"><h3 className="font-black">Presupuesto y planificación de control</h3><p className="text-xs text-slate-500">Estas partidas forman la línea base independiente con la que el mandante valida cantidades y fechas informadas.</p><form onSubmit={addItem} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input className={input} placeholder="Código" value={item.codigo} onChange={event => setItem({ ...item, codigo: event.target.value })} /><input required className={`${input} xl:col-span-2`} placeholder="Partida / actividad" value={item.partida} onChange={event => setItem({ ...item, partida: event.target.value })} /><input className={input} placeholder="Unidad" value={item.unidad} onChange={event => setItem({ ...item, unidad: event.target.value })} /><input type="number" min="0" step="any" className={input} placeholder="Cantidad contratada" value={item.cantidad_contratada} onChange={event => setItem({ ...item, cantidad_contratada: event.target.value })} /><input type="number" min="0" step="any" className={input} placeholder="Precio unitario" value={item.precio_unitario} onChange={event => setItem({ ...item, precio_unitario: event.target.value })} /><select className={input} value={item.moneda} onChange={event => setItem({ ...item, moneda: event.target.value })}><option>CLP</option><option>UF</option><option>USD</option></select><div className="grid grid-cols-2 gap-2"><input type="date" className={input} value={item.fecha_inicio} onChange={event => setItem({ ...item, fecha_inicio: event.target.value })} /><input type="date" className={input} value={item.fecha_termino} onChange={event => setItem({ ...item, fecha_termino: event.target.value })} /></div><button className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-black text-white md:col-span-2 xl:col-span-4"><Plus className="h-4 w-4" />Agregar partida</button></form><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3">Partida</th><th>Cantidad</th><th>P.U.</th><th>Total</th><th>Planificación</th><th /></tr></thead><tbody>{items.map(row => <tr key={row.id} className="border-b"><td className="p-3 font-black">{row.codigo && `${row.codigo} · `}{row.partida}</td><td>{money(row.cantidad_contratada)} {row.unidad}</td><td>{money(row.precio_unitario)} {row.moneda}</td><td className="font-black">{money(Number(row.cantidad_contratada) * Number(row.precio_unitario))} {row.moneda}</td><td>{row.fecha_inicio || '—'} → {row.fecha_termino || '—'}</td><td><button onClick={() => removeItem(row)} className="rounded-lg p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></div></>}
  </section>;
}
