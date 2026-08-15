import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

const REQUIRED = ['rut', 'nombre', 'cargo'];
const FIELDS = {
  rut: ['rut', 'run', 'rut trabajador'], nombre: ['nombre', 'nombre completo', 'trabajador'], cargo: ['cargo', 'puesto', 'funcion'],
  fono: ['fono', 'telefono', 'celular'], email: ['email', 'correo', 'correo electronico'], obra_nombre: ['obra', 'obra asignada', 'proyecto', 'faena'],
  fecha_asig: ['fecha asignacion', 'fecha de asignacion'], centro_trabajo: ['centro de trabajo', 'centro trabajo'], area: ['area', 'departamento'],
  sueldo_base: ['sueldo base', 'sueldo', 'remuneracion base'], tipo_contrato: ['tipo contrato', 'tipo de contrato', 'contrato'],
  fecha_inicio_contrato: ['fecha ingreso', 'fecha de ingreso', 'inicio contrato', 'fecha inicio contrato'],
  fecha_vencimiento_contrato: ['fecha termino', 'fecha de termino', 'vencimiento contrato', 'fecha vencimiento contrato'],
  banco: ['banco'], tipo_cuenta: ['tipo cuenta', 'tipo de cuenta'], numero_cuenta: ['numero cuenta', 'n cuenta', 'cuenta bancaria'],
  afp: ['afp'], prevision_salud: ['salud', 'prevision salud', 'prevision de salud'], colacion: ['colacion'], movilizacion: ['movilizacion']
};
const label = key => key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
const cleanText = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const compactRut = value => String(value ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
const normalizeRut = value => { const rut = compactRut(value); return rut.length >= 2 ? `${rut.slice(0, -1)}-${rut.slice(-1)}` : rut; };
const validateRut = value => {
  const rut = compactRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;
  const body = rut.slice(0, -1); let total = 0; let factor = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) { total += Number(body[i]) * factor; factor = factor === 7 ? 2 : factor + 1; }
  const result = 11 - total % 11; const dv = result === 11 ? '0' : result === 10 ? 'K' : String(result);
  return dv === rut.slice(-1);
};
const parseAmount = value => {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value);
  const parsed = Number(String(value).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
};
const parseDate = value => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  let match = String(value).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = String(value).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
};
const normalizePhone = value => { const digits = String(value || '').replace(/\D/g, ''); return !digits ? '' : digits.startsWith('56') ? `+${digits}` : digits.length === 9 ? `+56${digits}` : `+${digits}`; };
const findField = header => Object.entries(FIELDS).find(([, aliases]) => aliases.includes(cleanText(header)))?.[0];

