import {lazy,Suspense,useRef,useState} from 'react';
import {SquarePen} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {checklistCandidates} from '../../../supabase/functions/_shared/equipmentQr.mjs';
const Designer=lazy(()=>import('./FormulariosCapacitaciones'));
export default function EquipmentFormsEditor({equipment,user,companyBranding}){
 const [form,setForm]=useState(null),[choices,setChoices]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [copyMode,setCopyMode]=useState(false),[search,setSearch]=useState(''),[selected,setSelected]=useState(null),[success,setSuccess]=useState('');
 const pending=useRef(false);
 async function open(){
  setBusy(true);setError('');setSuccess('');setSearch('');setSelected(null);
  try{
   const data=[];
   for(let offset=0;;offset+=500){
    const page=await supabase.from('prevencion_formularios').select('*').eq('empresa',equipment.empresa).order('id').range(offset,offset+499);
    if(page.error)throw page.error;data.push(...(page.data||[]));if(!page.data||page.data.length<500)break;
   }
   const ids=checklistCandidates(equipment,data||[]),matches=(data||[]).filter(f=>ids.includes(f.id));
   if(matches.length===1)setForm(matches[0]);else {setCopyMode(!matches.length);setChoices(matches.length?matches:data);if(!data.length)setError('No hay formularios disponibles para copiar.');}
  }catch{setError('No se pudo abrir el checklist. Revisa tus permisos de formularios.');}finally{setBusy(false);}
 }
 async function choose(adapt){
  if(!selected||pending.current)return;
  if(!copyMode){setForm(selected);setChoices([]);return;}
  pending.current=true;setBusy(true);setError('');
  try{
   const {data,error}=await supabase.rpc('equipo_copiar_checklist',{p_equipo:equipment.id,p_formulario:selected.id});
   if(error)throw error;if(!data?.id)throw Error('No se pudo confirmar la copia.');
   setChoices([]);if(adapt)setForm(data);else setSuccess('Checklist vinculado. Puedes usarlo desde el QR o adaptarlo en «Editar checklist».');
  }catch(e){setError(e.message||'No se pudo copiar el checklist.');}finally{pending.current=false;setBusy(false);}
 }
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const visible=choices.filter(f=>normalize(`${f.titulo} ${f.codigo||''}`).includes(normalize(search)));
 return <><button disabled={busy} onClick={open} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 px-3 text-xs font-semibold text-white disabled:opacity-50"><SquarePen className="h-4 w-4 shrink-0" aria-hidden="true"/>{busy?'Abriendo…':'Editar checklist'}</button>
 {error&&<p role="alert" className="col-span-full w-full rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 {success&&<p role="status" className="col-span-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
 {choices.length>0&&<div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-900/50 p-4" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setChoices([]);}}><section role="dialog" aria-modal="true" aria-labelledby="equipment-checklist-title" className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
 <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 id="equipment-checklist-title" className="text-xl font-bold text-slate-900">{copyMode?'Elegir checklist para el equipo':'Editar checklist'}</h2><p className="mt-1 text-sm text-slate-600">{equipment.tipo} · {equipment.patente}</p></div><button aria-label="Cerrar" disabled={busy} onClick={()=>setChoices([])} className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600">✕</button></header>
 <div className="overflow-y-auto p-5"><p className="mb-4 text-sm text-slate-600">{copyMode?'No hay un checklist vinculado. Elige un formulario para crear una copia exclusiva de este equipo. El original y sus respuestas no cambiarán.':'Selecciona el checklist que deseas editar.'}</p>
 <input autoFocus aria-label="Buscar formulario" value={search} onChange={e=>setSearch(e.target.value)} className="mb-4 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Buscar por nombre o código…"/>
 <div className="max-h-72 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Formularios disponibles">{visible.map(f=><label key={f.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected?.id===f.id?'border-indigo-600 bg-indigo-50':'border-slate-200 bg-white'}`}><input type="radio" name="equipment-checklist-source" checked={selected?.id===f.id} onChange={()=>setSelected(f)} disabled={busy} className="h-4 w-4 accent-indigo-700"/><span className="text-sm font-semibold text-slate-900">{f.titulo}</span></label>)}{!visible.length&&<p className="py-5 text-sm text-slate-500">No hay formularios que coincidan.</p>}</div>
 {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>
 <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4"><button disabled={busy} onClick={()=>setChoices([])} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Cancelar</button>{copyMode&&<button disabled={!selected||busy} onClick={()=>choose(false)} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 disabled:opacity-50">Usar copia</button>}<button disabled={!selected||busy} onClick={()=>choose(true)} className="rounded-xl bg-indigo-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Guardando…':copyMode?'Copiar y adaptar':'Editar'}</button></footer>
 </section></div>}
 {form&&<div className="fixed inset-0 z-[10001] overflow-auto bg-slate-50 p-4"><div className="mx-auto max-w-6xl"><button onClick={()=>setForm(null)} className="mb-4 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold">Volver a la ficha del equipo</button><p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">{form.campos?.control_documental?.equipo_checklist_id?`Editas la copia exclusiva de ${equipment.patente}. El original y las respuestas guardadas se conservan.`:`Editas el formulario compartido «${form.titulo}». Los cambios se aplican a los equipos que utilizan este checklist; las respuestas guardadas se conservan.`}</p><Suspense fallback={<p>Cargando diseñador…</p>}><Designer key={form.id} user={user} companyBranding={companyBranding} initialForm={form} onBack={()=>setForm(null)}/></Suspense></div></div>}
 </>;
}
