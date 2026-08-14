import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, ChevronDown, ChevronUp, Download, FileSpreadsheet, Paperclip, Plus, Save, Trash2, Upload } from 'lucide-react';
import { supabase } from '../supabaseClient';

const BASE_COLUMNS = [
  { key: 'proceso', label: 'Proceso', type: 'text', required: true },
  { key: 'puesto_trabajo', label: 'Puesto de trabajo', type: 'text', required: true },
  { key: 'tarea', label: 'Tarea', type: 'text', required: true },
  { key: 'peligro_factor', label: 'Peligro / factor de riesgo', type: 'textarea', required: true },
  { key: 'riesgo', label: 'Riesgo', type: 'text', required: true },
  { key: 'tipo_riesgo', label: 'Familia de riesgo', type: 'select', options: ['Seguridad y emergencias', 'Higiénico', 'Psicosocial', 'Musculoesquelético', 'Otro'], required: true },
  { key: 'personas_expuestas', label: 'Personas expuestas', type: 'number' },
  { key: 'controles_existentes', label: 'Controles existentes', type: 'textarea' },
  { key: 'probabilidad', label: 'Probabilidad (P)', type: 'select', options: ['1', '2', '4'] },
  { key: 'consecuencia', label: 'Consecuencia (S)', type: 'select', options: ['1', '2', '4'] },
  { key: 'vep', label: 'VEP', type: 'number', calculated: true },
  { key: 'nivel_riesgo', label: 'Nivel de riesgo', type: 'calculated', calculated: true },
  { key: 'magnitud_exposicion', label: 'Magnitud de exposición', type: 'text' },
  { key: 'medidas_preventivas', label: 'Medidas preventivas', type: 'textarea', required: true },
  { key: 'jerarquia_control', label: 'Jerarquía de control', type: 'select', options: ['Eliminación', 'Sustitución', 'Control de ingeniería', 'Control administrativo', 'EPP'] },
  { key: 'responsable', label: 'Responsable', type: 'text' },
  { key: 'plazo', label: 'Plazo', type: 'date' },
  { key: 'estado', label: 'Estado', type: 'select', options: ['Pendiente', 'En ejecución', 'Implementada', 'Verificada'] }
];

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = {
  proceso: ['proceso'], puesto_trabajo: ['puesto de trabajo', 'puesto', 'cargo'], tarea: ['tarea', 'actividad'],
  peligro_factor: ['peligro factor de riesgo', 'peligro', 'factor de riesgo', 'identificacion de peligros'], riesgo: ['riesgo', 'evento no deseado'],
  tipo_riesgo: ['familia de riesgo', 'tipo de riesgo', 'clasificacion'], personas_expuestas: ['personas expuestas', 'n expuestos', 'numero expuestos'],
  controles_existentes: ['controles existentes', 'medidas existentes'], probabilidad: ['probabilidad p', 'probabilidad'],
  consecuencia: ['consecuencia s', 'consecuencia', 'severidad'], vep: ['vep'], nivel_riesgo: ['nivel de riesgo', 'clasificacion del riesgo'],
  magnitud_exposicion: ['magnitud de exposicion', 'exposicion'], medidas_preventivas: ['medidas preventivas', 'medidas de control', 'control'],
  jerarquia_control: ['jerarquia de control', 'jerarquia'], responsable: ['responsable'], plazo: ['plazo', 'fecha compromiso'], estado: ['estado']
};
const matchKey = header => Object.entries(aliases).find(([, values]) => values.includes(normalize(header)))?.[0] || null;
const riskLevel = value => Number(value) >= 16 ? 'Intolerable' : Number(value) >= 8 ? 'Importante' : Number(value) >= 4 ? 'Moderado' : Number(value) >= 2 ? 'Tolerable' : Number(value) >= 1 ? 'Trivial' : '';
const enrichRow = row => {
  const p = Number(row.probabilidad), s = Number(row.consecuencia);
  if (p > 0 && s > 0) { const vep = p * s; return { ...row, vep, nivel_riesgo: riskLevel(vep) }; }
  return row;
};
const emptyMeta = () => ({ nombre: '', codigo: 'MIPER-001', version: '1', fecha_revision: new Date().toISOString().slice(0, 10), obra_id: '', metodologia: 'ISP Chile · Guía IPER v3 (2024)', estado: 'Borrador' });

