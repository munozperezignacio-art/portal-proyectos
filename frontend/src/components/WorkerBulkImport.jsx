import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

import { WORKER_FIELDS as FIELDS, REQUIRED_WORKER_FIELDS as REQUIRED, readWorkerMatrix, validateWorkerRows, workerContractSummary } from '../utils/workerImport.js';
const label = key => key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

export default function WorkerBulkImport({ companyName, obras = [], onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [existing, setExisting] = useState([]);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const downloadTemplate = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const example = [{ RUT: '12345678-5', 'Nombre completo': 'María González Soto', Cargo: 'Jornal', Teléfono: '+56912345678', Correo: 'maria@empresa.cl', 'Obra asignada': 'Sin asignar', 'Fecha de asignación': '', 'Centro de trabajo': 'Oficina Central', Área: 'Operaciones', 'Sueldo base': 650000, 'Tipo de contrato': 'Indefinido', 'Fecha de ingreso': '13-08-2026', 'Fecha de término': '', 'Causal de término': 'sinDefinir', Banco: 'BancoEstado', 'Tipo de cuenta': 'CuentaRUT', 'Número de cuenta': '', AFP: 'Habitat', Salud: 'FONASA', Colación: 0, Movilización: 0 }];
    const instructions = [
      ['IMPORTACIÓN MASIVA DE TRABAJADORES — OBRAXIS'], ['Complete la hoja Trabajadores y reemplace o elimine la fila de ejemplo.'], [],
      ['Campo', 'Obligatorio', 'Formato recomendado', 'También se acepta / regla'],
      ['RUT', 'Sí', '12345678-5', '12.345.678-5 o 123456785. Se valida el dígito verificador y se guarda sin puntos, con guion.'],
      ['Nombre completo', 'Sí', 'María González Soto', 'Se limpian espacios; se conservan tildes.'], ['Cargo', 'Sí', 'Jornal', 'Texto libre.'],
      ['Teléfono', 'No', '+56912345678', '912345678 o +56 9 1234 5678.'], ['Correo', 'No', 'persona@empresa.cl', 'Se valida y guarda en minúsculas.'],
      ['Obra asignada', 'No', 'Nombre exacto', 'También “Sin asignar”. Una obra inexistente genera error.'],
      ['Fechas', 'No', '31-08-2026', 'DD-MM-AAAA, DD/MM/AAAA, AAAA-MM-DD o fecha real de Excel.'],
      ['Montos', 'No', '850000', '$850.000 o 850000.'], [],
      ['Duplicados', '', '', 'Solo se crean nuevos RUT de la empresa. Los existentes se omiten y nunca se actualizan.'],
      ['Contratos', '', '', 'Fechas del año 3000 = Indefinido sin vencimiento. Causales: 159i2 renuncia, 159i4 plazo, 159i5 término de obra.']
    ];
    const book = XLSX.utils.book_new();
    const info = XLSX.utils.aoa_to_sheet(instructions); info['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 25 }, { wch: 90 }];
    const sheet = XLSX.utils.json_to_sheet(example); sheet['!cols'] = Object.keys(example[0]).map(key => ({ wch: Math.max(15, Math.min(26, key.length + 4)) })); sheet['!autofilter'] = { ref: sheet['!ref'] };
    const catalog = XLSX.utils.aoa_to_sheet([['OBRAS DISPONIBLES'], ['Sin asignar'], ...obras.map(item => [item.nombre]), [], ['TIPOS DE CONTRATO'], ['Indefinido'], ['Plazo Fijo'], ['Por Obra o Faena']]); catalog['!cols'] = [{ wch: 48 }];
    XLSX.utils.book_append_sheet(book, info, 'Instrucciones'); XLSX.utils.book_append_sheet(book, sheet, 'Trabajadores'); XLSX.utils.book_append_sheet(book, catalog, 'Catálogos');
    XLSX.writeFile(book, `Plantilla_Importacion_RRHH_${String(companyName).replace(/[^a-z0-9]+/gi, '_')}.xlsx`);
  };

  const readFile = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage(null);
    try {
      const { loadSpreadsheetEngine } = await import('../services/documentEngines');
      const XLSX = await loadSpreadsheetEngine();
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, codepage: 65001 });
      const sheetName = book.SheetNames.includes('Trabajadores') ? 'Trabajadores' : book.SheetNames.includes('Listado') ? 'Listado' : book.SheetNames[0];
      const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: '', raw: true });
      const parsed = readWorkerMatrix(matrix);
      if (!parsed.rows.length || parsed.rows.length > 500) throw new Error('Carga entre 1 y 500 trabajadores por archivo.');
      const workers = [];
      for (let offset = 0; ; offset += 1000) {
        const response = await supabase.from('maestro_personal').select('id,rut,empresa').eq('empresa', companyName).order('id').range(offset, offset + 999);
        if (response.error) throw response.error;
        workers.push(...response.data); if (response.data.length < 1000) break;
      }
      setExisting(workers);
      const nextHeaders = parsed.headers;
      if (!nextHeaders.length) throw new Error('No se encontraron encabezados en el archivo.');
      const nextMapping = parsed.mapping;
      setFileName(file.name); setHeaders(nextHeaders); setMapping(nextMapping);
      setRawRows(parsed.rows);
      setStep(2);
    } catch (error) { setMessage({ error: error.message }); }
    finally { setBusy(false); event.target.value = ''; }
  };

  const validated = useMemo(() => validateWorkerRows({ rows: rawRows, mapping, company: companyName, existing, works: obras }), [rawRows, mapping, companyName, existing, obras]);
  const totals = { errors: validated.filter(item => item.errors.length).length, created: validated.filter(item => !item.errors.length && !item.existing).length, skipped: validated.filter(item => item.existing).length };
  const importable = totals.created;

  const downloadErrors = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const rows = validated.filter(item => item.errors.length).map(item => ({ Fila: item.row, RUT: item.data.rut, Nombre: item.data.nombre, Cargo: item.data.cargo, Errores: item.errors.join(' | ') }));
    const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 32 }, { wch: 25 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(book, sheet, 'Errores'); XLSX.writeFile(book, `Errores_Importacion_RRHH_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const executeImport = async () => {
    if (saving.current || !importable) return;
    saving.current = true; setBusy(true); setMessage(null);
    try {
      const candidates = validated.filter(item => !item.errors.length && !item.existing);
      const response = await supabase.rpc('importar_personal_solo_nuevos', { p_empresa: companyName, p_filas: candidates.map(item => ({ ...item.data, fila: item.row })) });
      if (response.error) throw response.error;
      const outcomes = response.data || [];
      if (outcomes.length !== candidates.length) throw new Error('El servidor no confirmó todas las filas. Vuelve a cargar el archivo para comprobar los RUT.');
      setMessage({ created: outcomes.filter(item => item.estado === 'creado').length, skipped: totals.skipped + outcomes.filter(item => item.estado === 'existente').length,
        failures: outcomes.filter(item => item.estado === 'error').map(item => `Fila ${item.fila}: ${item.mensaje}`), invalid: totals.errors });
      setStep(4);
      try { await onImported?.(); } catch { setMessage(current => ({ ...current, error: 'Carga procesada. No se pudo refrescar el listado; cierra y vuelve a entrar.' })); }
    } catch (failure) { setMessage({ error: failure.message + ' Puedes recargar el archivo: los existentes se omiten también en el servidor.' }); }
    finally { saving.current = false; setBusy(false); }
  };

  const missing = REQUIRED.filter(field => !mapping[field]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-label="Importar trabajadores" className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-6 py-4"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><FileSpreadsheet className="h-5 w-5 text-emerald-700"/>Importación masiva de trabajadores</h3><p className="mt-1 text-xs text-slate-500">{companyName} · Solo crear nuevos por RUT · Sin modificar fichas existentes</p></div><button disabled={busy} aria-label="Cerrar importación" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button></header>
      <div className="grid grid-cols-4 gap-2 border-b px-6 py-3">{['Archivo', 'Columnas', 'Validación', 'Resultado'].map((text, index) => <div key={text} className={`rounded-xl px-2 py-2 text-center text-[11px] font-black ${step === index + 1 ? 'bg-slate-950 text-white' : step > index + 1 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-400'}`}>{index + 1}. {text}</div>)}</div>
      <main className="overflow-y-auto p-6">
        {step === 1 && <div className="grid gap-5 lg:grid-cols-2"><button onClick={() => fileRef.current?.click()} disabled={busy} className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-8"><Upload className="mb-4 h-10 w-10 text-emerald-700"/><b>Subir Excel o CSV</b><span className="mt-2 text-xs text-slate-500">Se validará antes de guardar.</span></button><section className="rounded-3xl border p-6"><h4 className="text-sm font-black">Cómo escribir los datos</h4><div className="mt-4 space-y-3 text-xs text-slate-600"><p><b>RUT:</b> 12345678-5; acepta puntos o sin guion.</p><p><b>Fechas:</b> 31-08-2026, 31/08/2026 o 2026-08-31.</p><p><b>Montos:</b> 850000 o $850.000.</p><p><b>Obra:</b> nombre exacto o “Sin asignar”.</p><p><b>Año 3000:</b> contrato indefinido sin fecha de término.</p><p><b>Causal:</b> 159i2 renuncia; 159i4 plazo; 159i5 término de obra. Los términos futuros no se muestran como salidas efectivas.</p><p><b>Solo nuevos:</b> los RUT existentes se omiten. No se inventan AFP, salud ni banco.</p></div><button onClick={downloadTemplate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><Download className="h-4 w-4"/>Descargar plantilla oficial</button></section><input aria-label="Archivo de trabajadores" ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className="hidden"/></div>}
        {step === 2 && <div className="space-y-5"><div className="rounded-2xl bg-slate-50 p-4"><b>{fileName}</b><p className="text-xs text-slate-500">{rawRows.length} filas detectadas. Revisa la relación de columnas.</p></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Object.keys(FIELDS).map(field => <label key={field} className="text-[10px] font-black uppercase text-slate-600">{label(field)}{REQUIRED.includes(field) && ' *'}<select value={mapping[field] || ''} onChange={e => setMapping(current => ({ ...current, [field]: e.target.value }))} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-xs font-medium normal-case"><option value="">No importar</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div>{missing.length > 0 && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">Falta relacionar: {missing.map(label).join(', ')}.</p>}<footer className="flex justify-between"><button onClick={() => setStep(1)} className="rounded-xl border px-4 py-2 text-xs font-black">Volver</button><button disabled={missing.length > 0} onClick={() => setStep(3)} className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white disabled:opacity-40">Validar datos</button></footer></div>}
        {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[['Nuevos', totals.created], ['Errores', totals.errors], ['Omitidos', totals.skipped], ['Importables', importable]].map(([text, value]) => <div key={text} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-500">{text}</p><p className="text-xl font-black">{value}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><b className="text-xs">RUT ya registrado</b><p className="text-[11px] text-slate-500">Duplicados dentro de {companyName}.</p></div><span className="text-xs font-bold text-emerald-800">Siempre omitir existentes · Solo crear nuevos</span></div><div className="max-h-[44vh] overflow-auto rounded-2xl border"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-[10px] uppercase"><tr><th className="p-3">Fila</th><th className="p-3">RUT recibido → guardado</th><th className="p-3">Trabajador</th><th className="p-3">Contrato / fechas</th><th className="p-3">Validación</th></tr></thead><tbody className="divide-y">{validated.map(item => <tr key={item.row}><td className="p-3">{item.row}</td><td className="p-3"><span className="text-slate-400">{String(item.values[mapping.rut] || '')}</span><br/><b>{item.data.rut}</b></td><td className="p-3"><b>{item.data.nombre}</b><br/>{item.data.cargo}</td><td className="p-3">{item.existing ? 'Se conserva ficha actual' : <>{item.data.tipo_contrato}<br/>Ingreso: {item.data.fecha_inicio_contrato || 'No informado'}<br/>{workerContractSummary(item.data)}</>}</td><td className="p-3">{item.errors.length ? <span className="text-red-700"><AlertCircle className="mr-1 inline h-3 w-3"/>{item.errors.join(' · ')}</span> : item.warnings.length ? <span className="text-amber-700">{item.warnings.join(' · ')}</span> : <span className="text-emerald-700"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Válido</span>}</td></tr>)}</tbody></table></div><footer className="flex flex-wrap justify-between gap-2"><div className="flex gap-2"><button disabled={busy} onClick={() => setStep(2)} className="rounded-xl border px-4 py-2 text-xs font-black">Volver</button>{totals.errors > 0 && <button onClick={downloadErrors} className="flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-800"><Download className="h-4 w-4"/>Descargar errores</button>}</div><button disabled={!importable || busy} onClick={executeImport} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Crear {importable} trabajadores nuevos</button></footer></div>}
        {step === 4 && <div className="mx-auto max-w-xl py-10 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600"/><h4 className="mt-4 text-xl font-black">Importación finalizada</h4><p className="mt-2 text-sm text-slate-600">{message?.created || 0} creados · {message?.skipped || 0} existentes omitidos · {(message?.invalid || 0) + (message?.failures?.length || 0)} filas con error. Ninguna ficha existente fue actualizada.</p>{message?.failures?.length > 0 && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-left text-xs text-red-800">{message.failures.map(item => <p key={item}>{item}</p>)}</div>}<button onClick={onClose} className="mt-6 rounded-xl bg-slate-950 px-6 py-3 text-xs font-black text-white">Cerrar</button></div>}
        {message?.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">{message.error}</p>}
      </main>
      {busy && step !== 3 && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-8 w-8 animate-spin text-emerald-700"/></div>}
    </div>
  </div>;
}
