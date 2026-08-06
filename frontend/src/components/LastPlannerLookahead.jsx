import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().substring(0, 10);
};

export default function LastPlannerLookahead({ obra, partidas, fechaCorte, getStartDate }) {
  const [apuResources, setApuResources] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [manualPartida, setManualPartida] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState('Material');
  const [message, setMessage] = useState('');

  const lookaheadPartidas = useMemo(() => {
    const horizon = addDays(fechaCorte, 42);
    return (partidas || []).filter(p => !(p.unidad === 'TITULO' || p.unidad === 'GRUPO' || p.es_titulo)).map(p => ({ ...p, startDate: getStartDate(p) }))
      .filter(p => p.startDate && p.startDate >= fechaCorte && p.startDate <= horizon)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [partidas, fechaCorte, getStartDate]);

  const loadLookahead = async () => {
    if (!obra?.nombre) return;
    setLoading(true); setMessage('');
    try {
      const { data: savedChecks, error: checksError } = await supabase.from('last_planner_recursos').select('*').eq('obra_nombre', obra.nombre);
      if (checksError) {
        setSchemaReady(false); setChecks([]); setApuResources([]);
        return;
      }
      setSchemaReady(true); setChecks(savedChecks || []);

      const { data: relation } = await supabase.from('obra_presupuestos').select('presupuesto_id').eq('obra_nombre', obra.nombre).maybeSingle();
      let budgetId = relation?.presupuesto_id;
      if (!budgetId) {
        const { data: matchingBudget } = await supabase.from('presupuestos_proyectos').select('id').eq('nombre', obra.nombre).maybeSingle();
        budgetId = matchingBudget?.id;
      }
      if (!budgetId) { setApuResources([]); return; }

      const { data: items } = await supabase.from('presupuestos_items').select('id, partida, descripcion').eq('presupuesto_id', budgetId);
      const itemIds = (items || []).map(item => item.id);
      if (!itemIds.length) { setApuResources([]); return; }
      const { data: links } = await supabase.from('presupuestos_items_recursos').select('*').in('item_id', itemIds);
      const { data: resources } = await supabase.from('recursos_presupuesto').select('*').eq('presupuesto_id', budgetId);
      const itemMap = new Map((items || []).map(item => [String(item.id), item]));
      const resourceMap = new Map((resources || []).map(resource => [String(resource.id), resource]));
      setApuResources((links || []).map(link => {
        const item = itemMap.get(String(link.item_id));
        const resource = resourceMap.get(String(link.recurso_id));
        return item && resource ? { partida: item.partida || item.descripcion, clave: `apu-${link.recurso_id}`, recurso: resource.recurso || resource.nombre || 'Recurso APU', tipo: resource.tipo || 'Recurso', unidad: resource.unidad || '', cantidad: link.cantidad || link.rendimiento || 0, origen: 'APU' } : null;
      }).filter(Boolean));
    } catch (error) { setMessage(`No se pudieron cargar recursos: ${error.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLookahead(); }, [obra?.nombre]);

  const saveCheck = async (resource, checked) => {
    const payload = { empresa: obra?.empresa || null, obra_nombre: obra.nombre, partida: resource.partida, recurso_clave: resource.clave, recurso: resource.recurso, tipo: resource.tipo, unidad: resource.unidad || '', cantidad_requerida: resource.cantidad || 0, origen: resource.origen || 'Manual', estado: checked ? 'confirmado' : 'pendiente' };
    const { data, error } = await supabase.from('last_planner_recursos').upsert(payload, { onConflict: 'obra_nombre,partida,recurso_clave' }).select().single();
    if (error) { setMessage(`No se pudo guardar el chequeo: ${error.message}`); return; }
    setChecks(previous => [...previous.filter(item => !(item.partida === data.partida && item.recurso_clave === data.recurso_clave)), data]);
  };

  const addManual = async () => {
    if (!manualPartida || !manualName.trim()) return;
    await saveCheck({ partida: manualPartida, clave: `manual-${Date.now()}`, recurso: manualName.trim(), tipo: manualType, unidad: '', cantidad: 0, origen: 'Manual' }, false);
    setManualName(''); setMessage('Recurso o paso previo agregado.');
  };

  const resourcesFor = (partida) => {
    const base = apuResources.filter(resource => normalize(resource.partida) === normalize(partida));
    const manual = checks.filter(check => check.origen === 'Manual' && normalize(check.partida) === normalize(partida)).map(check => ({ ...check, clave: check.recurso_clave, recurso: check.recurso, cantidad: check.cantidad_requerida, origen: 'Manual' }));
    return [...base, ...manual];
  };
  const isChecked = (resource) => checks.some(check => normalize(check.partida) === normalize(resource.partida) && check.recurso_clave === resource.clave && check.estado === 'confirmado');

  return <div className="space-y-5">
    <div className="bg-indigo-950 text-white p-5 rounded-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.16em] uppercase text-indigo-200">Last Planner System</p><h4 className="text-base font-black mt-1">Ventana Lookahead y liberación de restricciones</h4><p className="text-xs text-indigo-100 mt-1">Próximas 6 semanas: revisa recursos APU y confirma que cada frente está listo antes de iniciar.</p></div><button onClick={loadLookahead} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
    {!schemaReady ? <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl text-xs text-amber-950"><b>Falta habilitar Last Planner en Supabase.</b> Ejecuta el archivo <code>schema_last_planner.sql</code> del proyecto y luego presiona actualizar.</div> : <>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><h5 className="text-xs font-black text-slate-800 uppercase">Agregar recurso o paso previo manual</h5><div className="grid grid-cols-1 md:grid-cols-4 gap-2"><select value={manualPartida} onChange={e => setManualPartida(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"><option value="">Selecciona partida</option>{lookaheadPartidas.map(p => <option key={p.id || p.partida} value={p.partida}>{p.partida}</option>)}</select><input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Ej.: Permiso municipal, grúa, capataz" className="border rounded-lg px-2 py-2 text-xs md:col-span-2"/><select value={manualType} onChange={e => setManualType(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"><option>Material</option><option>Mano de Obra</option><option>Maquinaria</option><option>Permiso / Restricción</option><option>Información / Plano</option></select></div><button onClick={addManual} className="bg-indigo-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>Agregar a checklist</button>{message && <p className="text-[11px] text-slate-600">{message}</p>}</div>
      {lookaheadPartidas.length === 0 ? <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500">No hay partidas programadas en la ventana de 6 semanas.</div> : <div className="space-y-3">{lookaheadPartidas.map((partida, index) => { const resources = resourcesFor(partida.partida); const confirmed = resources.filter(isChecked).length; return <div key={partida.id || partida.partida} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"><div className="flex flex-col sm:flex-row sm:justify-between gap-2 border-b pb-2"><div><span className="text-[9px] font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">SEMANA LOOKAHEAD {index + 1}</span><h5 className="font-black text-sm text-slate-800 mt-1">{partida.partida}</h5><p className="text-[10px] text-slate-500">Inicio programado: <b>{partida.startDate}</b></p></div><span className={`text-xs font-black px-3 py-1 rounded-xl h-fit ${resources.length > 0 && confirmed === resources.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{resources.length > 0 && confirmed === resources.length ? '✓ Lista para ejecutar' : `${confirmed}/${resources.length} requisitos liberados`}</span></div>{resources.length === 0 ? <p className="text-xs italic text-slate-500 bg-slate-50 rounded-xl p-3">Sin recursos APU vinculados. Agrega manualmente materiales, cuadrilla, equipos o restricciones.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{resources.map((resource, resourceIndex) => <label key={`${resource.clave}-${resourceIndex}`} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={isChecked(resource)} onChange={e => saveCheck(resource, e.target.checked)} className="accent-emerald-600"/><div className="min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{resource.recurso}</p><p className="text-[10px] text-slate-500">{resource.tipo} {resource.cantidad ? `· ${resource.cantidad} ${resource.unidad || ''}` : ''} · {resource.origen}</p></div></label>)}</div>}</div>; })}</div>}
    </>}
  </div>;
}
