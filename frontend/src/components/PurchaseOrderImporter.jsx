import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import {FileSpreadsheet, X, Upload} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {COST_TYPES,ocKey,parsePurchaseOrders,purchaseOrderPayload} from '../utils/purchaseOrderImport';
const money = n => '$'+Number(n).toLocaleString('es-CL');
export default function PurchaseOrderImporter({company,work,onImported}) {
  const [open,setOpen]=useState(false), [rows,setRows]=useState([]), [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [confirmed,setConfirmed]=useState(false);
  const existingOrders=async()=>{
    const all=[];
    for(let start=0;;start+=1000){
      const {data,error}=await supabase.from('costos_reales_obra').select('id,num_oc,obra_nombre').eq('empresa',company).not('num_oc','is',null).order('id').range(start,start+999);
      if(error)throw error;
      all.push(...data); if(data.length<1000)return all;
    }
  };
  const read=async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true);setMessage('');setRows([]);setConfirmed(false);
    try{
      if(file.size>10*1024*1024)throw new Error('El archivo debe pesar menos de 10 MB.');
      const {loadSpreadsheetEngine}=await import('../services/documentEngines');
      const XLSX=await loadSpreadsheetEngine();
      const book=XLSX.read(await file.arrayBuffer(),{type:'array'});
      const sheets=book.SheetNames.filter(name=>/rdenes.*compra/i.test(name));
      if(sheets.length!==1)throw new Error('Se requiere una única hoja «Órdenes de Compra».');
      const parsed=parsePurchaseOrders(XLSX.utils.sheet_to_json(book.Sheets[sheets[0]],{header:1,defval:'',raw:true}));
      const existing=await existingOrders();
      setRows(parsed.map(row=>({...row,type:'Gastos Generales / Varios',state:'pendiente',selected:false,result:existing.some(c=>ocKey(c.num_oc)===ocKey(row.num_oc))?'Ya existe (no se modificará)':''})));
      if(!parsed.length)setMessage('El archivo no contiene órdenes de compra.');
    }catch(error){setMessage(error.message);}finally{setBusy(false);e.target.value='';}
  };
  const change=(index,patch)=>setRows(prev=>prev.map((row,i)=>i===index?{...row,...patch}:row));
  const save=async()=>{
    if(busy||!confirmed)return;
    setBusy(true);setMessage('');let count=0;
    try{
      const existing=await existingOrders();
      for(let i=0;i<rows.length;i++){
        const row=rows[i];if(!row.selected||row.result||row.errors.length)continue;
        if(existing.some(c=>ocKey(c.num_oc)===ocKey(row.num_oc))){change(i,{result:'Ya existe (no se modificará)',selected:false});continue;}
        const {data,error}=await supabase.from('costos_reales_obra').insert(purchaseOrderPayload(row,company,work,row.type,row.state)).select().single();
        if(error){if(error.code==='23505'){change(i,{result:'Ya existe (no se modificará)',selected:false});continue;}throw error;}
        count++;change(i,{result:'Importada',selected:false});onImported(data);
      }
      setMessage(`${count} OC importadas. Cada OC corresponde a un único gasto, sin imputación a partidas.`);
    }catch(error){setMessage(`${count} OC importadas. Se detuvo la carga: ${error.message}. Puedes revisar y volver a intentar: las OC existentes no se duplicarán.`);}finally{setBusy(false);}
  };
  return <>
    <button type="button" className="rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 flex items-center gap-2" onClick={()=>setOpen(true)} disabled={busy}><FileSpreadsheet className="w-3.5 h-3.5"/>Importar OC de iConstruye</button>
    {open&&createPortal(<div className="fixed inset-0 z-[120] bg-slate-950/50 flex items-center justify-center p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-label="Importar órdenes de compra" className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">Importar órdenes de compra</h3><p className="text-xs text-slate-500 mt-1">iConstruye · {work}</p></div><button type="button" aria-label="Cerrar importación" disabled={busy} onClick={()=>setOpen(false)} className="rounded-xl p-2 hover:bg-slate-100"><X className="w-5 h-5"/></button></header>
      <div className="p-5 space-y-4">
      <label className="flex items-center gap-4 cursor-pointer rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-5 py-6 hover:bg-emerald-50"><Upload className="w-6 h-6 text-emerald-800"/><span><strong className="block text-sm text-emerald-950">Seleccionar Excel de órdenes de compra</strong><span className="block mt-1 text-xs text-slate-500">.xlsx o .xls · Hasta 10 MB · Vista previa antes de guardar</span></span><input type="file" aria-label="Excel de órdenes de compra" accept=".xlsx,.xls" onChange={read} disabled={busy} className="sr-only"/></label>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">Un gasto por OC, sin duplicados. El total incluye IVA del 19%; se guardará el costo neto. Los totales con decimales se redondean al peso; el neto se calcula como total / 1,19 y el IVA por diferencia. Podrás agregar la factura al mismo registro después. Las OC existentes se editan en el listado de costos, no en esta importación. Los costos quedan sin imputación hasta que los distribuyas entre partidas.</div>
      {!!rows.length&&<><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-xs"><thead className="bg-slate-100"><tr>{['Importar','OC / Fecha','Concepto / Proveedor','Centro del archivo','Neto','IVA (19%)','Total','Tipo / Estado del costo','Resultado'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-b"><td className="p-3"><input type="checkbox" aria-label={`Importar OC ${row.num_oc}`} checked={row.selected} disabled={busy||!!row.result||!!row.errors.length} onChange={e=>change(i,{selected:e.target.checked})}/></td><td className="p-3 font-bold">{row.num_oc}<small className="block">{row.fecha_costo}</small></td><td className="p-3">{row.nombre}<small className="block text-slate-500">{row.proveedor_nombre}</small></td><td className="p-3">{row.centro}</td><td className="p-3 whitespace-nowrap">{money(row.monto)}</td><td className="p-3 whitespace-nowrap">{money(row.monto_iva)}</td><td className="p-3 whitespace-nowrap">{money(row.monto_total)}</td><td className="p-3 space-y-2"><select aria-label={`Tipo OC ${row.num_oc}`} disabled={busy||!!row.result} value={row.type} onChange={e=>change(i,{type:e.target.value})} className="block w-full rounded border p-2">{COST_TYPES.map(type=><option key={type}>{type}</option>)}</select><select aria-label={`Estado OC ${row.num_oc}`} disabled={busy||!!row.result} value={row.state} onChange={e=>change(i,{state:e.target.value})} className="block w-full rounded border p-2"><option value="pendiente">Incurrido pendiente de confirmar</option><option value="confirmado">Confirmado</option><option value="proyectado">Futuro proyectado</option></select></td><td className="p-3">{row.errors.join(' ')||row.result||'Lista para revisar'}</td></tr>)}</tbody></table></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que las OC seleccionadas corresponden a {work} y que sus montos incluyen IVA del 19%.</label>
      <button type="button" disabled={busy||!confirmed||!rows.some(r=>r.selected&&!r.result&&!r.errors.length)} onClick={save} className="rounded-xl bg-indigo-900 text-white px-4 py-2 font-bold disabled:opacity-40">{busy?'Procesando…':'Importar OC seleccionadas'}</button></>}
      {message&&<p role="status" className="text-sm rounded-xl bg-slate-50 p-3">{message}</p>}
      </div></section></div>,document.body)}
  </>;
}
