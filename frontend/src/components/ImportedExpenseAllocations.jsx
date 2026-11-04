import React,{useState,useRef,useEffect} from 'react';
import {supabase} from '../supabaseClient';
import ExpensePartSelection from './ExpensePartSelection';
import {weightedExpenseParts} from '../utils/expenseAllocation';
const money=n=>'$'+Number(n).toLocaleString('es-CL');
export default function ImportedExpenseAllocations({company,workId,costs,parts,onUpdated}){
 const [selected,setSelected]=useState([]),[ids,setIds]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const saving=useRef(false);
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let active=true;setAllowed(false);supabase.rpc('permisos_imputaciones_personal_obra',{p_empresa:company,p_obra:workId}).then(({data,error})=>{if(active)setAllowed(!error&&!!data?.editar&&!!data?.aprobar);});return()=>{active=false;};},[company,workId]);
 const pending=costs.filter(c=>['iconstruye_rendicion','iconstruye_oc'].includes(c.origen)&&!c.imputaciones?.length&&Number(c.monto)>0);
 const chosen=pending.filter(c=>selected.includes(c.id));
 async function save(){
  if(saving.current||!allowed||!chosen.length||!ids.length)return;
  saving.current=true;setBusy(true);setMessage('');
  try{
   const distribution=weightedExpenseParts(parts,ids);
   const {data,error}=await supabase.rpc('imputar_gastos_importados',{p_empresa:company,p_obra:workId,p_costos:chosen.map(c=>({id:c.id,monto:Number(c.monto)})),p_partidas:distribution});
   if(error)throw error;
   onUpdated(data);setSelected([]);setMessage(`${data.length} gastos imputados. No se crearon gastos ni se modificaron sus montos o IVA.`);
  }catch(e){setMessage(`No se guardó la distribución: ${e.message}`);}finally{saving.current=false;setBusy(false);}
 }
 return <details className="my-4 rounded-2xl border border-indigo-200 bg-white p-4"><summary className="cursor-pointer font-bold text-indigo-900">Imputar gastos importados pendientes · {pending.length} gastos · {money(pending.reduce((s,c)=>s+Number(c.monto),0))}</summary>
 <div className="mt-4 space-y-4"><p className="text-sm text-slate-600">Selecciona gastos ya cargados y distribuye su costo neto. Solo Administrador de Empresa y Administrador de Contratos pueden aprobar. Los gastos que ya tienen imputación no se modifican.</p>
 <label className="flex gap-2 text-sm font-bold"><input type="checkbox" disabled={busy} checked={pending.length>0&&pending.every(c=>selected.includes(c.id))} onChange={e=>setSelected(e.target.checked?pending.map(c=>c.id):[])}/>Seleccionar todos los gastos pendientes</label>
 <div className="max-h-80 overflow-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2">Seleccionar</th><th className="p-2 text-left">Fecha / Concepto</th><th className="p-2 text-left">Categoría / Documento</th><th className="p-2 text-right">Neto</th></tr></thead><tbody>{pending.map(c=><tr key={c.id} className="border-t"><td className="p-2"><input aria-label={`Imputar ${c.nombre}`} type="checkbox" disabled={busy} checked={selected.includes(c.id)} onChange={e=>setSelected(p=>e.target.checked?[...p,c.id]:p.filter(id=>id!==c.id))}/></td><td className="p-2">{c.nombre}<small className="block">{c.fecha_costo?.split('-').reverse().join('-')}</small></td><td className="p-2">{c.tipo_costo}<small className="block">{c.num_oc?`OC ${c.num_oc}`:`Rendición ${c.importacion_datos?.rendicion||''}`}</small></td><td className="p-2 text-right">{money(c.monto)}</td></tr>)}</tbody></table></div>
 <ExpensePartSelection parts={parts} ids={ids} onChange={setIds} disabled={busy}/>
 <p className="text-sm font-bold">Seleccionados: {chosen.length} · Neto: {money(chosen.reduce((s,c)=>s+Number(c.monto),0))}</p>
 <button type="button" disabled={!allowed||busy||!chosen.length||!ids.length} onClick={save} className="rounded-xl bg-indigo-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy?'Guardando…':'Aprobar distribución de gastos seleccionados'}</button>
 {message&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{message}</p>}
 </div></details>;
}
