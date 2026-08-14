import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const PART_COLUMNS = ['TIPO_FILA','CODIGO','PARTIDA','UNIDAD_PARTIDA','CANTIDAD_OBRA','METODOLOGIA','RENDIMIENTO_DIARIO','DIVISOR_CANTIDAD','DIVISOR_UNIDAD','LEYES_SOCIALES_PCT','HERRAMIENTAS_MENORES_PCT','IMPONDERABLES_PCT'];
const RESOURCE_COLUMNS = ['CODIGO_PARTIDA','RECURSO','TIPO_RECURSO','CATEGORIA_RECURSO','UNIDAD_COSTO','COSTO_UNITARIO','CANTIDAD_CONSUMO','COEFICIENTE','CONSUMO_COMBUSTIBLE_LH'];
const normalize = value => String(value ?? '').trim();
const number = value => { const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; };
const method = value => normalize(value).toLowerCase().includes('costo') ? 'Costo' : 'Precio Unitario';
const headerMap = row => Object.fromEntries(Object.entries(row || {}).map(([key,value]) => [normalize(key).toUpperCase().replace(/\s+/g, '_'), value]));
const isTimeUnit = unit => /(mes|mensual|hr|hora|día|dia|jornada)/i.test(unit);

function calculateCost(part, rows, settings) {
  const pu = part.metodologia === 'Precio Unitario';
  const divisor = Math.max(number(pu ? part.rendimiento_meta : part.divisor_cantidad), 0.000001);
  let material = 0, labor = 0, machinery = 0, tools = 0, others = 0;
  rows.forEach(resource => {
    const qty = number(resource.cantidad_unidad);
    const coefficient = number(resource.rendimiento) || 1;
    const unitCost = number(resource.costo_unitario);
    const unit = resource.unidad;
    const fuel = number(resource.consumo_combustible_lh);
    let subtotal = unitCost * qty;
    if (pu) {
      if (isTimeUnit(unit)) {
        let daily = unitCost;
        if (/mes|mensual/i.test(unit)) daily = unitCost / settings.diasMes;
        if (/hr|hora/i.test(unit)) daily = unitCost * settings.horasDia;
        subtotal = daily * qty / divisor;
      } else subtotal = unitCost * qty * coefficient;
      if (resource.tipo === 'Maquinaria' && fuel) subtotal += fuel * settings.horasDia * settings.precioCombustible * qty / divisor;
    } else {
      if (resource.tipo === 'Maquinaria' && fuel) {
        const hours = /mes|mensual/i.test(unit) ? settings.horasDia * settings.diasMes : /hr|hora/i.test(unit) ? 1 : settings.horasDia;
        subtotal += fuel * hours * settings.precioCombustible * qty;
      }
    }
    if (resource.tipo === 'Material') material += subtotal;
    else if (resource.tipo === 'Mano de Obra') labor += subtotal;
    else if (resource.tipo === 'Maquinaria') machinery += subtotal;
    else if (resource.tipo === 'Herramientas') tools += subtotal;
    else others += subtotal;
  });
  const laborTotal = labor * (1 + (part.leyes_sociales_pct + part.herramientas_menores_pct) / 100);
  const direct = material + laborTotal + machinery + tools + others;
  const total = direct * (1 + part.imponderables_pct / 100);
  const factor = pu ? 1 : 1 / divisor;
  return { costo_unitario: Math.round(total * factor), costo_materiales: Math.round(material * factor), costo_mano_obra: Math.round(laborTotal * factor), costo_maquinaria: Math.round(machinery * factor), costo_herramientas: Math.round(tools * factor), costo_otros: Math.round(others * factor) };
}

