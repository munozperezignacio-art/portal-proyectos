import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { readEquipmentRecords, equipmentRecordPdf, buildEquipmentRecordDownload, recordKey } from '../utils/equipmentRecordExports';

export default function EquipmentRecordHistory({company,equipment,workName,companyBranding,canDownload,canReadChecklists=false,canDownloadChecklists=false}) {
  const [records,setRecords]=useState([]),[selected,setSelected]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[filter,setFilter]=useState('Todos');
  useEffect(()=>{
    let active=true;setRecords([]);setSelected([]);setError('');setLoading(true);
    readEquipmentRecords(supabase,{company,equipmentId:equipment.id,workName,canReadChecklists}).then(rows=>{if(active)setRecords(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[company,equipment.id,workName,canReadChecklists]);
  const permitted=record=>record.kind==='Checklist'?canDownloadChecklists:canDownload;
  const visible=records.filter(record=>filter==='Todos'||record.kind===filter);
  const available=visible.filter(permitted);
  async function download(rows){
    if(busy||!rows.length||rows.some(r=>!permitted(r)))return;
    setBusy(true);setError('');
    try{
      const options={company,equipment,workName,companyBranding};
      const file=await buildEquipmentRecordDownload(rows,options,record=>equipmentRecordPdf(supabase,record,options));
      const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError(e.message||'No se pudo completar la descarga.');}finally{setBusy(false);}
  }
  return <section className="space-y-3" aria-label="Reportes, checklist y mantenciones">
    <div className="flex flex-wrap items-center gap-2">{['Todos','Reporte','Checklist','Mantención'].filter(k=>k!=='Checklist'||canReadChecklists).map(k=><button type="button" key={k} onClick={()=>{setFilter(k);setSelected([]);}} className={`rounded-xl px-3 py-2 text-xs font-bold ${filter===k?'bg-blue-900 text-white':'border border-slate-200 bg-white text-slate-700'}`}>{k==='Reporte'?'Reportes':k==='Mantención'?'Mantenciones':k}</button>)}</div>
    {!!available.length&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={busy} checked={available.length>0&&available.every(r=>selected.includes(recordKey(r)))} onChange={e=>setSelected(e.target.checked?available.slice(0,100).map(recordKey):[])}/>Seleccionar visibles (máx. 100)</label><button type="button" disabled={busy||!selected.length} onClick={()=>download(visible.filter(r=>selected.includes(recordKey(r))))} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-900 px-3 text-xs font-bold text-white disabled:opacity-40"><Download className="h-4 w-4"/>{busy?'Preparando…':`Descargar selección (${selected.length})`}</button></div>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {loading?<p role="status" className="p-4 text-sm text-slate-500">Cargando registros del equipo…</p>:!visible.length?<p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">No hay registros de este tipo para este equipo y obra.</p>:visible.map(record=><div key={recordKey(record)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">{permitted(record)&&<input type="checkbox" disabled={busy} aria-label={`Seleccionar ${record.kind} ${record.id}`} checked={selected.includes(recordKey(record))} onChange={e=>setSelected(current=>e.target.checked?[...current,recordKey(record)]:current.filter(k=>k!==recordKey(record)))}/>}<div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-xs font-black text-blue-950"><FileText className="h-4 w-4"/>{record.kind} #{record.id}</p><p className="mt-1 text-xs text-slate-500">{record.date} · {record.obra_nombre||record.proyecto_nombre||'Sin obra'}</p><p className="mt-2 break-words text-xs text-slate-700">{record.observaciones||record.descripcion||record.prevencion_formularios?.titulo||record.operador||''}</p></div>{permitted(record)&&<button type="button" disabled={busy} onClick={()=>download([record])} aria-label={`Descargar PDF de ${record.kind} ${record.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 disabled:opacity-40"><Download className="h-4 w-4"/>PDF</button>}</div>)}
  </section>;
}
