import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, Download, PackageMinus, ShieldAlert, TrendingUp, UserCheck, Users, Warehouse } from 'lucide-react';
import { supabase } from '../supabaseClient';

const number = value => Number(value || 0);
const money = value => `$${Math.round(number(value)).toLocaleString('es-CL')}`;
const normalize = value => String(value || '').toLowerCase();
const dateOf = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const monthKey = value => { const date = dateOf(value); return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : ''; };
const monthLabel = key => { const [year, month] = key.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }); };
const recentMonths = (count = 6) => Array.from({ length: count }, (_, index) => { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (count - 1 - index)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; });
const withinDays = (value, days) => { const date = dateOf(value); return date && date >= new Date(Date.now() - days * 86400000); };
const grouped = (items, keyFn, valueFn = () => 1) => [...items.reduce((map, item) => { const key = keyFn(item) || 'Sin información'; map.set(key, (map.get(key) || 0) + valueFn(item)); return map; }, new Map())].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
const flattenValues = value => value && typeof value === 'object' ? Object.values(value).flatMap(flattenValues) : [value];

export function PreventionStatistics({ respuestas = [], formularios = [], cumplimiento = [], asignaciones = [], obras = [] }) {
  const [period, setPeriod] = useState('90');
  const [work, setWork] = useState('');
  const filtered = useMemo(() => respuestas.filter(record => {
    const inPeriod = period === 'all' || withinDays(record.created_at || record.fecha, Number(period));
    const recordWork = record.proyecto_nombre || record.obra_nombre || record.respuestas?.proyecto_nombre || '';
    return inPeriod && (!work || recordWork === work);
  }), [respuestas, period, work]);
  const metrics = useMemo(() => {
    const incident = filtered.filter(record => {
      const text = normalize(`${record.prevencion_formularios?.titulo} ${record.prevencion_formularios?.categoria} ${record.respuestas?.tipo}`);
      return text.includes('incidente') || text.includes('accidente');
    });
    const findings = filtered.reduce((total, record) => total + flattenValues(record.respuestas || {}).filter(value => ['no cumple','rechazado','rechazada','deficiente'].includes(normalize(value))).length, 0);
    const compliant = cumplimiento.filter(row => normalize(row.estado || row.resultado) === 'cumple').length;
    const complianceRate = cumplimiento.length ? compliant / cumplimiento.length * 100 : 0;
    return { incident: incident.length, findings, complianceRate, pending: Math.max(0, asignaciones.length - cumplimiento.filter(row => withinDays(row.fecha_cumplimiento || row.created_at, 30)).length) };
  }, [filtered, cumplimiento, asignaciones]);
  const months = recentMonths();
  const trend = months.map(key => ({ label: monthLabel(key), value: filtered.filter(row => monthKey(row.created_at || row.fecha) === key).length }));
  const byWork = grouped(filtered, row => row.proyecto_nombre || row.obra_nombre || row.respuestas?.proyecto_nombre || 'Corporativo').slice(0, 7);
  const byForm = grouped(filtered, row => row.prevencion_formularios?.titulo || formularios.find(form => form.id === row.formulario_id)?.titulo || 'Registro preventivo').slice(0, 7);
  return <AnalyticsShell title="Estadísticas de Prevención" subtitle="Indicadores preventivos consolidados desde inspecciones, incidentes y controles de cumplimiento." filters={<><select value={period} onChange={e => setPeriod(e.target.value)} className="stat-filter"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="all">Todo el historial</option></select><select value={work} onChange={e => setWork(e.target.value)} className="stat-filter"><option value="">Todas las obras</option>{obras.map(item => <option key={item.nombre || item} value={item.nombre || item}>{item.nombre || item}</option>)}</select></>}>
    <KpiGrid items={[[ClipboardCheck,'Registros analizados',filtered.length,'blue'],[ShieldAlert,'Incidentes / accidentes',metrics.incident,metrics.incident ? 'rose' : 'green'],[AlertTriangle,'Hallazgos críticos',metrics.findings,metrics.findings ? 'amber' : 'green'],[CheckCircle2,'Cumplimiento',`${metrics.complianceRate.toFixed(1)}%`,metrics.complianceRate >= 90 ? 'green' : 'amber'],[CalendarClock,'Controles pendientes',metrics.pending,metrics.pending ? 'amber' : 'green']]}/>
    <div className="grid gap-4 xl:grid-cols-3"><TrendCard title="Actividad preventiva mensual" data={trend}/><RankCard title="Registros por obra" data={byWork}/><RankCard title="Formularios más utilizados" data={byForm}/></div>
  </AnalyticsShell>;
}

