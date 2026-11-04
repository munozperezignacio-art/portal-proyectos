import React,{useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {FileSpreadsheet,X} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {COST_TYPES} from '../utils/purchaseOrderImport';
import {parseExpenseReports,suggestedCategory,expenseKey,expensePayload,normalize} from '../utils/expenseReportImport';
import ExpensePartSelection from './ExpensePartSelection';
import {weightedExpenseParts} from '../utils/expenseAllocation';
const money=v=>'$'+Number(v).toLocaleString('es-CL');
export default function ExpenseReportImporter({company,work,parts=[],onImported}){
 const [partIds,setPartIds]=useState([]);
 const [open,setOpen]=useState(false),[files,setFiles]=useState({}),[parsed,setParsed]=useState(null),[dimension,setDimension]=useState('unit'),[source,setSource]=useState(''),[mapping,setMapping]=useState({}),[selected,setSelected]=useState([]),[results,setResults]=useState({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false);
 const saving=useRef(false);
 const available=parsed?.rows||[];
 const options=[...new Map(available.filter(r=>r[dimension]).map(r=>[r[dimension],r[dimension+'Name']||r[dimension]])).entries()];
 const visible=available.filter(r=>source&&r[dimension]===source);
 const categories=[...new Map(visible.map(r=>[r.mapping,r])).values()];
 const ready=r=>!r.errors.length&&!results[r.key]&&COST_TYPES.includes(mapping[r.mapping]);
 const chosen=visible.filter(r=>selected.includes(r.key)&&ready(r));
 const existing=async()=>{const all=[];for(let start=0;;start+=1000){const {data,error}=await supabase.from('costos_reales_obra').select('id,obra_nombre,importacion_clave,importacion_datos,num_factura,proveedor_rut,monto_total').eq('empresa',company).order('id').range(start,start+999);if(error)throw error;all.push(...data);if(data.length<1000)return all;}};
 const collision=(r,list)=>{
  const prior=list.find(c=>c.importacion_clave===r.key);
  if(prior)return Number(prior.importacion_datos?.total_origen)===r.total?`Ya importado en ${prior.obra_nombre}`:'Diferencia con una importación anterior: revisar, no se sobrescribe';
  const doc=normalize(r.doc).replace(/[.\s]/g,''),rut=normalize(r.rut).replace(/[.\s]/g,'');
  if(doc&&rut&&list.some(c=>normalize(c.proveedor_rut).replace(/[.\s]/g,'')===rut&&normalize(c.num_factura||c.importacion_datos?.documento_numero).replace(/[.\s]/g,'')===doc))return 'Documento ya registrado: revisar para evitar duplicarlo';
  return '';
 };
 const read=async()=>{
  if(saving.current)return;saving.current=true;setBusy(true);setMessage('');setParsed(null);setResults({});setSelected([]);setConfirmed(false);setSource('');
  try{
   const {loadSpreadsheetEngine}=await import('../services/documentEngines');const XLSX=await loadSpreadsheetEngine();
   const readSheet=async(file,name)=>{if(!file||file.size>10*1024*1024)throw Error('Selecciona ambos Excel, de hasta 10 MB cada uno.');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});if(!book.Sheets[name])throw Error(`No se encontró la hoja ${name}.`);return XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:true});};
   const [a,b,saved,costs]=await Promise.all([readSheet(files.summary,'Rendiciones'),readSheet(files.expenses,'ReporteGastos'),supabase.from('iconstruye_homologacion_gastos').select('*').eq('empresa',company),existing()]);
   if(saved.error)throw saved.error;
   const p=parseExpenseReports(a,b);p.rows=await Promise.all(p.rows.map(async r=>({...r,key:await expenseKey(r)})));
   const defaults=Object.fromEntries(p.rows.map(r=>[r.mapping,suggestedCategory(r.category,r.subcategory)]));
   setMapping({...defaults,...Object.fromEntries((saved.data||[]).map(r=>[r.clave,r.tipo_costo]))});
   setResults(Object.fromEntries(p.rows.map(r=>[r.key,collision(r,costs)])));setParsed(p);
  }catch(e){setMessage(e.message);}finally{saving.current=false;setBusy(false);}
 };
 const save=async()=>{
  if(saving.current||!confirmed||!chosen.length)return;saving.current=true;setBusy(true);setMessage('');let count=0;
  try{
   const costs=await existing();
   const distribution=weightedExpenseParts(parts,partIds);
   for(const row of chosen){
    const conflict=collision(row,costs);if(conflict){setResults(p=>({...p,[row.key]:conflict}));continue;}
    const payload=expensePayload(row,company,work,mapping[row.mapping],row.key);
    payload.imputaciones=distribution;
    const {data,error}=await supabase.from('costos_reales_obra').insert(payload).select().single();
    if(error){if(error.code==='23505'){setResults(p=>({...p,[row.key]:'Ya importado; no se duplicó'}));continue;}throw error;}
    costs.push(data);count++;setResults(p=>({...p,[row.key]:'Importado'}));onImported(data);
   }
   setMessage(`${count} gastos cargados en ${work}. Neto e IVA separados; sin duplicar el total de las rendiciones.`);
  }catch(e){setMessage(`${count} gastos cargados. Se detuvo la carga: ${e.message}. Revisa antes de reintentar; los importados no se duplicarán.`);}finally{saving.current=false;setBusy(false);setSelected([]);setConfirmed(false);}
 };
 const saveMapping=async()=>{if(busy)return;setBusy(true);try{const entries=categories.filter(r=>COST_TYPES.includes(mapping[r.mapping])).map(r=>({empresa:company,clave:r.mapping,tipo_costo:mapping[r.mapping]}));if(!entries.length)throw Error('Selecciona las equivalencias primero.');const {error}=await supabase.from('iconstruye_homologacion_gastos').upsert(entries,{onConflict:'empresa,clave'});if(error)throw error;setMessage('Homologación guardada para futuras importaciones de la empresa.');}catch(e){setMessage(`No se pudo guardar la homologación: ${e.message}. Solo administradores autorizados pueden modificarla.`);}finally{setBusy(false);}};
 return <><button type="button" onClick={()=>setOpen(true)} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-900"><FileSpreadsheet className="h-4 w-4"/>Importar rendiciones de iConstruye</button>
 {open&&createPortal(<div className="fixed inset-0 z-[120] bg-slate-950/50 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Importar rendiciones" className="w-full max-w-6xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-white shadow-xl">
 <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><h3 className="font-extrabold text-slate-900">Importar rendiciones y gastos</h3><p className="text-xs text-slate-500">Obra destino: {work}</p></div><button type="button" aria-label="Cerrar importación de rendiciones" disabled={busy} onClick={()=>setOpen(false)}><X/></button></header>
 <div className="p-5 space-y-5"><div className="grid gap-3 sm:grid-cols-2">{[['summary','Excel de rendiciones'],['expenses','Excel de gastos asociados']].map(([key,label])=><label key={key} className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4 text-sm font-bold">{label}<input className="mt-3 block w-full text-xs" type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>{setFiles(p=>({...p,[key]:e.target.files?.[0]}));setParsed(null);setConfirmed(false);}}/></label>)}</div>
 <button type="button" disabled={busy||!files.summary||!files.expenses} onClick={read} className="rounded-xl bg-indigo-900 px-4 py-2 font-bold text-white disabled:opacity-40">{busy?'Procesando…':'Cruzar y revisar archivos'}</button>
 {parsed&&<><p className="rounded-xl bg-slate-50 p-3 text-sm">{parsed.reports} rendiciones · {parsed.rows.length} gastos no rechazados · {parsed.rejected} rechazados excluidos · {parsed.unmatched} gastos fuera del resumen excluidos. Un costo por gasto aprobado. Neto = total / 1,19, redondeado al peso; IVA por diferencia.</p>
 {!!parsed.issues.length&&<div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{parsed.issues.map(i=><p key={i}>{i}</p>)}</div>}
 <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Filtrar el origen por<select className="mt-1 block w-full rounded-lg border p-2" value={dimension} disabled={busy} onChange={e=>{setDimension(e.target.value);setSource('');setSelected([]);setConfirmed(false);}}><option value="unit">Obra / unidad de rendición</option><option value="center">Centro de costo</option></select></label><label className="text-sm font-bold">Origen del Excel a cargar<select className="mt-1 block w-full rounded-lg border p-2" value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setSelected([]);setConfirmed(false);}}><option value="">Seleccionar…</option>{options.map(([id,name])=><option key={id} value={id}>{id} · {name}</option>)}</select></label></div>
 {!options.length&&<p className="text-sm text-amber-800">El archivo no contiene códigos de centro de costo para el cruce. Usa Obra / unidad de rendición.</p>}
 {!!visible.length&&<><details className="rounded-xl border p-4" open><summary className="cursor-pointer font-bold">Homologación de categorías</summary><p className="my-2 text-xs text-slate-500">Las equivalencias guardadas se reutilizan por empresa. Arriendos y categorías nuevas requieren selección. Puedes ajustar cada regla antes de importar.</p><div className="grid gap-3 sm:grid-cols-2">{categories.map(r=><label key={r.mapping} className="text-xs">{r.category} / {r.subcategory||'Sin subcategoría'}<select aria-label={`Categoría ${r.category} ${r.subcategory}`} className="mt-1 block w-full rounded-lg border p-2" disabled={busy} value={mapping[r.mapping]||''} onChange={e=>{setMapping(p=>({...p,[r.mapping]:e.target.value}));setConfirmed(false);}}><option value="">Seleccionar categoría Obraxis…</option>{COST_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>)}</div><button type="button" disabled={busy} onClick={saveMapping} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold">Guardar homologación para la empresa</button></details>
 <label className="flex gap-2 text-sm font-bold"><input type="checkbox" disabled={busy} checked={visible.some(ready)&&visible.filter(ready).every(r=>selected.includes(r.key))} onChange={e=>{setSelected(e.target.checked?visible.filter(ready).map(r=>r.key):[]);setConfirmed(false);}}/>Seleccionar todos los gastos válidos del origen elegido</label>
 <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[950px] text-xs"><thead className="bg-slate-100"><tr>{['Cargar','Rendición / Fecha','Concepto / Responsable','Proveedor / Documento','Categoría Obraxis','Neto','IVA','Total','Revisión'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={`${r.key}:${i}`} className="border-t"><td className="p-3"><input aria-label={`Cargar gasto fila ${r.row}`} type="checkbox" disabled={busy||!ready(r)} checked={selected.includes(r.key)} onChange={e=>{setSelected(p=>e.target.checked?[...p,r.key]:p.filter(k=>k!==r.key));setConfirmed(false);}}/></td><td className="p-3">{r.report}<small className="block">{r.date.split('-').reverse().join('-')}</small></td><td className="p-3">{r.name}<small className="block">{r.owner}</small></td><td className="p-3">{r.provider}<small className="block">{r.docType} · {r.doc||'Sin número'}</small></td><td className="p-3">{mapping[r.mapping]||'Por homologar'}</td><td className="p-3 whitespace-nowrap">{money(r.net)}</td><td className="p-3 whitespace-nowrap">{money(r.vat)}</td><td className="p-3 whitespace-nowrap">{money(r.total)}</td><td className="p-3">{r.errors.join(' ')||results[r.key]||(!mapping[r.mapping]?'Falta categoría':'Listo para revisar')}</td></tr>)}</tbody></table></div>
 <p className="text-sm font-bold">Seleccionados: {chosen.length} · Neto {money(chosen.reduce((s,r)=>s+r.net,0))} · IVA {money(chosen.reduce((s,r)=>s+r.vat,0))} · Total {money(chosen.reduce((s,r)=>s+r.total,0))}</p>
 <ExpensePartSelection parts={parts} ids={partIds} disabled={busy} onChange={ids=>{setPartIds(ids);setConfirmed(false);}}/>
 <p className="text-xs text-slate-500">La imputación requiere permisos de Administrador de Empresa o de Contratos. Puedes importar sin seleccionar partidas y distribuir posteriormente.</p>
 <label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que el origen seleccionado corresponde a {work}, las categorías y partidas son correctas y todos los montos incluyen IVA del 19%. Revisé que vouchers y facturas no representen el mismo gasto.</label>
 <button type="button" disabled={busy||!confirmed||!chosen.length} onClick={save} className="rounded-xl bg-emerald-900 px-4 py-3 font-bold text-white disabled:opacity-40">Importar {chosen.length} gastos seleccionados</button></>}
 </>}{message&&<p role="status" className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
 </div></section></div>,document.body)}</>;
}