export default function RiskMatrixManager({ user, obras = [], canCreate = false, canDelete = false }) {
  const [matrices, setMatrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [columns, setColumns] = useState(BASE_COLUMNS);
  const [rows, setRows] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('text');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('prevencion_matrices_riesgo').select('*, prevencion_matriz_riesgo_filas(*)').eq('empresa', user?.empresa).order('updated_at', { ascending: false });
    setLoading(false);
    if (error) { setMessage(error.message); return; }
    setMatrices((data || []).map(item => ({ ...item, filas: (item.prevencion_matriz_riesgo_filas || []).sort((a, b) => a.orden - b.orden) })));
  }, [user?.empresa]);
  useEffect(() => { if (user?.empresa) load(); }, [load, user?.empresa]);

  const stats = useMemo(() => matrices.reduce((acc, matrix) => {
    acc.rows += matrix.filas?.length || 0;
    acc.critical += (matrix.filas || []).filter(row => ['Importante', 'Intolerable'].includes(row.nivel_riesgo)).length;
    return acc;
  }, { rows: 0, critical: 0 }), [matrices]);

  const reset = () => { setMeta(emptyMeta()); setColumns(BASE_COLUMNS); setRows([]); setAttachment(null); setCustomName(''); setMessage(''); };
  const addColumn = () => {
    const label = customName.trim(); if (!label) return;
    let key = `custom_${normalize(label).replace(/ /g, '_') || Date.now()}`;
    while (columns.some(column => column.key === key)) key += '_2';
    setColumns([...columns, { key, label, type: customType, custom: true }]); setCustomName('');
  };
  const removeColumn = key => { setColumns(columns.filter(column => column.key !== key)); setRows(rows.map(row => { const next = { ...row }; delete next[key]; return next; })); };
  const addRow = () => setRows([...rows, { estado: 'Pendiente' }]);
  const updateCell = (index, key, value) => setRows(rows.map((row, rowIndex) => rowIndex === index ? enrichRow({ ...row, [key]: value }) : row));

  const parseFile = async file => {
    setAttachment(file); setMessage('');
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { setMessage('El archivo quedará adjunto. La lectura automática está disponible para Excel y CSV.'); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      const headerIndex = grid.findIndex(line => line.filter(cell => matchKey(cell)).length >= 3);
      const effectiveHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
      const headers = (grid[effectiveHeaderIndex] || []).map((header, index) => String(header || `Columna ${index + 1}`).trim());
      const raw = grid.slice(effectiveHeaderIndex + 1)
        .filter(line => line.some(value => String(value || '').trim()))
        .map(line => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ''])));
      const mapped = new Map(); const nextColumns = [...BASE_COLUMNS];
      headers.forEach(header => {
        const known = matchKey(header);
        if (known) mapped.set(header, known);
        else {
          let key = `custom_${normalize(header).replace(/ /g, '_') || nextColumns.length}`;
          while (nextColumns.some(column => column.key === key)) key += '_2';
          nextColumns.push({ key, label: header, type: 'text', custom: true }); mapped.set(header, key);
        }
      });
      setColumns(nextColumns);
      setRows(raw.map(source => enrichRow(Object.fromEntries(Object.entries(source).map(([header, value]) => [mapped.get(header), value instanceof Date ? value.toISOString().slice(0, 10) : value])))));
      setMessage(`${raw.length} filas leídas desde la fila ${effectiveHeaderIndex + 1}. ${nextColumns.length - BASE_COLUMNS.length} columnas propias detectadas.`);
    } catch (error) { setMessage(`No fue posible leer la estructura: ${error.message}`); }
  };

  const save = async () => {
    if (!canCreate || !meta.nombre.trim()) { setMessage('Ingresa el nombre de la matriz.'); return; }
    setSaving(true); setMessage('');
    let createdMatrixId = null;
    let uploadedPath = null;
    try {
      const payload = { empresa: user.empresa, obra_id: meta.obra_id ? Number(meta.obra_id) : null, nombre: meta.nombre.trim(), codigo: meta.codigo.trim(), version: meta.version.trim(), fecha_revision: meta.fecha_revision, metodologia: meta.metodologia, estado: meta.estado, columnas: columns, archivo_nombre: attachment?.name || null, archivo_tipo: attachment?.type || null, creado_por: user.correo || user.usuario || user.nombre || null };
      const { data: matrix, error } = await supabase.from('prevencion_matrices_riesgo').insert(payload).select().single();
      if (error) throw error;
      createdMatrixId = matrix.id;
      let archivoPath = null;
      if (attachment) {
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]+/g, '_'); archivoPath = `${matrix.id}/${Date.now()}_${safeName}`;
        const upload = await supabase.storage.from('matrices-riesgo').upload(archivoPath, attachment, { upsert: false });
        if (upload.error) throw upload.error;
        uploadedPath = archivoPath;
        const update = await supabase.from('prevencion_matrices_riesgo').update({ archivo_path: archivoPath }).eq('id', matrix.id);
        if (update.error) throw update.error;
      }
      if (rows.length) {
        const inserts = rows.map((datos, index) => ({ matriz_id: matrix.id, empresa: user.empresa, orden: index + 1, datos: enrichRow(datos), nivel_riesgo: enrichRow(datos).nivel_riesgo || null }));
        const result = await supabase.from('prevencion_matriz_riesgo_filas').insert(inserts); if (result.error) throw result.error;
      }
      setShowEditor(false); reset(); await load();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('matrices-riesgo').remove([uploadedPath]);
      if (createdMatrixId) await supabase.from('prevencion_matrices_riesgo').delete().eq('id', createdMatrixId);
      setMessage(error.message);
    } finally { setSaving(false); }
  };

  const remove = async matrix => {
    if (!canDelete || !window.confirm(`¿Eliminar la matriz ${matrix.codigo}?`)) return;
    if (matrix.archivo_path) await supabase.storage.from('matrices-riesgo').remove([matrix.archivo_path]);
    const { error } = await supabase.from('prevencion_matrices_riesgo').delete().eq('id', matrix.id);
    if (error) setMessage(error.message); else load();
  };
  const downloadAttachment = async matrix => {
    const { data, error } = await supabase.storage.from('matrices-riesgo').download(matrix.archivo_path);
    if (error) { setMessage(error.message); return; }
    const link = document.createElement('a'); link.href = URL.createObjectURL(data); link.download = matrix.archivo_nombre || 'matriz-riesgo'; link.click(); URL.revokeObjectURL(link.href);
  };
  const downloadTemplate = () => {
    const sheet = XLSX.utils.json_to_sheet([Object.fromEntries(BASE_COLUMNS.map(column => [column.label, '']))]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Matriz IPER'); XLSX.writeFile(workbook, 'Plantilla_MIPER_Obraxis_ISP.xlsx');
  };

  const riskBadge = level => ({ Intolerable: 'bg-red-100 text-red-800', Importante: 'bg-orange-100 text-orange-800', Moderado: 'bg-amber-100 text-amber-800', Tolerable: 'bg-blue-100 text-blue-800', Trivial: 'bg-emerald-100 text-emerald-800' }[level] || 'bg-slate-100 text-slate-600');

  return <div className="space-y-5">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-3"><span className="rounded-2xl bg-rose-50 p-3 text-rose-700"><AlertTriangle className="h-6 w-6" /></span><div><h3 className="text-base font-extrabold text-slate-900">Matriz de Identificación de Peligros y Evaluación de Riesgos</h3><p className="mt-1 text-xs text-slate-500">Formato propuesto basado en Guía IPER v3 (ISP Chile, Anexo 6) y D.S. N°44.</p></div></div></div><div className="flex flex-wrap gap-2"><button onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Download className="h-4 w-4" />Plantilla Obraxis</button>{canCreate && <button onClick={() => { reset(); setShowEditor(true); }} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" />Nueva matriz</button>}</div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Matrices', matrices.length], ['Filas evaluadas', stats.rows], ['Riesgos altos/críticos', stats.critical], ['Revisión normativa', 'Anual']].map(([label,value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-800">{value}</p></div>)}</div>
    </div>

    {message && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-900">{message}</div>}
    {loading ? <div className="rounded-2xl bg-white p-8 text-center text-xs text-slate-500">Cargando matrices…</div> : matrices.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><FileSpreadsheet className="mx-auto h-9 w-9 text-slate-300" /><h4 className="mt-3 text-sm font-extrabold text-slate-700">Aún no hay matrices registradas</h4><p className="mt-1 text-xs text-slate-500">Carga un Excel existente o comienza con la plantilla propuesta por Obraxis.</p></div> : <div className="space-y-3">{matrices.map(matrix => <div key={matrix.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><button onClick={() => setExpanded(expanded === matrix.id ? null : matrix.id)} className="flex flex-1 items-center gap-3 text-left"><span className="rounded-xl bg-rose-50 p-2 text-rose-700"><FileSpreadsheet className="h-5 w-5" /></span><span><span className="block text-xs font-black text-slate-900">{matrix.codigo} · {matrix.nombre}</span><span className="mt-1 block text-[10px] text-slate-500">Versión {matrix.version} · {matrix.obra_id ? obras.find(obra => Number(obra.id) === Number(matrix.obra_id))?.nombre || 'Obra' : 'Corporativa'} · {matrix.filas.length} filas</span></span>{expanded === matrix.id ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}</button><div className="flex gap-2">{matrix.archivo_path && <button onClick={() => downloadAttachment(matrix)} className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-800">Adjunto</button>}{canDelete && <button onClick={() => remove(matrix)} className="rounded-lg bg-red-50 p-2 text-red-700"><Trash2 className="h-4 w-4" /></button>}</div></div>{expanded === matrix.id && <div className="border-t border-slate-200 p-4"><div className="overflow-x-auto"><table className="min-w-[1100px] text-left text-[10px]"><thead className="bg-slate-100 uppercase text-slate-500"><tr>{matrix.columnas.map(column => <th key={column.key} className="whitespace-nowrap p-2">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{matrix.filas.map(row => <tr key={row.id}>{matrix.columnas.map(column => <td key={column.key} className="max-w-[220px] p-2 text-slate-700">{column.key === 'nivel_riesgo' ? <span className={`rounded-full px-2 py-1 font-black ${riskBadge(row.datos?.[column.key])}`}>{row.datos?.[column.key] || '—'}</span> : String(row.datos?.[column.key] ?? '—')}</td>)}</tr>)}</tbody></table></div></div>}</div>)}</div>}

    {showEditor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"><div className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Nueva matriz IPER / MIPER</p><h3 className="mt-1 text-lg font-black text-slate-900">Importar o construir matriz</h3></div><button onClick={() => setShowEditor(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold">Cerrar</button></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-xs font-bold text-slate-700">Nombre *<input value={meta.nombre} onChange={e => setMeta({...meta,nombre:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-xs font-bold text-slate-700">Código<input value={meta.codigo} onChange={e => setMeta({...meta,codigo:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-xs font-bold text-slate-700">Versión<input value={meta.version} onChange={e => setMeta({...meta,version:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-xs font-bold text-slate-700">Fecha de revisión<input type="date" value={meta.fecha_revision} onChange={e => setMeta({...meta,fecha_revision:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-xs font-bold text-slate-700">Alcance<select value={meta.obra_id} onChange={e => setMeta({...meta,obra_id:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="">Corporativa</option>{obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}</select></label><label className="text-xs font-bold text-slate-700">Estado<select value={meta.estado} onChange={e => setMeta({...meta,estado:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"><option>Borrador</option><option>Vigente</option><option>En revisión</option><option>Obsoleta</option></select></label></div>
      <div className="mt-4 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-4"><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} /><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-xs font-black text-white"><Upload className="h-4 w-4" />Subir matriz o adjunto</button><p className="mt-2 text-[10px] text-blue-900">Excel/CSV: lectura automática de encabezados y filas. PDF o imagen: se conserva como respaldo adjunto.</p>{attachment && <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-700"><Paperclip className="h-4 w-4" />{attachment.name}</p>}</div>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase text-slate-700">Columnas del formato</p><div className="mt-3 flex flex-wrap gap-2">{columns.map(column => <span key={column.key} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold ${column.custom ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{column.label}{column.custom && <button onClick={() => removeColumn(column.key)}><Trash2 className="h-3 w-3" /></button>}</span>)}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nombre de columna propia" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs" /><select value={customType} onChange={e => setCustomType(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"><option value="text">Texto</option><option value="number">Número</option><option value="date">Fecha</option><option value="textarea">Texto largo</option></select><button onClick={addColumn} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white">+ Agregar columna</button></div></div>
      <div className="mt-4"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-slate-700">Datos ({rows.length} filas)</p><button onClick={addRow} className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700">+ Agregar fila</button></div><div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-slate-200"><table className="min-w-[1400px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">#</th>{columns.map(column => <th key={column.key} className="whitespace-nowrap p-2">{column.label}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={index} className="border-t border-slate-100"><td className="p-2 text-slate-400">{index+1}</td>{columns.map(column => <td key={column.key} className="p-1">{column.calculated ? <span className={`block min-w-20 rounded px-2 py-1 ${column.key === 'nivel_riesgo' ? riskBadge(row[column.key]) : 'bg-slate-50'}`}>{row[column.key] || '—'}</span> : column.type === 'select' ? <select value={row[column.key] ?? ''} onChange={e => updateCell(index,column.key,e.target.value)} className="min-w-32 rounded border border-slate-200 bg-white px-2 py-1"><option value="">Seleccionar</option>{column.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={row[column.key] ?? ''} onChange={e => updateCell(index,column.key,e.target.value)} className="min-w-32 rounded border border-slate-200 px-2 py-1" />}</td>)}</tr>)}</tbody></table></div></div>
      {message && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-900">{message}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowEditor(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar matriz'}</button></div>
    </div></div>}
  </div>;
}