export function WarehouseStatistics({ stockRows = [], movimientos = [], bodegas = [], productos = [], guias = [] }) {
  const [period, setPeriod] = useState('90');
  const [warehouseId, setWarehouseId] = useState('');
  const filteredStock = stockRows.filter(row => !warehouseId || String(row.bodega_id) === warehouseId);
  const filteredMoves = movimientos.filter(row => (!warehouseId || String(row.bodega_id) === warehouseId) && (period === 'all' || withinDays(row.fecha || row.created_at, Number(period))));
  const positive = new Set(['entrada','ajuste +','transferencia entrada']);
  const negative = new Set(['salida','ajuste -','transferencia salida']);
  const stockValue = filteredStock.reduce((sum, row) => sum + Math.max(0, number(row.valor)), 0);
  const low = filteredStock.filter(row => number(row.stock) <= number(row.producto?.stock_minimo));
  const stockout = filteredStock.filter(row => number(row.stock) <= 0);
  const entries = filteredMoves.filter(row => positive.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0);
  const exits = filteredMoves.filter(row => negative.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0);
  const linkedGuides = filteredMoves.filter(row => row.dte_documento_id).length;
  const traceability = filteredMoves.length ? linkedGuides / filteredMoves.length * 100 : 0;
  const warehouseValue = grouped(filteredStock, row => row.bodega?.nombre || 'Bodega', row => Math.max(0, number(row.valor))).slice(0, 7);
  const consumption = grouped(filteredMoves.filter(row => negative.has(normalize(row.tipo))), row => productos.find(product => product.id === row.producto_id)?.nombre || 'Producto', row => number(row.cantidad)).slice(0, 7);
  const months = recentMonths();
  const trend = months.map(key => ({ label: monthLabel(key), value: filteredMoves.filter(row => monthKey(row.fecha || row.created_at) === key && negative.has(normalize(row.tipo))).reduce((sum, row) => sum + number(row.cantidad) * number(row.costo_unitario), 0) }));
  return <AnalyticsShell title="Estadísticas de Bodega" subtitle="Valor, rotación, consumo, disponibilidad y trazabilidad documental del inventario." filters={<><select value={period} onChange={e => setPeriod(e.target.value)} className="stat-filter"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="all">Todo el historial</option></select><select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="stat-filter"><option value="">Todas las bodegas</option>{bodegas.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre}</option>)}</select></>}>
    <KpiGrid items={[[CircleDollarSign,'Stock valorizado',money(stockValue),'blue'],[AlertTriangle,'Bajo mínimo',low.length,low.length ? 'amber' : 'green'],[PackageMinus,'Quiebres de stock',stockout.length,stockout.length ? 'rose' : 'green'],[TrendingUp,'Entradas valorizadas',money(entries),'green'],[Boxes,'Salidas valorizadas',money(exits),'blue'],[ClipboardCheck,'Movimientos con guía',`${traceability.toFixed(1)}%`,traceability >= 80 ? 'green' : 'amber']]}/>
    <div className="grid gap-4 xl:grid-cols-3"><TrendCard title="Consumo valorizado mensual" data={trend} formatter={money}/><RankCard title="Valor por bodega" data={warehouseValue} formatter={money}/><RankCard title="Productos con mayor salida" data={consumption}/></div>
    <div className="rounded-2xl border bg-white p-4 text-xs text-slate-600"><b>{guias.length}</b> guías de despacho disponibles · <b>{linkedGuides}</b> movimientos enlazados a DTE 52.</div>
  </AnalyticsShell>;
}