export default function WorkerBulkImport({ companyName, personal = [], obras = [], onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [duplicateMode, setDuplicateMode] = useState('update');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const obraMap = useMemo(() => new Map(obras.map(item => [cleanText(item.nombre), item.nombre])), [obras]);
  const workersByRut = useMemo(() => new Map(personal.filter(item => item.rut && (!item.empresa || item.empresa === companyName)).map(item => [compactRut(item.rut), item])), [personal, companyName]);

  const downloadTemplate = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const example = [{ RUT: '12345678-5', 'Nombre completo': 'María González Soto', Cargo: 'Jornal', Teléfono: '+56912345678', Correo: 'maria@empresa.cl', 'Obra asignada': 'Sin asignar', 'Fecha de asignación': '', 'Centro de trabajo': 'Oficina Central', Área: 'Operaciones', 'Sueldo base': 650000, 'Tipo de contrato': 'Indefinido', 'Fecha de ingreso': '13-08-2026', 'Fecha de término': '', Banco: 'BancoEstado', 'Tipo de cuenta': 'CuentaRUT', 'Número de cuenta': '', AFP: 'Habitat', Salud: 'FONASA', Colación: 0, Movilización: 0 }];
    const instructions = [
      ['IMPORTACIÓN MASIVA DE TRABAJADORES — OBRAXIS'], ['Complete la hoja Trabajadores y reemplace o elimine la fila de ejemplo.'], [],
      ['Campo', 'Obligatorio', 'Formato recomendado', 'También se acepta / regla'],
      ['RUT', 'Sí', '12345678-5', '12.345.678-5 o 123456785. Se valida el dígito verificador y se guarda sin puntos, con guion.'],
      ['Nombre completo', 'Sí', 'María González Soto', 'Se limpian espacios; se conservan tildes.'], ['Cargo', 'Sí', 'Jornal', 'Texto libre.'],
      ['Teléfono', 'No', '+56912345678', '912345678 o +56 9 1234 5678.'], ['Correo', 'No', 'persona@empresa.cl', 'Se valida y guarda en minúsculas.'],
      ['Obra asignada', 'No', 'Nombre exacto', 'También “Sin asignar”. Una obra inexistente genera error.'],
      ['Fechas', 'No', '31-08-2026', 'DD-MM-AAAA, DD/MM/AAAA, AAAA-MM-DD o fecha real de Excel.'],
      ['Montos', 'No', '850000', '$850.000 o 850000.'], [],
      ['Duplicados', '', '', 'Se identifican por RUT dentro de la empresa activa. Nunca se eliminan trabajadores.']
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
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = book.SheetNames.includes('Trabajadores') ? 'Trabajadores' : book.SheetNames[0];
      const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: '', raw: true });
      const nextHeaders = (matrix[0] || []).map(String).map(item => item.trim()).filter(Boolean);
      if (!nextHeaders.length) throw new Error('No se encontraron encabezados en el archivo.');
      const nextMapping = {};
      nextHeaders.forEach(header => { const field = findField(header); if (field && !nextMapping[field]) nextMapping[field] = header; });
      setFileName(file.name); setHeaders(nextHeaders); setMapping(nextMapping);
      setRawRows(matrix.slice(1).filter(row => row.some(value => String(value).trim())).map((values, index) => ({ row: index + 2, values: Object.fromEntries(nextHeaders.map((header, col) => [header, values[col] ?? ''])) })));
      setStep(2);
    } catch (error) { setMessage({ error: error.message }); }
    finally { setBusy(false); event.target.value = ''; }
  };

  const validated = useMemo(() => {
    const seen = new Set();
    return rawRows.map(source => {
      const get = field => mapping[field] ? source.values[mapping[field]] : '';
      const rut = normalizeRut(get('rut')); const compact = compactRut(rut); const errors = []; const warnings = [];
      if (!String(get('nombre')).trim()) errors.push('Falta nombre'); if (!String(get('cargo')).trim()) errors.push('Falta cargo');
      if (!rut) errors.push('Falta RUT'); else if (!validateRut(rut)) errors.push('RUT inválido');
      if (compact && seen.has(compact)) errors.push('RUT repetido en el archivo'); seen.add(compact);
      const obraInput = String(get('obra_nombre') || '').trim(); const unassigned = !obraInput || ['sin asignar', 'no asignado', 'ninguna'].includes(cleanText(obraInput)); const obra = unassigned ? '' : obraMap.get(cleanText(obraInput));
      if (!unassigned && !obra) errors.push(`Obra “${obraInput}” inexistente`);
      const email = String(get('email') || '').trim().toLowerCase(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Correo inválido');
      const dates = {}; [['fecha_asig', 'asignación'], ['fecha_inicio_contrato', 'ingreso'], ['fecha_vencimiento_contrato', 'término']].forEach(([field, text]) => { dates[field] = get(field) ? parseDate(get(field)) : ''; if (get(field) && !dates[field]) errors.push(`Fecha de ${text} inválida`); });
      const salary = parseAmount(get('sueldo_base')); if (Number.isNaN(salary)) errors.push('Sueldo inválido');
      const existing = workersByRut.get(compact); if (existing) warnings.push(duplicateMode === 'update' ? 'Actualizará ficha existente' : 'Será omitido');
      const data = {
        nombre: String(get('nombre') || '').trim().replace(/\s+/g, ' '), rut, cargo: String(get('cargo') || '').trim(), fono: normalizePhone(get('fono')), email,
        obra_nombre: obra || '', fecha_asig: dates.fecha_asig || null, centro_trabajo: String(get('centro_trabajo') || '').trim(), area: String(get('area') || '').trim(), sueldo_base: salary || 0,
        tipo_contrato: String(get('tipo_contrato') || 'Indefinido').trim(), fecha_inicio_contrato: dates.fecha_inicio_contrato || null, fecha_vencimiento_contrato: dates.fecha_vencimiento_contrato || null,
        banco: String(get('banco') || '').trim(), tipo_cuenta: String(get('tipo_cuenta') || '').trim(), numero_cuenta: String(get('numero_cuenta') || '').trim(), afp: String(get('afp') || '').trim(),
        prevision_salud: String(get('prevision_salud') || '').trim(), colacion: parseAmount(get('colacion')) || 0, movilizacion: parseAmount(get('movilizacion')) || 0, empresa: companyName
      };
      const updateData = { nombre: data.nombre, rut: data.rut, cargo: data.cargo, empresa: companyName };
      Object.keys(FIELDS).filter(field => !REQUIRED.includes(field) && mapping[field] && String(get(field)).trim() !== '').forEach(field => { updateData[field] = data[field]; });
      return { ...source, errors, warnings, existing, data, updateData };
    });
  }, [rawRows, mapping, obraMap, workersByRut, duplicateMode, companyName]);
  const totals = useMemo(() => ({ errors: validated.filter(item => item.errors.length).length, updates: validated.filter(item => !item.errors.length && item.existing && duplicateMode === 'update').length, created: validated.filter(item => !item.errors.length && !item.existing).length, skipped: validated.filter(item => item.existing && duplicateMode === 'skip').length }), [validated, duplicateMode]);
  const importable = totals.created + totals.updates;

  const downloadErrors = async () => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const rows = validated.filter(item => item.errors.length).map(item => ({ Fila: item.row, RUT: item.data.rut, Nombre: item.data.nombre, Cargo: item.data.cargo, Errores: item.errors.join(' | ') }));
    const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 32 }, { wch: 25 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(book, sheet, 'Errores'); XLSX.writeFile(book, `Errores_Importacion_RRHH_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const executeImport = async () => {
    setBusy(true); const failures = []; let created = 0; let updated = 0;
    for (const item of validated) {
      if (item.errors.length || (item.existing && duplicateMode === 'skip')) continue;
      const full = item.existing ? item.updateData : item.data;
      try {
        const response = item.existing ? await supabase.from('maestro_personal').update(full).eq('id', item.existing.id).select() : await supabase.from('maestro_personal').insert([full]).select();
        if (response.error) throw response.error;
        if (item.existing) updated += 1; else created += 1;
      } catch (error) { failures.push(`Fila ${item.row}: ${error.message}`); }
    }
    await onImported?.(); setBusy(false); setMessage({ created, updated, failures }); setStep(4);
  };

  const missing = REQUIRED.filter(field => !mapping[field]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-6 py-4"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><FileSpreadsheet className="h-5 w-5 text-emerald-700"/>Importación masiva de trabajadores</h3><p className="mt-1 text-xs text-slate-500">{companyName} · RUT almacenado sin puntos y con guion</p></div><button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button></header>
      <div className="grid grid-cols-4 gap-2 border-b px-6 py-3">{['Archivo', 'Columnas', 'Validación', 'Resultado'].map((text, index) => <div key={text} className={`rounded-xl px-2 py-2 text-center text-[11px] font-black ${step === index + 1 ? 'bg-slate-950 text-white' : step > index + 1 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-400'}`}>{index + 1}. {text}</div>)}</div>
      <main className="overflow-y-auto p-6">
        {step === 1 && <div className="grid gap-5 lg:grid-cols-2"><button onClick={() => fileRef.current?.click()} className="flex min-h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-8"><Upload className="mb-4 h-10 w-10 text-emerald-700"/><b>Subir Excel o CSV</b><span className="mt-2 text-xs text-slate-500">Se validará antes de guardar.</span></button><section className="rounded-3xl border p-6"><h4 className="text-sm font-black">Cómo escribir los datos</h4><div className="mt-4 space-y-3 text-xs text-slate-600"><p><b>RUT:</b> 12345678-5; acepta puntos o sin guion.</p><p><b>Fechas:</b> 31-08-2026, 31/08/2026 o 2026-08-31.</p><p><b>Montos:</b> 850000 o $850.000.</p><p><b>Obra:</b> nombre exacto o “Sin asignar”.</p></div><button onClick={downloadTemplate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><Download className="h-4 w-4"/>Descargar plantilla oficial</button></section><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={readFile} className="hidden"/></div>}
        {step === 2 && <div className="space-y-5"><div className="rounded-2xl bg-slate-50 p-4"><b>{fileName}</b><p className="text-xs text-slate-500">{rawRows.length} filas detectadas. Revisa la relación de columnas.</p></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Object.keys(FIELDS).map(field => <label key={field} className="text-[10px] font-black uppercase text-slate-600">{label(field)}{REQUIRED.includes(field) && ' *'}<select value={mapping[field] || ''} onChange={e => setMapping(current => ({ ...current, [field]: e.target.value }))} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-xs font-medium normal-case"><option value="">No importar</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div>{missing.length > 0 && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">Falta relacionar: {missing.map(label).join(', ')}.</p>}<footer className="flex justify-between"><button onClick={() => setStep(1)} className="rounded-xl border px-4 py-2 text-xs font-black">Volver</button><button disabled={missing.length > 0} onClick={() => setStep(3)} className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white disabled:opacity-40">Validar datos</button></footer></div>}
        {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[['Nuevos', totals.created], ['Actualizaciones', totals.updates], ['Errores', totals.errors], ['Omitidos', totals.skipped], ['Importables', importable]].map(([text, value]) => <div key={text} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-500">{text}</p><p className="text-xl font-black">{value}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><b className="text-xs">RUT ya registrado</b><p className="text-[11px] text-slate-500">Duplicados dentro de {companyName}.</p></div><select value={duplicateMode} onChange={e => setDuplicateMode(e.target.value)} className="rounded-xl border px-3 py-2 text-xs font-bold"><option value="update">Actualizar solo campos informados</option><option value="skip">Omitir trabajador existente</option></select></div><div className="max-h-[44vh] overflow-auto rounded-2xl border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-[10px] uppercase"><tr><th className="p-3">Fila</th><th className="p-3">RUT recibido → guardado</th><th className="p-3">Trabajador</th><th className="p-3">Obra</th><th className="p-3">Validación</th></tr></thead><tbody className="divide-y">{validated.map(item => <tr key={item.row}><td className="p-3">{item.row}</td><td className="p-3"><span className="text-slate-400">{String(item.values[mapping.rut] || '')}</span><br/><b>{item.data.rut}</b></td><td className="p-3"><b>{item.data.nombre}</b><br/>{item.data.cargo}</td><td className="p-3">{item.data.obra_nombre || 'Sin asignar'}</td><td className="p-3">{item.errors.length ? <span className="text-red-700"><AlertCircle className="mr-1 inline h-3 w-3"/>{item.errors.join(' · ')}</span> : item.warnings.length ? <span className="text-amber-700">{item.warnings.join(' · ')}</span> : <span className="text-emerald-700"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Válido</span>}</td></tr>)}</tbody></table></div><footer className="flex flex-wrap justify-between gap-2"><div className="flex gap-2"><button onClick={() => setStep(2)} className="rounded-xl border px-4 py-2 text-xs font-black">Volver</button>{totals.errors > 0 && <button onClick={downloadErrors} className="flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-800"><Download className="h-4 w-4"/>Descargar errores</button>}</div><button disabled={!importable || busy} onClick={executeImport} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin"/>}Importar {importable} trabajadores</button></footer></div>}
        {step === 4 && <div className="mx-auto max-w-xl py-10 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600"/><h4 className="mt-4 text-xl font-black">Importación finalizada</h4><p className="mt-2 text-sm text-slate-600">{message?.created || 0} creados y {message?.updated || 0} actualizados.</p>{message?.failures?.length > 0 && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-left text-xs text-red-800">{message.failures.map(item => <p key={item}>{item}</p>)}</div>}<button onClick={onClose} className="mt-6 rounded-xl bg-slate-950 px-6 py-3 text-xs font-black text-white">Cerrar</button></div>}
        {message?.error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">{message.error}</p>}
      </main>
      {busy && step !== 3 && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-8 w-8 animate-spin text-emerald-700"/></div>}
    </div>
  </div>;
}
