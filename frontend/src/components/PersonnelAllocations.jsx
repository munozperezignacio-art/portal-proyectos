import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import useUserPermissions from '../utils/useUserPermissions';
import { can } from '../utils/permissionsCatalog';
import { laborCostPreview } from '../utils/laborCostPreview';
import {allocationApprovalDecisions,selectableAllocationRows} from '../utils/allocationApproval';
import AllocationBulkApproval from './AllocationBulkApproval';

const monthNow = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
export default function PersonnelAllocations({ user, personal, obras, centrosGestion }) {
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const canApprove = can(user, permissions, 'rrhh.imputaciones.aprobar');
  const canEdit = can(user, permissions, 'rrhh.imputaciones.editar');
  const [period, setPeriod] = useState(monthNow);
  const [rows, setRows] = useState([]);
  const [payroll, setPayroll] = useState(null);
  const [costs, setCosts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [edits, setEdits] = useState({});
  const [selected, setSelected] = useState([]);
  const [bulkReason,setBulkReason] = useState('');
  const [approvalMessage,setApprovalMessage] = useState('');
  const approvalInFlight=useRef(false);
  const [filter, setFilter] = useState('Pendiente');
  const [workerFilter, setWorkerFilter] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
  const [costParameters, setCostParameters] = useState({ horas_semanales: '42', tope_gratificacion_mensual: '', cargas_empleador_pct: '', factor_hora_extra: '1.5' });
  const workerMap = useMemo(() => new Map(personal.map(p => [p.id, p])), [personal]);
  const centerMap = useMemo(() => new Map(centrosGestion.map(c => [c.id, c])), [centrosGestion]);
  const centerLabel = id => { const c = centerMap.get(Number(id)); return c ? `${c.codigo} · ${c.nombre}` : 'Sin centro'; };
  const preview = row => laborCostPreview(row.costo_detalle,edits[row.id],workerMap.get(row.trabajador_id),costParameters);
  const load = useCallback(async () => {
    if (permissionsLoading) return;
    setBusy(true); setMessage(''); setEdits({}); setSelected([]);
    try {
      if (canEdit || canApprove) {
        const result = await supabase.rpc('preparar_imputaciones_personal', { p_empresa: user.empresa, p_periodo: period });
        if (result.error) throw result.error;
      }
      const end = new Date(`${period}-01T12:00:00`); end.setMonth(end.getMonth() + 1);
      const all = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from('rrhh_imputaciones_diarias').select('*').eq('empresa', user.empresa)
          .gte('fecha', `${period}-01`).lt('fecha', end.toISOString().slice(0, 10)).order('fecha').order('id').range(offset, offset + 999);
        if (result.error) throw result.error;
        all.push(...result.data);
        if (result.data.length < 1000) break;
      }
      const run = await supabase.from('rrhh_nominas_mensuales').select('id,estado').eq('empresa', user.empresa).eq('periodo', period).maybeSingle();
      const config = await supabase.from('rrhh_costeo_parametros').select('*').eq('empresa', user.empresa).eq('periodo', period).maybeSingle();
      if (config.error) throw config.error;
      setCostParameters(config.data || { horas_semanales: '42', tope_gratificacion_mensual: '', cargas_empleador_pct: '', factor_hora_extra: '1.5' });
      if (run.error) throw run.error;
      const ledger = run.data ? await supabase.from('rrhh_costos_centros_aprobados').select('*').eq('empresa', user.empresa).eq('nomina_id', run.data.id) : { data: [] };
      if (ledger.error) throw ledger.error;
      setRows(all); setPayroll(run.data); setCosts(ledger.data || []);
    } catch (error) { setRows([]); setPayroll(null); setCosts([]); setMessage(error.message); }
    finally { setBusy(false); }
  }, [period, user.empresa, permissionsLoading, canEdit, canApprove]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected([]); setBulkReason(''); }, [period, filter, workerFilter, centerFilter, dateFilter]);
  const filtered = rows.filter(r => (!workerFilter || String(r.trabajador_id) === workerFilter)
    && (!dateFilter || r.fecha === dateFilter)
    && (!centerFilter || String(r.centro_aprobado_id || r.centro_propuesto_id || '') === centerFilter)
    && (filter === 'Todas' || (filter === 'Sin asistencia' ? r.origen === filter : filter === 'Sin centro' ? !r.centro_propuesto_id && r.estado !== 'Aprobada' : r.estado === filter)));
  const pending = rows.filter(r => r.estado !== 'Aprobada').length;
  const selectable = selectableAllocationRows(filtered,today);
  const change = (id, key, value) => setEdits(current => ({ ...current, [id]: { ...current[id], [key]: value } }));
  const approve = async (ids,commonReason) => {
    if (!canApprove || !ids.length || busy || approvalInFlight.current) return;
    let decisions;
    try { decisions=allocationApprovalDecisions(rows,edits,ids,{today,commonReason}); }
    catch(error){setApprovalMessage(`No se aprobó ningún cargo. ${error.message}`);return;}
    approvalInFlight.current=true;
    setBusy(true); setMessage('');setApprovalMessage('Guardando aprobación…');
    try {
      const result = await supabase.rpc('aprobar_imputaciones_personal', { p_empresa: user.empresa, p_decisiones: decisions });
      if(result.error)throw result.error;
      await load();setBulkReason('');setApprovalMessage(`${result.data} cargos aprobados${commonReason!==undefined?' con el mismo motivo, registrado en cada historial':''}: ya forman parte del costo devengado. La nómina definitiva los sustituirá sin duplicarlos.`);
    }catch(error){setApprovalMessage(`No se pudo completar la aprobación. ${error.message || 'Revise su conexión y vuelva a intentarlo.'}`);}finally{approvalInFlight.current=false;setBusy(false);}
  };
  const saveParameters = async () => {
    const keys = ['horas_semanales','tope_gratificacion_mensual','cargas_empleador_pct','factor_hora_extra'];
    if (keys.some(k => costParameters[k] === '' || !Number.isFinite(Number(costParameters[k])))) return setMessage('Complete todos los parámetros. Una tasa 0 debe indicarse expresamente.');
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const result = await supabase.from('rrhh_costeo_parametros').upsert({ empresa: user.empresa, periodo: period, ...Object.fromEntries(keys.map(k => [k,Number(costParameters[k])])), origen:'Manual',reglas:{},heredado_de:null, actualizado_por: auth.user?.id, actualizado_en: new Date().toISOString() });
    if (result.error) { setMessage(result.error.message); setBusy(false); } else { await load(); setMessage('Parámetros guardados. Los cargos afectados requieren nueva revisión.'); }
  };
  const distribute = async () => {
    if (!payroll || busy || !window.confirm('¿Recalcular exclusivamente los costos automáticos de esta nómina con los días aprobados? No se modificarán liquidaciones manuales ni otras nóminas.')) return;
    setBusy(true); setMessage('');
    const result = await supabase.rpc('distribuir_nomina_a_obras', { p_nomina_id: payroll.id });
    if (result.error) { setMessage(result.error.message); setBusy(false); }
    else { await load(); setMessage(result.data.distribuida ? 'Costos distribuidos por centros aprobados. Las obras reciben su costo y su detalle por partidas.' : `No se modificaron los costos: hay ${result.data.pendientes} días pendientes de aprobación.`); }
  };
  const totals = costs.reduce((acc, c) => ({ ...acc, [c.centro_gestion_id]: (acc[c.centro_gestion_id] || 0) + Number(c.monto) }), {});
  const cls = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs';
  return <section className="space-y-4">
    <div className="rounded-2xl bg-slate-900 p-5 text-white"><h3 className="font-black">Asignaciones y distribución de costos</h3><p className="mt-2 text-xs">La asistencia propone la obra; sin asistencia se propone el centro predeterminado de la ficha. Todo cargo requiere aprobación.</p></div>
    <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-950">{pending} días pendientes · {rows.length - pending} aprobados. Base: lunes a viernes dentro del contrato y días adicionales con asistencia. No modifica sueldos ni convierte falta de marcación en ausencia. Si cambia la asistencia, revise y vuelva a distribuir: los costos anteriores no se alteran silenciosamente.</div>
    {message && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs"><b>{costParameters.origen==='Automático'?'Costeo automático listo':costParameters.heredado_de?`Configuración reutilizada de ${costParameters.heredado_de}`:'Configuración de costeo del período'}</b><p className="mt-1">Obraxis toma sueldo y asignaciones de la ficha, incorpora HE y haberes aprobados y prepara las referencias del mes sin que tengas que repetirlas.</p>{costParameters.origen==='Automático' && <><p className="mt-2">Jornada de referencia: {costParameters.horas_semanales} h/semana (se usa la contractual si está en la ficha) · HE: ×{costParameters.factor_hora_extra} · Tope provisional de gratificación: ${Number(costParameters.tope_gratificacion_mensual).toLocaleString('es-CL')}.</p><p className="mt-2 text-amber-950">{costParameters.reglas?.advertencia}</p></>}</div>
    <details className="rounded-xl border bg-white p-4"><summary className="text-sm font-bold">Configuración excepcional de costeo — {period}</summary><p className="my-2 text-xs">Opcional: solo para reemplazar las referencias automáticas por una configuración particular de la empresa. Se reutilizará en los meses siguientes. Guardar cambia a modo manual y aplica una tasa única a todos los contratos; los cargos afectados requieren nueva aprobación.</p><div className="grid gap-2 sm:grid-cols-4">{[['horas_semanales','Horas semanales contractuales'],['tope_gratificacion_mensual','Tope mensual de gratificación ($)'],['cargas_empleador_pct','Provisión cargas empleador (%)'],['factor_hora_extra','Factor hora extra (mín. 1,5)']].map(([key,label]) => <label className="text-xs" key={key}>{label}<input disabled={!canApprove || busy} type="number" step="0.01" value={costParameters[key]} onChange={e => setCostParameters(p => ({ ...p,[key]:e.target.value }))} className="mt-1 w-full rounded border p-2"/></label>)}</div>{canApprove && <button disabled={busy} onClick={saveParameters} className="mt-3 rounded bg-slate-900 px-3 py-2 text-xs text-white">Guardar configuración excepcional</button>}</details>
    <div className="flex flex-wrap gap-2">
      <input aria-label="Período" type="month" value={period} onChange={e => setPeriod(e.target.value)} disabled={busy} className={cls}/>
      <select aria-label="Estado" value={filter} onChange={e => setFilter(e.target.value)} className={cls}>{['Pendiente','Sin asistencia','Sin centro','Aprobada','Todas'].map(v => <option key={v}>{v}</option>)}</select>
      <select aria-label="Trabajador" value={workerFilter} onChange={e => setWorkerFilter(e.target.value)} className={cls}><option value="">Todos los trabajadores</option>{personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      <select aria-label="Centro u obra" value={centerFilter} onChange={e => setCenterFilter(e.target.value)} className={cls}><option value="">Todos los centros / obras</option>{centrosGestion.map(c => <option key={c.id} value={c.id}>{centerLabel(c.id)}{obras.some(o => o.centro_gestion_id === c.id) ? ' (Obra)' : ''}</option>)}</select>
      <input aria-label="Día" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={cls}/>
      <button disabled={busy} onClick={load} className={cls}>{busy ? 'Procesando…' : 'Actualizar propuestas'}</button>
    </div>
    {canApprove && <><AllocationBulkApproval count={selected.length} reason={bulkReason} onReasonChange={setBulkReason} onApprove={()=>approve(selected,bulkReason)} busy={busy} message={approvalMessage} selectionKey={JSON.stringify([period,selected,edits])}/><p className="text-xs text-slate-500">Seleccionar todos incluye solo pendientes hasta hoy ({today}). Las fechas futuras no se pueden aprobar.</p><button disabled={busy || !payroll || !['Cerrada','Pagada'].includes(payroll.estado)} onClick={distribute} className={`${cls} disabled:opacity-40`}>Distribuir costos de nómina {period}</button></>}
    {!payroll && <p className="text-xs text-slate-500">Los cargos aprobados ya alimentan el costo real como provisión. Al conciliar la nómina definitiva, se reemplazan sin duplicarlos.</p>}
    <div className="max-h-[650px] overflow-auto rounded-xl border"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3"><input aria-label="Seleccionar pendientes filtrados" type="checkbox" disabled={busy || !canApprove || !selectable.length} checked={selectable.length>0 && selectable.slice(0,1000).every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? selectable.slice(0,1000).map(r => r.id) : [])}/></th>{['Fecha / trabajador','Evidencia','Destino del cargo','Motivo / aprobación'].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{filtered.map(r => <tr key={r.id} className="border-t align-top">
      <td className="p-3"><input aria-label={`Seleccionar día ${r.fecha}`} type="checkbox" disabled={busy || !canApprove || r.fecha>today} checked={selected.includes(r.id)} onChange={e => setSelected(s => e.target.checked ? [...s,r.id] : s.filter(id => id !== r.id))}/>{r.fecha>today && <small className="block">Fecha futura</small>}</td>
      <td className="p-3">{r.fecha}<b className="block">{workerMap.get(r.trabajador_id)?.nombre || `Trabajador ${r.trabajador_id}`}</b><span>{r.estado}</span></td>
      <td className="p-3">{r.origen}<small className="block">Propuesta: {centerLabel(r.centro_propuesto_id)}</small><small className="block">H. extra detectadas: {r.costo_evidencia?.horas_detectadas ?? 'Por calcular'}</small>{Array.isArray(r.evidencia?.marcas) && r.evidencia.marcas.map(m => <small className="block" key={m[0]}>{obras.find(o => o.id === m[1])?.nombre || 'Sin obra'} · {m[2]}</small>)}</td>
      <td className="p-3"><select aria-label={`Destino ${r.fecha}`} disabled={busy || !canApprove} value={edits[r.id]?.center ?? r.centro_aprobado_id ?? r.centro_propuesto_id ?? ''} onChange={e => change(r.id,'center',e.target.value)} className={`${cls} w-full`}><option value="">Seleccione un centro</option>{centrosGestion.filter(c => c.activo !== false).map(c => <option key={c.id} value={c.id}>{centerLabel(c.id)}</option>)}</select>
        <div className="mt-2 space-y-1">{[['hours','Horas extras a aprobar',r.costo_detalle?.horas_extra],['taxable','Haber adicional imponible ($)',r.haber_imponible],['nonTaxable','Haber adicional no imponible ($)',r.haber_no_imponible]].map(([key,label,value]) => <label className="block text-[10px]" key={key}>{label}<input type="number" min="0" step="0.01" disabled={busy || !canApprove} value={edits[r.id]?.[key] ?? value ?? 0} onChange={e => change(r.id,key,e.target.value)} className="ml-1 w-24 rounded border p-1"/></label>)}</div>
        <details className="mt-2 text-[10px]"><summary>{r.costo_detalle?.listo ? `Costo propuesto: $${Number(preview(r).total).toLocaleString('es-CL')}` : 'Falta configuración de costo'}</summary>{Object.entries(preview(r)).filter(([k,v]) => typeof v === 'number' && k !== 'horas_extra').map(([k,v]) => <p key={k}>{k}: ${v.toLocaleString('es-CL')}</p>)}<p>Vista previa. El servidor recalcula y registra el desglose al aprobar.</p></details>
      </td>
      <td className="p-3"><input aria-label="Motivo de reasignación" placeholder="Motivo obligatorio si cambia destino" disabled={busy || !canApprove} value={edits[r.id]?.comment ?? ''} onChange={e => change(r.id,'comment',e.target.value)} className={`${cls} w-full`}/>{canApprove && <button disabled={busy} onClick={() => approve([r.id])} className="mt-2 rounded bg-emerald-800 px-3 py-2 font-bold text-white">{r.estado === 'Aprobada' ? 'Reasignar y aprobar' : 'Aprobar'}</button>}<details className="mt-2"><summary>Historial ({r.historial.length})</summary>{r.historial.map((h,i) => <p className="mt-1 text-[10px]" key={i}>{new Date(h.fecha).toLocaleString('es-CL')} · {h.accion} · {centerLabel(h.centro || h.centro_anterior)} · {h.comentario || ''} · Usuario: {h.actor}</p>)}</details></td>
    </tr>)}</tbody></table>{!filtered.length && <p className="p-5 text-sm">No hay registros con estos filtros.</p>}</div>
    {!!costs.length && <div className="rounded-xl border bg-white p-4"><h4 className="text-sm font-bold">Última distribución de costos del período</h4><p className="my-2 text-xs text-slate-500">Se conserva hasta volver a distribuir la nómina, aunque existan días por revisar.</p>{Object.entries(totals).map(([id,total]) => <p key={id} className="text-sm">{centerLabel(id)}: ${total.toLocaleString('es-CL')}</p>)}</div>}
  </section>;
}