export default function BudgetExcelImporter({ presupuestoId, projectCurrency = 'CLP', onImported }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const settings = { diasMes: 22, horasDia: 9, precioCombustible: 1050 };

  const summary = useMemo(() => preview ? { titles: preview.partidas.filter(row => row.es_titulo).length, parts: preview.partidas.filter(row => !row.es_titulo).length, resources: preview.recursos.length, total: preview.partidas.reduce((sum,row) => sum + number(row.cantidad) * number(row.costo_unitario), 0) } : null, [preview]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instructions = XLSX.utils.aoa_to_sheet([
      ['PLANTILLA OFICIAL DE PRESUPUESTOS OBRAXIS'],
      ['Uso','Complete Partidas y Recursos sin cambiar los encabezados. Los títulos no llevan cantidades ni recursos.'],
      ['Precio Unitario','Costo por unidad basado en rendimiento diario y consumos/coeficientes de recursos.'],
      ['Costo','Suma todos los costos cargados y divide por DIVISOR_CANTIDAD, expresado en DIVISOR_UNIDAD.'],
      ['Categoría de recurso','Clasificación analítica editable, por ejemplo: Hormigones, Enfierradura, Instalaciones, Terminaciones o Gastos generales.'],
      ['Moneda',`Todos los costos deben venir en la moneda base del presupuesto: ${projectCurrency}.`]
    ]);
    instructions['!cols'] = [{ wch: 24 }, { wch: 110 }];
    const parts = XLSX.utils.json_to_sheet([
      { TIPO_FILA:'TITULO', CODIGO:'1', PARTIDA:'OBRAS PRELIMINARES' },
      { TIPO_FILA:'PARTIDA', CODIGO:'1.1', PARTIDA:'Instalación de faenas', UNIDAD_PARTIDA:'GL', CANTIDAD_OBRA:1, METODOLOGIA:'Precio Unitario', RENDIMIENTO_DIARIO:1, LEYES_SOCIALES_PCT:35, HERRAMIENTAS_MENORES_PCT:5, IMPONDERABLES_PCT:5 },
      { TIPO_FILA:'PARTIDA', CODIGO:'1.2', PARTIDA:'Administración de instalación temporal', UNIDAD_PARTIDA:'mes', CANTIDAD_OBRA:6, METODOLOGIA:'Costo', DIVISOR_CANTIDAD:6, DIVISOR_UNIDAD:'mes', LEYES_SOCIALES_PCT:35, HERRAMIENTAS_MENORES_PCT:5, IMPONDERABLES_PCT:5 }
    ], { header: PART_COLUMNS });
    const resources = XLSX.utils.json_to_sheet([
      { CODIGO_PARTIDA:'1.1', RECURSO:'Cuadrilla instalación', TIPO_RECURSO:'Mano de Obra', CATEGORIA_RECURSO:'Instalación de faenas', UNIDAD_COSTO:'día', COSTO_UNITARIO:180000, CANTIDAD_CONSUMO:1, COEFICIENTE:1 },
      { CODIGO_PARTIDA:'1.2', RECURSO:'Arriendo oficina de obra', TIPO_RECURSO:'Otros', CATEGORIA_RECURSO:'Gastos generales', UNIDAD_COSTO:'mes', COSTO_UNITARIO:650000, CANTIDAD_CONSUMO:6, COEFICIENTE:1 }
    ], { header: RESOURCE_COLUMNS });
    parts['!cols'] = PART_COLUMNS.map((key,index) => ({ wch: index === 2 ? 44 : 20 }));
    resources['!cols'] = RESOURCE_COLUMNS.map((key,index) => ({ wch: index === 1 ? 38 : 23 }));
    parts['!autofilter'] = { ref: parts['!ref'] }; resources['!autofilter'] = { ref: resources['!ref'] };
    XLSX.utils.book_append_sheet(wb, instructions, 'Instrucciones'); XLSX.utils.book_append_sheet(wb, parts, 'Partidas'); XLSX.utils.book_append_sheet(wb, resources, 'Recursos');
    XLSX.writeFile(wb, 'Plantilla_Oficial_Presupuesto_Obraxis.xlsx');
  };

  const readFile = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setErrors([]); setPreview(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
      if (!wb.Sheets.Partidas || !wb.Sheets.Recursos) throw new Error('El archivo debe contener las hojas “Partidas” y “Recursos”.');
      const rawParts = XLSX.utils.sheet_to_json(wb.Sheets.Partidas, { defval:'' }).map(headerMap);
      const rawResources = XLSX.utils.sheet_to_json(wb.Sheets.Recursos, { defval:'' }).map(headerMap);
      const validation = [];
      const codes = new Set();
      const partidas = rawParts.filter(row => normalize(row.CODIGO) || normalize(row.PARTIDA)).map((row,index) => {
        const code = normalize(row.CODIGO); const name = normalize(row.PARTIDA); const title = normalize(row.TIPO_FILA).toUpperCase() === 'TITULO';
        if (!code || !name) validation.push(`Partidas fila ${index + 2}: código y partida son obligatorios.`);
        if (codes.has(code)) validation.push(`Código repetido: ${code}.`); codes.add(code);
        const methodology = title ? 'Precio Unitario' : method(row.METODOLOGIA);
        const part = { codigo:code, partida:name, es_titulo:title, unidad:title?'TITULO':normalize(row.UNIDAD_PARTIDA)||'un', cantidad:title?0:number(row.CANTIDAD_OBRA), tipo_metodologia:methodology, rendimiento_meta:title?0:number(row.RENDIMIENTO_DIARIO), divisor_cantidad:title?0:number(row.DIVISOR_CANTIDAD), divisor_unidad:title?'':normalize(row.DIVISOR_UNIDAD), leyes_sociales_pct:number(row.LEYES_SOCIALES_PCT), herramientas_menores_pct:number(row.HERRAMIENTAS_MENORES_PCT), imponderables_pct:number(row.IMPONDERABLES_PCT), dias_habiles_mes:22, horas_jornada:9, precio_combustible:1050 };
        if (!title && part.cantidad <= 0) validation.push(`${code}: CANTIDAD_OBRA debe ser mayor que 0.`);
        if (!title && methodology === 'Precio Unitario' && part.rendimiento_meta <= 0) validation.push(`${code}: Precio Unitario requiere RENDIMIENTO_DIARIO.`);
        if (!title && methodology === 'Costo' && (part.divisor_cantidad <= 0 || !part.divisor_unidad)) validation.push(`${code}: Costo requiere DIVISOR_CANTIDAD y DIVISOR_UNIDAD.`);
        return part;
      });
      const recursos = rawResources.filter(row => normalize(row.CODIGO_PARTIDA) || normalize(row.RECURSO)).map((row,index) => {
        const code = normalize(row.CODIGO_PARTIDA); const name = normalize(row.RECURSO); if (!codes.has(code)) validation.push(`Recursos fila ${index + 2}: la partida ${code || '(vacía)'} no existe.`); if (!name) validation.push(`Recursos fila ${index + 2}: falta RECURSO.`);
        return { codigo_partida:code, recurso:name, tipo:normalize(row.TIPO_RECURSO)||'Otros', categoria:normalize(row.CATEGORIA_RECURSO)||'Sin categoría', unidad:normalize(row.UNIDAD_COSTO)||'un', costo_unitario:number(row.COSTO_UNITARIO), cantidad_unidad:number(row.CANTIDAD_CONSUMO), rendimiento:number(row.COEFICIENTE)||1, consumo_combustible_lh:number(row.CONSUMO_COMBUSTIBLE_LH) };
      });
      partidas.forEach(part => Object.assign(part, calculateCost(part, recursos.filter(row => row.codigo_partida === part.codigo), settings)));
      setErrors(validation); setPreview({ partidas, recursos, fileName:file.name });
    } catch (error) { setErrors([error.message]); }
    event.target.value = '';
  };

  const importBudget = async () => {
    if (!preview || errors.length || !presupuestoId) return; setBusy(true);
    const { data, error } = await supabase.rpc('importar_presupuesto_excel_v2', { p_presupuesto_id:Number(presupuestoId), p_partidas:preview.partidas, p_recursos:preview.recursos, p_moneda_base:projectCurrency });
    setBusy(false);
    if (error) { setErrors([error.message]); return; }
    setPreview(null); await onImported?.(data);
  };

  return <section className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-3"><span className="rounded-2xl bg-emerald-700 p-3 text-white"><FileSpreadsheet className="h-5 w-5"/></span><div><h4 className="text-sm font-black text-slate-900">Importar presupuesto desde Excel</h4><p className="mt-1 text-xs text-slate-600">Carga títulos, partidas y recursos mediante una tabla validada y compatible con Presupuesto/Planificación de Obras.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-black text-emerald-800"><Download className="h-4 w-4"/>Descargar plantilla</button><button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white"><Upload className="h-4 w-4"/>Subir Excel</button><input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={readFile} className="hidden"/></div></div>
    {errors.length > 0 && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"><p className="font-black"><AlertTriangle className="mr-1 inline h-4 w-4"/>Corrige antes de importar</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.slice(0,20).map((error,index)=><li key={index}>{error}</li>)}</ul></div>}
    {preview && <div className="mt-4 rounded-2xl border bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-700"/>{preview.fileName}</p><p className="mt-1 text-[10px] text-slate-500">{summary.titles} títulos · {summary.parts} partidas · {summary.resources} recursos · Total {new Intl.NumberFormat('es-CL',{style:'currency',currency:projectCurrency,maximumFractionDigits:0}).format(summary.total)}</p></div><button type="button" disabled={busy || errors.length > 0} onClick={importBudget} className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy?'Importando…':'Confirmar importación'}</button></div></div>}
  </section>;
}
