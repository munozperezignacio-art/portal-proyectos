import React,{useState} from 'react';
import {supabase} from '../supabaseClient';

export default function EquipmentCategories({company,categories,equipment,onChanged,onClose}){
  const [name,setName]=useState(''),[editing,setEditing]=useState(null),[removing,setRemoving]=useState(null),[replacement,setReplacement]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const count=id=>equipment.filter(item=>String(item.categoria_id)===String(id)).length;
  const submit=async event=>{
    event.preventDefault();if(busy)return;setBusy(true);setMessage('');
    try{
      const result=await supabase.rpc('gestionar_categoria_equipo',{p_empresa:company,p_accion:editing?'editar':'crear',p_id:editing?.id||null,p_nombre:name.trim(),p_reemplazo:null});
      if(result.error)throw result.error;await onChanged();setEditing(null);setName('');setMessage('Categoría guardada.');
    }catch(error){setMessage(error.message||'No fue posible guardar la categoría.');}finally{setBusy(false);}
  };
  const remove=async()=>{
    if(busy||!removing)return;setBusy(true);setMessage('');
    try{
      const result=await supabase.rpc('gestionar_categoria_equipo',{p_empresa:company,p_accion:'eliminar',p_id:removing.id,p_nombre:null,p_reemplazo:replacement?Number(replacement):null});
      if(result.error)throw result.error;await onChanged();if(editing?.id===removing.id){setEditing(null);setName('');}setRemoving(null);setReplacement('');setMessage('Categoría eliminada. Los equipos se conservaron.');
    }catch(error){setMessage(error.message||'No fue posible eliminar la categoría.');}finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3"><section role="dialog" aria-modal="true" aria-label="Gestionar categorías de equipos" className="my-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex justify-between gap-3"><div><h3 className="font-black">Categorías de equipos</h3><p className="mt-1 text-xs text-slate-500">Solo para {company}. Cambiar una categoría no cambia el nombre ni la ficha del equipo.</p></div><button disabled={busy} onClick={onClose} aria-label="Cerrar categorías" className="h-9 px-3">✕</button></div>
    {message&&<p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">{message}</p>}
    <form onSubmit={submit} className="space-y-2"><label className="block text-xs font-bold">{editing?'Nuevo nombre de la categoría':'Crear categoría'}<input aria-label="Nombre de categoría" required maxLength={120} value={name} onChange={event=>setName(event.target.value)} disabled={busy} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label><div className="flex gap-2"><button disabled={busy||!name.trim()} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white">{editing?'Guardar nombre':'Crear categoría'}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setName('');}} className="rounded-lg border px-4 py-2 text-xs">Cancelar edición</button>}</div></form>
    {removing&&<div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4"><h4 className="text-sm font-bold">Eliminar «{removing.nombre}»</h4><p className="text-xs">Tiene {count(removing.id)} equipo(s). No se eliminarán equipos. Si tiene equipos asociados, elige su nueva categoría.</p><select aria-label="Categoría de reemplazo" value={replacement} disabled={busy} onChange={event=>setReplacement(event.target.value)} className="w-full rounded-lg border bg-white p-3 text-sm"><option value="">{count(removing.id)?'Selecciona un reemplazo':'Sin reemplazo (categoría vacía)'}</option>{categories.filter(item=>item.id!==removing.id).map(item=><option key={item.id} value={item.id}>{item.nombre}</option>)}</select><div className="flex flex-wrap gap-2"><button disabled={busy||Boolean(count(removing.id)&&!replacement)} onClick={remove} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Confirmar eliminación de categoría</button><button disabled={busy} onClick={()=>setRemoving(null)} className="rounded-lg border bg-white px-3 py-2 text-xs">Cancelar eliminación</button></div></div>}
    <ul className="divide-y rounded-xl border border-slate-200">{categories.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div><b className="text-sm">{item.nombre}</b><p className="text-xs text-slate-500">{count(item.id)} equipo(s)</p></div><div className="flex gap-3"><button disabled={busy} onClick={()=>{setEditing(item);setName(item.nombre);setMessage('');}} className="text-xs font-bold text-primary" aria-label={`Renombrar ${item.nombre}`}>Renombrar</button><button disabled={busy} onClick={()=>{setRemoving(item);setReplacement('');setMessage('');}} className="text-xs text-red-700" aria-label={`Eliminar categoría ${item.nombre}`}>Eliminar</button></div></li>)}</ul>{!categories.length&&<p className="text-sm text-slate-500">No hay categorías. Crea la primera.</p>}
  </section></div>;
}
