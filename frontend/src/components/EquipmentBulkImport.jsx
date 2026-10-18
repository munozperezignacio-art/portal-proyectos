import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { equipmentImportPayload, parseEquipmentSheet } from '../utils/equipmentImport';

export default function EquipmentBulkImport({ company, categories=[], onClose, onImported }) {
  const [categoryId,setCategoryId]=useState('');
  const [matrix, setMatrix] = useState(null); const [rows, setRows] = useState([]);
  const [book, setBook] = useState(null); const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [done, setDone] = useState(false);
  const readSheet = async (workbook, name) => {
    const { loadSpreadsheetEngine } = await import('../services/documentEngines');
    const XLSX = await loadSpreadsheetEngine();
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true });
    setSheet(name); const parsed = parseEquipmentSheet(data); setMatrix(data); setRows(parsed); setDone(false);
  };
  const readFile = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage(''); setRows([]); setMatrix(null); setBook(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo debe pesar menos de 10 MB.');
      const { loadSpreadsheetEngine } = await import('../services/documentEngines');
      const XLSX = await loadSpreadsheetEngine(); const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setBook(workbook); await readSheet(workbook, workbook.SheetNames[0]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); event.target.value = ''; }
  };
  const importRows = async () => {
    if (!matrix || !company || busy || done) return;
    setBusy(true); setMessage('');
    try {
      const existing = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('inventario_maquinaria').select('patente').eq('empresa', company).order('id').range(offset, offset + 999);
        if (error) throw error;
        existing.push(...data); if (data.length < 1000) break;
      }
      const checked = parseEquipmentSheet(matrix, existing); setRows(checked);
      if (checked.some(row => row.errors.length)) throw new Error('Corrige las filas con errores antes de importar.');
      const fresh = checked.filter(row => !row.exists);
      if (!fresh.length) throw new Error('Todos los códigos ya existen en esta empresa. No se modificó ningún equipo.');
      const { error } = await supabase.from('inventario_maquinaria').insert(fresh.map(row => ({...equipmentImportPayload(row, company),categoria_id:categoryId?Number(categoryId):null})));
      if (error) throw error;
      setDone(true); setMessage(`${fresh.length} equipos creados. ${checked.length - fresh.length} existentes omitidos.`);
      await onImported();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Importar nómina de equipos" className="bg-white rounded-2xl p-6 w-full max-w-5xl max-h-[92vh] overflow-auto space-y-4">
    <header className="flex justify-between gap-4"><h3 className="font-black text-xl">Subir nómina de equipos</h3><button disabled={busy} onClick={onClose} className="border rounded-lg px-3 py-1">Cerrar</button></header>
    <p className="text-sm">Columnas: Código · Nombre de equipo · Marca · Modelo · Costo Día (22 días). También se acepta «Maquinaria».</p>
    <p className="text-sm text-slate-600">Costo diario en CLP, sin dividir por 22. Los valores numéricos de Excel con decimales se redondean al peso más cercano. Ejemplo: 510746,67 se guarda como $510.747. En texto, use pesos enteros: 510,747 o 510.747 = $510.747. Marca y modelo se conservarán juntos. Se crearán como equipos propios, sin obra asignada. Los códigos existentes se omiten.</p>
    <input aria-label="Archivo de equipos" disabled={busy || done} type="file" accept=".xlsx,.xls,.csv" onChange={readFile}/>
    <label className="block text-sm font-bold">Categoría para los equipos nuevos (opcional)<select aria-label="Categoría de equipos importados" value={categoryId} disabled={busy||done} onChange={event=>setCategoryId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"><option value="">Sin categoría</option>{categories.map(category=><option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
    {book && <label className="block text-sm">Hoja <select disabled={busy || done} value={sheet} onChange={async event => { setRows([]); setMatrix(null); setMessage(''); try { await readSheet(book, event.target.value); } catch (error) { setMessage(error.message); } }} className="border rounded p-2 ml-2">{book.SheetNames.map(name => <option key={name}>{name}</option>)}</select></label>}
    {!!rows.length && <div className="overflow-auto max-h-[45vh]"><table className="w-full text-sm text-left"><thead><tr>{['Fila', 'Código', 'Nombre de equipo', 'Marca', 'Modelo', 'Costo diario CLP', 'Estado'].map(name => <th key={name} className="p-2 bg-slate-100">{name}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.row} className="border-b"><td className="p-2">{row.row}</td><td>{row.code}</td><td>{row.name}</td><td>{row.brand}</td><td>{row.model}</td><td>{Number.isFinite(row.amount) ? row.amount.toLocaleString('es-CL') : 'Inválido'}</td><td className={row.errors.length ? 'text-red-700' : ''}>{row.errors.join(' · ') || (row.exists ? 'Existente: omitir' : 'Nuevo')}</td></tr>)}</tbody></table></div>}
    {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    <button disabled={busy || done || !rows.length || rows.some(row => row.errors.length)} onClick={importRows} className="bg-primary text-white rounded-xl px-5 py-3 font-bold disabled:opacity-40">{busy ? 'Procesando…' : done ? 'Importación finalizada' : `Importar nómina (${rows.length} filas)`}</button>
  </section></div>;
}
