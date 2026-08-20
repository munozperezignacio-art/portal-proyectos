import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarRange, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';

const clean = value => String(value ?? '').trim();
const key = value => clean(value).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
const codeKey = value => clean(value).toUpperCase();
const pad = value => String(value).padStart(2, '0');
const isBudgetGroup = item => item?.es_titulo || ['TITULO', 'GRUPO'].includes(String(item?.unidad || '').toUpperCase()) || ['CAPITULO', 'SUBCAPITULO', 'TITULO', 'GRUPO'].includes(String(item?.tipo_item || '').toUpperCase());

const toIsoDate = value => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (typeof value === 'number') {
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
  }
  const raw = clean(value);
  const chile = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (chile) return `${chile[3]}-${pad(chile[2])}-${pad(chile[1])}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const childText = (node, name) => {
  const item = Array.from(node.children || []).find(child => child.localName === name || child.nodeName === name);
  return clean(item?.textContent);
};

const durationDays = (value, minutesPerDay = 540) => {
  const match = clean(value).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return Number(value) || 0;
  const minutes = (Number(match[1]) || 0) * 1440 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0) + (Number(match[4]) || 0) / 60;
  return minutes ? Math.max(1, Math.ceil(minutes / Math.max(1, minutesPerDay))) : 0;
};

const parseDependency = value => {
  const raw = clean(value);
  if (!raw) return { code: '', type: 'FC', lag: 0 };
  const match = raw.match(/^(.+?)(?:\s*(FC|CC|FS|SS))?(?:\s*([+-]\d+))?$/i);
  const importedType = (match?.[2] || 'FC').toUpperCase();
  return { code: clean(match?.[1]), type: importedType === 'SS' ? 'CC' : 'FC', lag: Number(match?.[3]) || 0 };
};

const validateTasks = tasks => {
  const errors = [];
  const warnings = [];
  const codes = new Set();
  tasks.forEach((task, index) => {
    if (!task.codigo) errors.push(`Fila ${index + 2}: falta CODIGO.`);
    if (!task.tarea) errors.push(`Fila ${index + 2}: falta ACTIVIDAD.`);
    if (!task.fecha_inicio) errors.push(`Fila ${index + 2}: fecha de inicio inválida.`);
    if (task.codigo && codes.has(task.codigo)) errors.push(`Código duplicado: ${task.codigo}.`);
    codes.add(task.codigo);
  });
  tasks.forEach(task => {
    if (task.predecesora_code && !codes.has(task.predecesora_code)) warnings.push(`${task.codigo}: la predecesora ${task.predecesora_code} no está en el archivo.`);
  });
  const visiting = new Set();
  const visited = new Set();
  const byCode = new Map(tasks.map(task => [task.codigo, task]));
  const visit = code => {
    if (visiting.has(code)) return true;
    if (visited.has(code)) return false;
    visiting.add(code);
    const pred = byCode.get(code)?.predecesora_code;
    if (pred && byCode.has(pred) && visit(pred)) return true;
    visiting.delete(code); visited.add(code); return false;
  };
  if (tasks.some(task => visit(task.codigo))) errors.push('Se detectó una dependencia circular entre tareas.');
  return { errors, warnings };
};

const normalizeExcelRows = (rows, calculateEndDate) => rows.filter(row => Object.values(row).some(Boolean)).map((row, index) => {
  const normalized = Object.fromEntries(Object.entries(row).map(([header, value]) => [key(header), value]));
  const code = clean(normalized.CODIGO || normalized.WBS || normalized.ID || index + 1);
  const task = clean(normalized.ACTIVIDAD || normalized.TAREA || normalized.NOMBRE);
  const start = toIsoDate(normalized.FECHAINICIO || normalized.INICIO);
  const milestone = ['SI', 'SÍ', 'TRUE', '1', 'YES'].includes(clean(normalized.ESHITO || normalized.HITO).toUpperCase());
  let duration = milestone ? 0 : Math.max(1, Number(normalized.DURACIONDIAS || normalized.DURACION || 1) || 1);
  let finish = toIsoDate(normalized.FECHAFIN || normalized.TERMINO || normalized.FIN);
  if (!finish && start) finish = calculateEndDate(start, duration);
  const dependency = parseDependency(normalized.PREDECESORA || normalized.PREDECESOR || '');
  const explicitType = clean(normalized.TIPODEPENDENCIA || normalized.TIPO).toUpperCase();
  const explicitLag = Number(normalized.DESFASEDIAS || normalized.DESFASE);
  const type = ['CC', 'SS'].includes(explicitType) ? 'CC' : dependency.type;
  const lag = Number.isFinite(explicitLag) ? explicitLag : dependency.lag;
  return {
    id: `temp-import-${Date.now()}-${index}`,
    codigo: code, tarea: task, fecha_inicio: start, fecha_fin: finish, duracion: duration,
    predecesora_code: dependency.code, predecesora_tipo: type, predecesora_desfase: lag,
    predecesora: dependency.code ? `${dependency.code}${type}${lag >= 0 ? '+' : ''}${lag}` : '',
    porcentaje_avance: Math.min(100, Math.max(0, Number(normalized.AVANCEPCT || normalized.AVANCE || 0) || 0)),
    responsable: clean(normalized.RESPONSABLE), estado: milestone ? 'slate' : 'blue', is_partida: false,
    requiere_partida: !milestone, es_resumen_project: false
  };
});

const parseProjectXml = (text, calculateEndDate) => {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('El XML de Microsoft Project no es válido.');
  const minutesPerDay = Number(Array.from(xml.documentElement.children || []).find(node => node.localName === 'MinutesPerDay')?.textContent) || 540;
  const nodes = Array.from(xml.getElementsByTagNameNS('*', 'Task'));
  const rawTasks = nodes.map(node => ({
    uid: childText(node, 'UID'), id: childText(node, 'ID'), code: childText(node, 'WBS') || childText(node, 'OutlineNumber') || childText(node, 'ID'),
    name: childText(node, 'Name'), start: toIsoDate(childText(node, 'Start')), finish: toIsoDate(childText(node, 'Finish')),
    duration: durationDays(childText(node, 'Duration'), minutesPerDay), milestone: childText(node, 'Milestone') === '1', summary: childText(node, 'Summary') === '1',
    progress: Number(childText(node, 'PercentComplete')) || 0, responsible: childText(node, 'Contact') || childText(node, 'ResourceNames'),
    predecessorNode: Array.from(node.children || []).find(child => child.localName === 'PredecessorLink')
  })).filter(task => task.uid !== '0' && task.name);
  const uidToCode = new Map(rawTasks.map(task => [task.uid, task.code]));
  const warnings = [];
  const tasks = rawTasks.map((task, index) => {
    const predecessorUid = task.predecessorNode ? childText(task.predecessorNode, 'PredecessorUID') : '';
    const projectType = task.predecessorNode ? childText(task.predecessorNode, 'Type') : '';
    const type = projectType === '4' ? 'CC' : 'FC';
    if (predecessorUid && !['', '2', '4'].includes(projectType)) warnings.push(`${task.code}: dependencia especial convertida a Fin-Comienzo.`);
    const duration = task.milestone ? 0 : Math.max(1, task.duration || 1);
    const finish = task.finish || calculateEndDate(task.start, duration);
    const predecessor = uidToCode.get(predecessorUid) || '';
    return {
      id: `temp-project-${Date.now()}-${index}`, codigo: task.code, tarea: task.name,
      fecha_inicio: task.start, fecha_fin: finish, duracion: duration,
      predecesora_code: predecessor, predecesora_tipo: type, predecesora_desfase: 0,
      predecesora: predecessor ? `${predecessor}${type}+0` : '', porcentaje_avance: Math.min(100, Math.max(0, task.progress)),
      responsable: task.responsible, estado: task.milestone ? 'slate' : 'blue', is_partida: false,
      requiere_partida: !task.milestone && !task.summary, es_resumen_project: task.summary
    };
  });
  return { tasks, warnings };
};

export default function ScheduleFileImporter({ calculateEndDate, onApply, budgetItems = [], disabled = false }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [reading, setReading] = useState(false);
  const summary = useMemo(() => preview ? {
    total: preview.tasks.length,
    milestones: preview.tasks.filter(task => Number(task.duracion) === 0).length,
    start: preview.tasks.map(task => task.fecha_inicio).filter(Boolean).sort()[0] || '—',
    finish: preview.tasks.map(task => task.fecha_fin).filter(Boolean).sort().at(-1) || '—'
  } : null, [preview]);
  const executableBudgetItems = useMemo(() => budgetItems.filter(item => !isBudgetGroup(item)), [budgetItems]);
  const reconciliation = useMemo(() => {
    if (!preview) return null;
    const matchedIds = new Set(preview.tasks.map(task => Number(task.presupuesto_item_id)).filter(Boolean));
    const linkable = preview.tasks.filter(task => task.requiere_partida !== false);
    const manualTasks = linkable.filter(task => task.tipo_conciliacion === 'manual');
    const unmatchedTasks = linkable.filter(task => !task.presupuesto_item_id);
    return {
      exact: linkable.filter(task => task.tipo_conciliacion === 'exacta').length,
      manual: manualTasks.length,
      manualTasks,
      unmatchedTasks,
      manualCandidates: [...unmatchedTasks, ...manualTasks],
      matchedIds,
      unmatchedBudget: executableBudgetItems.filter(item => !matchedIds.has(Number(item.id)))
    };
  }, [executableBudgetItems, preview]);

  const reconcileByCode = tasks => {
    const byCode = new Map(executableBudgetItems.map(item => [codeKey(item.codigo), item]));
    return tasks.map(task => {
      if (task.requiere_partida === false) return { ...task, presupuesto_item_id: null, tipo_conciliacion: 'no_aplica' };
      const item = byCode.get(codeKey(task.codigo));
      return { ...task, presupuesto_item_id: item?.id || null, tipo_conciliacion: item ? 'exacta' : 'pendiente' };
    });
  };

  const setManualMatch = (taskId, itemId) => setPreview(current => ({
    ...current,
    tasks: current.tasks.map(task => task.id === taskId ? { ...task, presupuesto_item_id: itemId ? Number(itemId) : null, tipo_conciliacion: itemId ? 'manual' : 'pendiente' } : task)
  }));

  const downloadTemplate = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const wb = XLSX.utils.book_new();
    const guide = XLSX.utils.aoa_to_sheet([
      ['PLANTILLA OFICIAL DE PLANIFICACIÓN OBRAXIS'],
      ['Complete la hoja Cronograma. No cambie los encabezados. Fechas: AAAA-MM-DD o DD-MM-AAAA.'],
      ['TIPO_DEPENDENCIA: FC (Fin-Comienzo) o CC (Comienzo-Comienzo). DESFASE_DIAS admite positivos y negativos.'],
      ['ES_HITO: SI para duración cero. Los códigos deben ser únicos y las predecesoras deben referir a otro código.']
    ]);
    guide['!cols'] = [{ wch: 115 }];
    const schedule = XLSX.utils.json_to_sheet([
      { CODIGO: '1', ACTIVIDAD: 'OBRAS PRELIMINARES', ES_HITO: 'NO', FECHA_INICIO: '2026-08-17', FECHA_FIN: '2026-08-28', DURACION_DIAS: 10, PREDECESORA: '', TIPO_DEPENDENCIA: 'FC', DESFASE_DIAS: 0, RESPONSABLE: 'Jefe de Terreno', AVANCE_PCT: 0 },
      { CODIGO: '1.1', ACTIVIDAD: 'Instalación de faena', ES_HITO: 'NO', FECHA_INICIO: '2026-08-17', FECHA_FIN: '2026-08-21', DURACION_DIAS: 5, PREDECESORA: '', TIPO_DEPENDENCIA: 'FC', DESFASE_DIAS: 0, RESPONSABLE: 'Capataz', AVANCE_PCT: 0 },
      { CODIGO: 'H-1', ACTIVIDAD: 'Entrega de terreno', ES_HITO: 'SI', FECHA_INICIO: '2026-08-24', FECHA_FIN: '2026-08-24', DURACION_DIAS: 0, PREDECESORA: '1.1', TIPO_DEPENDENCIA: 'FC', DESFASE_DIAS: 0, RESPONSABLE: 'Administrador de Obra', AVANCE_PCT: 0 }
    ]);
    schedule['!cols'] = [12, 38, 10, 15, 15, 15, 15, 19, 15, 24, 13].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, guide, 'Instrucciones');
    XLSX.utils.book_append_sheet(wb, schedule, 'Cronograma');
    XLSX.writeFile(wb, 'Plantilla_Oficial_Planificacion_Obraxis.xlsx');
  };

  const readFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'mpp') throw new Error('El archivo .mpp es binario. En Microsoft Project use Archivo > Guardar como > XML y cargue ese XML para conservar la planificación.');
      let tasks = []; let sourceWarnings = [];
      if (extension === 'xml') {
        const parsed = parseProjectXml(await file.text(), calculateEndDate);
        tasks = parsed.tasks; sourceWarnings = parsed.warnings;
      } else if (['xlsx', 'xls'].includes(extension)) {
        const { loadSpreadsheetEngine } = await import('../services/documentEngines');
        const XLSX = await loadSpreadsheetEngine();
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const sheet = wb.Sheets.Cronograma || wb.Sheets[wb.SheetNames[0]];
        tasks = normalizeExcelRows(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }), calculateEndDate);
      } else throw new Error('Formato no compatible. Use Excel (.xlsx/.xls) o XML exportado desde Microsoft Project.');
      if (!tasks.length) throw new Error('El archivo no contiene tareas reconocibles.');
      const reconciledTasks = reconcileByCode(tasks);
      const validation = validateTasks(reconciledTasks);
      setPreview({ fileName: file.name, tasks: reconciledTasks, errors: validation.errors, warnings: [...sourceWarnings, ...validation.warnings] });
    } catch (error) {
      setPreview({ fileName: file.name, tasks: [], errors: [error.message], warnings: [] });
    } finally { setReading(false); }
  };

  return <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-xs">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-3"><span className="rounded-2xl bg-blue-700 p-3 text-white"><CalendarRange className="h-5 w-5"/></span><div><h4 className="text-sm font-black text-slate-900">Crear planificación desde archivo</h4><p className="mt-1 text-xs text-slate-600">Importa Excel Obraxis o XML de Microsoft Project. Se validan fechas, códigos, hitos y dependencias antes de reemplazar el cronograma.</p></div></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2 text-xs font-black text-blue-800"><Download className="h-4 w-4"/>Plantilla Excel</button><button type="button" disabled={disabled || reading} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Upload className="h-4 w-4"/>{reading ? 'Leyendo…' : 'Subir Project / Excel'}</button><input ref={fileRef} type="file" accept=".xml,.mpp,.xlsx,.xls" onChange={readFile} className="hidden"/></div>
    </div>
    <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><FileSpreadsheet className="h-3.5 w-3.5"/>Para archivos nativos .mpp, expórtelos desde Microsoft Project como XML.</p>
    {preview && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black text-slate-900">{preview.fileName}</p>{summary && <p className="mt-1 text-[11px] text-slate-600">{summary.total} tareas · {summary.milestones} hitos · {summary.start} a {summary.finish}</p>}</div>{preview.errors.length === 0 && <button type="button" disabled={disabled} onClick={() => onApply(preview.tasks)} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>Aplicar conciliación y guardar</button>}</div>
      {reconciliation && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4"><div className="grid gap-2 sm:grid-cols-4"><ReconciliationMetric label="Coincidencia exacta" value={reconciliation.exact} tone="emerald"/><ReconciliationMetric label="Asociación manual" value={reconciliation.manual} tone="blue"/><ReconciliationMetric label="Tareas sin partida" value={reconciliation.unmatchedTasks.length} tone="amber"/><ReconciliationMetric label="Partidas sin tarea" value={reconciliation.unmatchedBudget.length} tone="slate"/></div>{reconciliation.manualCandidates.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-900">Asociar tareas con códigos diferentes</p><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{reconciliation.manualCandidates.map(task => <div key={task.id} className="grid items-center gap-2 rounded-lg bg-white p-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)]"><div className="min-w-0 text-[11px]"><b className="block truncate text-slate-900">{task.codigo} · {task.tarea}</b><span className={task.presupuesto_item_id ? 'text-blue-700' : 'text-amber-700'}>{task.presupuesto_item_id ? 'Asociación manual' : 'Sin partida asociada'}</span></div><select value={task.presupuesto_item_id || ''} onChange={event => setManualMatch(task.id, event.target.value)} className="w-full rounded-lg border border-amber-300 bg-white p-2 text-[11px] font-bold text-slate-700"><option value="">Mantener sin asociación</option>{executableBudgetItems.map(item => <option key={item.id} value={item.id} disabled={reconciliation.matchedIds.has(Number(item.id)) && Number(task.presupuesto_item_id) !== Number(item.id)}>{item.codigo} · {item.partida}</option>)}</select></div>)}</div></div>}{reconciliation.unmatchedBudget.length > 0 && <details className="rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-slate-700">Ver {reconciliation.unmatchedBudget.length} partidas sin tarea</summary><div className="mt-2 max-h-40 overflow-y-auto text-[11px] text-slate-600">{reconciliation.unmatchedBudget.map(item => <p key={item.id} className="border-t border-slate-200 py-1.5 first:border-0">{item.codigo} · {item.partida}</p>)}</div></details>}</div>}
      {preview.errors.map((message, index) => <p key={`e-${index}`} className="mt-2 flex gap-2 text-xs font-bold text-red-700"><AlertCircle className="h-4 w-4 shrink-0"/>{message}</p>)}
      {preview.warnings.slice(0, 8).map((message, index) => <p key={`w-${index}`} className="mt-2 flex gap-2 text-[11px] text-amber-700"><AlertCircle className="h-4 w-4 shrink-0"/>{message}</p>)}
    </div>}
  </div>;
}

function ReconciliationMetric({ label, value, tone }) { const colors = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800', blue: 'border-blue-200 bg-blue-50 text-blue-800', amber: 'border-amber-200 bg-amber-50 text-amber-800', slate: 'border-slate-200 bg-slate-50 text-slate-700' }; return <div className={`rounded-xl border p-2.5 ${colors[tone]}`}><span className="block text-[9px] font-black uppercase">{label}</span><strong className="mt-1 block text-lg">{value}</strong></div>; }