export function HrStatistics({ personal = [], obras = [], canDownload = false, companyName = 'Empresa' }) {
  const [work, setWork] = useState('');
  const [assignment, setAssignment] = useState('all');
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [workforceNeeds, setWorkforceNeeds] = useState([]);
  useEffect(() => {
    const loadOperationalData = async () => {
      const workNames = obras.map(item => item.nombre).filter(Boolean);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const attendanceQuery = supabase.from('asistencia_personal').select('obra_nombre,trabajador,rut,asistencia,horas_ordinarias,horas_extras_auto,horas_extras_manual,created_at').gte('created_at', since);
      const [attendanceResult, needsResult] = await Promise.all([
        workNames.length ? attendanceQuery.in('obra_nombre', workNames) : Promise.resolve({ data: [], error: null }),
        supabase.from('rrhh_proyecciones_dotacion').select('*').eq('empresa', companyName).in('estado', ['Planificada', 'Confirmada', 'En contratación']).lte('fecha_inicio', new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)).gte('fecha_termino', new Date().toISOString().slice(0, 10))
      ]);
      setAttendanceRows(attendanceResult.error ? [] : attendanceResult.data || []);
      setWorkforceNeeds(needsResult.error ? [] : needsResult.data || []);
    };
    loadOperationalData();
  }, [companyName, obras]);
  const filtered = personal.filter(worker => {
    const matchesWork = !work || (worker.obra_nombre || '') === work;
    const matchesAssignment = assignment === 'all' || (assignment === 'assigned' ? Boolean(worker.obra_nombre) : !worker.obra_nombre);
    return matchesWork && matchesAssignment;
  });
  const active = filtered.filter(worker => worker.activo !== false && !['finiquitado','inactivo'].includes(normalize(worker.estado)));
  const assigned = active.filter(worker => worker.obra_nombre);
  const unassignedWorkers = active.filter(worker => !worker.obra_nombre);
  const unassigned = unassignedWorkers.length;
  const allocationRate = active.length ? assigned.length / active.length * 100 : 0;
  const expiring = active.filter(worker => { const date = dateOf(worker.fecha_vencimiento_contrato); return date && date >= new Date() && date <= new Date(Date.now() + 30 * 86400000); });
  const expired = active.filter(worker => { const date = dateOf(worker.fecha_vencimiento_contrato); return date && date < new Date(); });
  const monthlyCost = active.reduce((sum, worker) => sum + number(worker.sueldo_base) + number(worker.colacion) + number(worker.movilizacion), 0);
  const unassignedMonthlyCost = unassignedWorkers.reduce((sum, worker) => sum + number(worker.sueldo_base) + number(worker.colacion) + number(worker.movilizacion), 0);
  const byWork = grouped(active, worker => worker.obra_nombre || 'Oficina / sin asignar').slice(0, 8);
  const byRole = grouped(active, worker => worker.cargo || 'Sin cargo').slice(0, 8);
  const byContract = grouped(active, worker => worker.tipo_contrato || 'Sin información').slice(0, 6);
  const health = grouped(active, worker => worker.prevision_salud || 'Sin información').slice(0, 6);
  const unassignedByRole = grouped(unassignedWorkers, worker => worker.cargo || 'Sin cargo').slice(0, 8);
  const unassignedByContract = grouped(unassignedWorkers, worker => worker.tipo_contrato || 'Sin información').slice(0, 6);
  const scopedAttendance = attendanceRows.filter(row => !work || row.obra_nombre === work);
  const absentStatuses = new Set(['ausente', 'inasistencia', 'no asistio', 'no asistió', 'licencia', 'permiso']);
  const absences = scopedAttendance.filter(row => absentStatuses.has(normalize(row.asistencia)));
  const attendanceRate = scopedAttendance.length ? (scopedAttendance.length - absences.length) / scopedAttendance.length * 100 : null;
  const overtimeHours = scopedAttendance.reduce((sum, row) => sum + number(row.horas_extras_auto) + number(row.horas_extras_manual), 0);
  const activeNeeds = workforceNeeds.filter(row => !work || row.obra_nombre === work).map(row => {
    const actual = personal.filter(worker => worker.activo !== false && !['finiquitado','inactivo'].includes(normalize(worker.estado)) && normalize(worker.obra_nombre) === normalize(row.obra_nombre) && normalize(worker.cargo) === normalize(row.cargo)).length;
    return { ...row, actual, gap: Math.max(0, number(row.cantidad_requerida) - actual) };
  }).filter(row => row.gap > 0);
  const reservedWorkers = new Set();
  const reassignmentSuggestions = activeNeeds.flatMap(need => unassignedWorkers
    .filter(worker => normalize(worker.cargo) === normalize(need.cargo) && !reservedWorkers.has(worker.id || worker.rut))
    .slice(0, need.gap)
    .map(worker => {
      reservedWorkers.add(worker.id || worker.rut);
      return { worker, need };
    }));
  const uncoveredGap = activeNeeds.reduce((sum, need) => sum + need.gap, 0) - reassignmentSuggestions.length;
  const downloadStatistics = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const workbook = XLSX.utils.book_new();
    const date = new Date().toISOString().slice(0, 10);
    const summary = [
      ['ESTADÍSTICAS DE RECURSOS HUMANOS'],
      ['Empresa', companyName], ['Fecha de emisión', date], ['Alcance', assignment === 'assigned' ? 'Solo asignados' : assignment === 'unassigned' ? 'Solo sin asignación' : 'Toda la dotación'], ['Obra', work || 'Toda la empresa'], [],
      ['Indicador', 'Valor'], ['Dotación activa', active.length], ['Asignados a obra', assigned.length], ['Sin asignación', unassigned], ['Tasa de asignación', allocationRate / 100], ['Tasa de asistencia (30 días)', attendanceRate === null ? 'Sin registros' : attendanceRate / 100], ['Horas extra (30 días)', overtimeHours], ['Brecha proyectada sin cubrir', Math.max(0, uncoveredGap)], ['Costo base mensual', monthlyCost], ['Costo mensual sin asignar', unassignedMonthlyCost], ['Contratos por vencer (30 días)', expiring.length], ['Contratos vencidos', expired.length]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summary);
    summarySheet['!cols'] = [{ wch: 34 }, { wch: 26 }];
    ['B11', 'B12'].forEach(cell => { if (summarySheet[cell]) summarySheet[cell].z = '0.0%'; });
    ['B15', 'B16'].forEach(cell => { if (summarySheet[cell]) summarySheet[cell].z = '$#,##0'; });
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    const detailRows = active.map(worker => ({
      RUT: worker.rut || '', Nombre: worker.nombre || '', Cargo: worker.cargo || '', Obra: worker.obra_nombre || 'Sin asignación', Estado: worker.estado || 'Activo',
      'Tipo de contrato': worker.tipo_contrato || '', 'Fecha de ingreso': worker.fecha_inicio_contrato || worker.inicio || '', 'Vencimiento contrato': worker.fecha_vencimiento_contrato || '',
      'Sueldo base': number(worker.sueldo_base), Colación: number(worker.colacion), Movilización: number(worker.movilizacion), 'Costo mensual': number(worker.sueldo_base) + number(worker.colacion) + number(worker.movilizacion),
      AFP: worker.afp || '', Salud: worker.prevision_salud || ''
    }));
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet['!cols'] = [14, 28, 28, 28, 14, 20, 16, 20, 16, 14, 14, 16, 18, 18].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Dotación filtrada');

    const compositionRows = [
      ...byWork.map(item => ({ Categoría: 'Dotación por obra', Grupo: item.label, Personas: item.value })),
      ...byRole.map(item => ({ Categoría: 'Dotación por cargo', Grupo: item.label, Personas: item.value })),
      ...byContract.map(item => ({ Categoría: 'Tipos de contrato', Grupo: item.label, Personas: item.value })),
      ...unassignedByRole.map(item => ({ Categoría: 'Sin asignación por cargo', Grupo: item.label, Personas: item.value }))
    ];
    const compositionSheet = XLSX.utils.json_to_sheet(compositionRows);
    compositionSheet['!cols'] = [{ wch: 30 }, { wch: 36 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, compositionSheet, 'Composición');
    const gapSheet = XLSX.utils.json_to_sheet(activeNeeds.map(row => ({ Obra: row.obra_nombre, Cargo: row.cargo, Requerido: number(row.cantidad_requerida), Asignado: row.actual, Brecha: row.gap, Inicio: row.fecha_inicio, Término: row.fecha_termino, Estado: row.estado })));
    gapSheet['!cols'] = [28, 28, 12, 12, 12, 14, 14, 18].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, gapSheet, 'Brechas próximas');
    const suggestionSheet = XLSX.utils.json_to_sheet(reassignmentSuggestions.map(({ worker, need }) => ({ Trabajador: worker.nombre, RUT: worker.rut || '', Cargo: worker.cargo, 'Obra sugerida': need.obra_nombre, 'Inicio necesidad': need.fecha_inicio, Confirmación: 'Pendiente' })));
    suggestionSheet['!cols'] = [28, 16, 28, 28, 18, 16].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, suggestionSheet, 'Reasignaciones sugeridas');
    XLSX.writeFile(workbook, `Estadisticas_RRHH_${String(companyName).replace(/[^a-z0-9]+/gi, '_')}_${date}.xlsx`);
  };
  return <AnalyticsShell title="Estadísticas de Recursos Humanos" subtitle="Dotación, disponibilidad, asignaciones, vencimientos contractuales y estructura del costo mensual." filters={<><select value={assignment} onChange={e => { setAssignment(e.target.value); if (e.target.value === 'unassigned') setWork(''); }} className="stat-filter"><option value="all">Toda la dotación</option><option value="assigned">Solo asignados</option><option value="unassigned">Solo sin asignación</option></select><select value={work} disabled={assignment === 'unassigned'} onChange={e => setWork(e.target.value)} className="stat-filter disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><option value="">Toda la empresa</option>{obras.map(item => <option key={item.nombre} value={item.nombre}>{item.nombre}</option>)}</select>{canDownload && <button type="button" onClick={downloadStatistics} className="stat-filter flex items-center justify-center gap-2 border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"><Download className="h-4 w-4"/>Descargar Excel</button>}</>}>
    <KpiGrid items={[[Users,'Dotación activa',active.length,'blue'],[UserCheck,'Asignados a obra',assigned.length,'green'],[TrendingUp,'Tasa de asignación',`${allocationRate.toFixed(1)}%`,allocationRate >= 90 ? 'green' : allocationRate >= 75 ? 'amber' : 'rose'],[Warehouse,'Sin asignación',unassigned,unassigned ? 'amber' : 'green'],[CheckCircle2,'Asistencia 30 días',attendanceRate === null ? 'Sin registros' : `${attendanceRate.toFixed(1)}%`,attendanceRate === null ? 'blue' : attendanceRate >= 95 ? 'green' : attendanceRate >= 90 ? 'amber' : 'rose'],[AlertTriangle,'Brecha proyectada',Math.max(0, uncoveredGap),uncoveredGap > 0 ? 'rose' : 'green']]}/>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Costo base mensual</p><p className="mt-1 text-xl font-black text-slate-900">{money(monthlyCost)}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Costo sin asignar</p><p className="mt-1 text-xl font-black text-amber-800">{money(unassignedMonthlyCost)}</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Horas extra · 30 días</p><p className="mt-1 text-xl font-black text-indigo-800">{overtimeHours.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h</p></div></div>
    <div className="grid gap-4 xl:grid-cols-2"><RankCard title="Dotación por obra" data={byWork}/><RankCard title="Dotación por cargo" data={byRole}/><DonutLikeCard title="Tipos de contrato" data={byContract}/><DonutLikeCard title="Sistema de salud" data={health}/></div>
    <div className="grid gap-4 xl:grid-cols-2"><RankCard title="Personal sin asignación por cargo" data={unassignedByRole}/><DonutLikeCard title="Contratos del personal sin asignación" data={unassignedByContract}/></div>
    <div className="grid gap-4 xl:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h4 className="text-xs font-black uppercase text-slate-800">Brechas de dotación próximas</h4><p className="mt-1 text-[11px] text-slate-500">Necesidades activas para los próximos 45 días, comparadas con la dotación asignada.</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${activeNeeds.length ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{activeNeeds.reduce((sum, row) => sum + row.gap, 0)} puestos</span></div><div className="mt-4 space-y-2">{activeNeeds.length ? activeNeeds.map(row => <div key={row.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><div><b className="text-xs text-slate-800">{row.cargo}</b><p className="mt-0.5 text-[10px] text-slate-500">{row.obra_nombre} · desde {dateOf(row.fecha_inicio)?.toLocaleDateString('es-CL') || row.fecha_inicio}</p></div><span className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-800">Faltan {row.gap}</span></div></div>) : <p className="rounded-xl bg-emerald-50 p-5 text-center text-xs font-bold text-emerald-800">Las necesidades proyectadas están cubiertas.</p>}</div></div><div className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h4 className="text-xs font-black uppercase text-slate-800">Sugerencias de reasignación</h4><p className="mt-1 text-[11px] text-slate-500">Coincidencias exactas entre cargos disponibles y brechas proyectadas. Requieren confirmación humana.</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black text-blue-800">{reassignmentSuggestions.length} coincidencias</span></div><div className="mt-4 space-y-2">{reassignmentSuggestions.length ? reassignmentSuggestions.map(({ worker, need }) => <div key={`${worker.id || worker.rut}-${need.id}`} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><p className="text-xs font-bold text-slate-800">{worker.nombre} → {need.obra_nombre}</p><p className="mt-1 text-[10px] text-slate-600">{worker.cargo} · cubre una necesidad desde {dateOf(need.fecha_inicio)?.toLocaleDateString('es-CL') || need.fecha_inicio}</p></div>) : <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">No existen coincidencias directas entre personal disponible y brechas vigentes.</p>}</div></div></div>
    <div className={`rounded-2xl border p-5 ${unassigned ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className={`text-xs font-black uppercase ${unassigned ? 'text-amber-900' : 'text-emerald-900'}`}>Personal disponible / sin obra asignada</h4><p className="mt-1 text-[11px] text-slate-600">Base para reasignación, planificación de dotación y control del costo de disponibilidad.</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${unassigned ? 'bg-amber-200 text-amber-950' : 'bg-emerald-200 text-emerald-950'}`}>{unassigned} personas · {money(unassignedMonthlyCost)}/mes</span></div>
      {unassignedWorkers.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white"><table className="w-full min-w-[720px] text-left text-[11px]"><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Trabajador</th><th className="px-3 py-2.5">Cargo</th><th className="px-3 py-2.5">Contrato</th><th className="px-3 py-2.5">Fecha ingreso</th><th className="px-3 py-2.5 text-right">Costo mensual</th></tr></thead><tbody>{unassignedWorkers.map(worker => { const startDate = worker.fecha_inicio_contrato || worker.inicio; return <tr key={worker.id || worker.rut} className="border-t border-slate-100"><td className="px-3 py-3"><b className="text-slate-800">{worker.nombre || 'Sin nombre'}</b><p className="font-mono text-[9px] text-slate-400">{worker.rut || 'RUT no informado'}</p></td><td className="px-3 py-3 text-slate-600">{worker.cargo || 'Sin cargo'}</td><td className="px-3 py-3 text-slate-600">{worker.tipo_contrato || 'Sin información'}</td><td className="px-3 py-3 font-mono text-slate-500">{startDate && dateOf(startDate) ? dateOf(startDate).toLocaleDateString('es-CL') : 'No informada'}</td><td className="px-3 py-3 text-right font-black text-amber-900">{money(number(worker.sueldo_base) + number(worker.colacion) + number(worker.movilizacion))}</td></tr>})}</tbody></table></div> : <p className="mt-4 rounded-xl bg-white p-5 text-center text-xs font-bold text-emerald-700">Toda la dotación activa está asignada.</p>}
    </div>
    {expiring.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="text-xs font-black uppercase text-amber-900">Vencimientos en los próximos 30 días</h4><div className="mt-2 grid gap-2 md:grid-cols-2">{expiring.map(worker => <div key={worker.id || worker.rut} className="rounded-xl bg-white p-3 text-xs"><b>{worker.nombre}</b><span className="float-right font-mono text-amber-800">{new Date(`${worker.fecha_vencimiento_contrato}T12:00:00`).toLocaleDateString('es-CL')}</span><p className="text-slate-500">{worker.cargo || 'Sin cargo'} · {worker.obra_nombre || 'Sin obra'}</p></div>)}</div></div>}
  </AnalyticsShell>;
}

