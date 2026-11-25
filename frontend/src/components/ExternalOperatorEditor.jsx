import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { readAllMachineryRows } from '../utils/machineryExports';
import { normalizeRut } from '../../../supabase/functions/_shared/equipmentQr.mjs';

const control='mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200';
export default function ExternalOperatorEditor({company, operator, onSaved, onCancel}) {
 const [form,setForm]=useState(()=>operator||{nombre:'',rut_externo:'',cargo_externo:'Operador de maquinaria',proveedor:'',equipos_autorizados:[],vigente_desde:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date()),vigente_hasta:''});
 const [equipment,setEquipment]=useState([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;readAllMachineryRows(()=>supabase.from('inventario_maquinaria').select('id,tipo,patente').eq('empresa',company)).then(rows=>{if(active)setEquipment(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[company]);
 const field=(key,value)=>setForm(old=>({...old,[key]:value}));
 async function submit(event){
  event.preventDefault();if(busy)return;setError('');
  const rut=normalizeRut(form.rut_externo);
  if(!rut)return setError('Revisa el RUT y su dígito verificador.');
  if(!form.equipos_autorizados.length)return setError('Selecciona al menos un equipo autorizado.');
  if(form.vigente_hasta&&form.vigente_hasta<form.vigente_desde)return setError('La fecha final debe ser igual o posterior al inicio.');
  setBusy(true);
  try{const {error:failure}=await supabase.rpc('guardar_operador_externo',{p_empresa:company,p_datos:{id:form.id||null,nombre:form.nombre.trim(),rut_externo:rut,cargo_externo:form.cargo_externo.trim(),proveedor:form.proveedor.trim(),equipos_autorizados:form.equipos_autorizados,vigente_desde:form.vigente_desde,vigente_hasta:form.vigente_hasta||null}});if(failure)throw failure;await onSaved();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-indigo-200 bg-slate-50 p-5" aria-label="Operador externo">
  <h3 className="font-bold">{operator?'Editar operador externo':'Nuevo operador externo'}</h3>
  <p className="text-sm text-slate-600">Acceso al QR solo con RUT, sin contraseña. No crea ficha de Recursos Humanos, remuneraciones ni costos de personal. La autorización se limita a los equipos y la vigencia indicados.</p>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
  <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
   <label className="text-sm font-semibold">RUT<input required readOnly={Boolean(operator)} maxLength={16} value={form.rut_externo} onChange={e=>field('rut_externo',e.target.value)} className={control}/></label>
   <label className="text-sm font-semibold">Nombre completo<input required minLength={2} maxLength={180} value={form.nombre} onChange={e=>field('nombre',e.target.value)} className={control}/></label>
   <label className="text-sm font-semibold">Cargo<input required maxLength={180} value={form.cargo_externo} onChange={e=>field('cargo_externo',e.target.value)} className={control}/></label>
   <label className="text-sm font-semibold">Empresa o proveedor<input required maxLength={180} value={form.proveedor} onChange={e=>field('proveedor',e.target.value)} className={control}/></label>
   <label className="text-sm font-semibold">Autorizado desde<input required type="date" value={form.vigente_desde} onChange={e=>field('vigente_desde',e.target.value)} className={control}/></label>
   <label className="text-sm font-semibold">Hasta (opcional)<input type="date" min={form.vigente_desde} value={form.vigente_hasta||''} onChange={e=>field('vigente_hasta',e.target.value)} className={control}/></label>
  </fieldset>
  <fieldset disabled={busy||loading} className="rounded-xl border border-slate-200 bg-white p-4"><legend className="px-2 font-semibold">Equipos autorizados</legend>{loading?<p>Cargando equipos…</p>:<div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">{equipment.map(eq=><label key={eq.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" checked={form.equipos_autorizados.includes(eq.id)} onChange={e=>field('equipos_autorizados',e.target.checked?[...form.equipos_autorizados,eq.id]:form.equipos_autorizados.filter(id=>id!==eq.id))}/>{eq.patente} · {eq.tipo}</label>)}</div>}</fieldset>
  <div className="flex flex-wrap gap-3"><button disabled={busy||loading} className="rounded-xl bg-indigo-900 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'Guardando…':'Guardar operador externo'}</button><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">Cancelar</button></div>
 </form>;
}
