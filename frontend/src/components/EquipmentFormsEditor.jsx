import {lazy,Suspense,useState} from 'react';
import {supabase} from '../supabaseClient';
import {checklistCandidates} from '../../../supabase/functions/_shared/equipmentQr.mjs';
const Designer=lazy(()=>import('./FormulariosCapacitaciones'));
export default function EquipmentFormsEditor({equipment,user,companyBranding}){
 const [form,setForm]=useState(null),[choices,setChoices]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){
  setBusy(true);setError('');
  try{
   const {data,error}=await supabase.from('prevencion_formularios').select('*').eq('empresa',equipment.empresa);
   if(error)throw error;
   const ids=checklistCandidates(equipment,data||[]),matches=(data||[]).filter(f=>ids.includes(f.id));
   if(matches.length===1)setForm(matches[0]);else if(matches.length)setChoices(matches);else setError('Este equipo aún no tiene un checklist compatible. No se editará el formulario de otra máquina.');
  }catch{setError('No se pudo abrir el checklist. Revisa tus permisos de formularios.');}finally{setBusy(false);}
 }
 return <><button disabled={busy} onClick={open} className="rounded-xl bg-indigo-800 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy?'Abriendo…':'Editar checklist'}</button>
 {error&&<p role="alert" className="w-full rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 {choices.length>0&&<div className="w-full rounded-xl border border-slate-200 p-3"><p className="mb-2 text-sm">Selecciona el checklist que deseas editar:</p>{choices.map(f=><button key={f.id} onClick={()=>{setForm(f);setChoices([]);}} className="m-1 rounded-xl border px-3 py-2">{f.titulo}</button>)}</div>}
 {form&&<div className="fixed inset-0 z-[10001] overflow-auto bg-slate-50 p-4"><div className="mx-auto max-w-6xl"><button onClick={()=>setForm(null)} className="mb-4 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold">Volver a la ficha del equipo</button><p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">Editas el formulario compartido «{form.titulo}». Los cambios se aplican a los equipos que utilizan este checklist; las respuestas guardadas se conservan.</p><Suspense fallback={<p>Cargando diseñador…</p>}><Designer key={form.id} user={user} companyBranding={companyBranding} initialForm={form} onBack={()=>setForm(null)}/></Suspense></div></div>}
 </>;
}