function AnalyticsShell({ title, subtitle, filters, children }) { return <section className="space-y-4"><style>{`.stat-filter{min-width:180px;border:1px solid #cbd5e1;border-radius:12px;background:white;padding:9px 12px;font-size:12px;font-weight:700;color:#334155;outline:none}`}</style><div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-white p-5"><div><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><div className="flex flex-wrap gap-2">{filters}</div></div>{children}</section>; }
function KpiGrid({ items }) { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{items.map(([Icon,label,value,tone]) => <div key={label} className="rounded-2xl border bg-white p-4"><Icon className={`h-5 w-5 ${tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-blue-700'}`}/><p className="mt-3 text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>)}</div>; }
function RankCard({ title, data, formatter = value => number(value).toLocaleString('es-CL', { maximumFractionDigits: 1 }) }) { const max = Math.max(...data.map(item => number(item.value)), 1); return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-4 space-y-3">{data.map(item => <div key={item.label}><div className="mb-1 flex justify-between gap-3 text-[11px]"><span className="truncate font-bold text-slate-700">{item.label}</span><b>{formatter(item.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.max(4, number(item.value) / max * 100)}%` }}/></div></div>)}{!data.length && <p className="py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</p>}</div></div>; }
function TrendCard({ title, data, formatter = value => number(value).toLocaleString('es-CL') }) { const max = Math.max(...data.map(item => number(item.value)), 1); return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-5 flex h-44 items-end gap-2">{data.map(item => <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[9px] font-black text-slate-600">{formatter(item.value)}</span><div className="w-full rounded-t-md bg-emerald-600" style={{ height: `${Math.max(5, number(item.value) / max * 120)}px` }}/><span className="text-[8px] uppercase text-slate-400">{item.label}</span></div>)}</div></div>; }
function DonutLikeCard({ title, data }) { const total = data.reduce((sum, item) => sum + number(item.value), 0); const colors = ['bg-blue-700','bg-emerald-600','bg-amber-500','bg-violet-600','bg-rose-500','bg-slate-500']; return <div className="rounded-2xl border bg-white p-5"><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">{title}</h4><div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100">{data.map((item,index) => <div key={item.label} className={colors[index % colors.length]} style={{ width: `${total ? item.value / total * 100 : 0}%` }}/>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{data.map((item,index) => <div key={item.label} className="flex items-center gap-2 text-[11px]"><span className={`h-2.5 w-2.5 rounded-full ${colors[index % colors.length]}`}/><span className="min-w-0 flex-1 truncate text-slate-600">{item.label}</span><b>{item.value}</b></div>)}</div></div>; }
