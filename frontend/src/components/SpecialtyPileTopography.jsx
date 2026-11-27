import React,{useState} from 'react';
import './SpecialtyProtocols.css';
const fields=[['cota_inicial','Cota inicial (m)'],['cota_final','Cota final (m)'],['norte_real','Norte medido (m)'],['este_real','Este medido (m)'],['cota_real','Cota medida (m)']];
const historicKeys=[...fields.map(([k])=>k),'cota_diseno','deformacion','cst','bst','profundidad_control'];
const present=v=>v!=null&&String(v).trim()!=='';
export default function SpecialtyPileTopography({element,disabled,onSave,historical={},mode='topography'}){
 const controlsOnly=mode==='controls';
 const editableKeys=controlsOnly?['tipo_control','deformacion','cst','bst','profundidad_control','observaciones']:[...fields.map(([k])=>k),'cota_diseno'];
 const [data,setData]=useState(element.topografia||{});
 const [control,setControl]=useState(['deformacion','cst','bst','profundidad_control','tipo_control'].some(k=>present(element.topografia?.[k])));
 const [error,setError]=useState(''),[saving,setSaving]=useState(false);
 const input=(key,label)=><label key={key}>{label}<input aria-label={label} inputMode="decimal" disabled={disabled||saving} value={data[key]??''} onChange={e=>setData({...data,[key]:e.target.value.replace(',','.')})}/></label>;
 const save=async()=>{
  const numeric=historicKeys.filter(k=>editableKeys.includes(k)&&present(data[k]));
  if(numeric.some(k=>!Number.isFinite(Number(data[k])))){setError('Revisa los valores numéricos antes de guardar.');return;}
  if(controlsOnly&&control&&(!['BST','CST'].includes(data.tipo_control)&&!present(data.cst)&&!present(data.bst))){setError('Selecciona BST o CST para el control.');return;}
  if(controlsOnly&&control&&(!present(data.deformacion)&&!present(data.cst)&&!present(data.bst)||!present(data.profundidad_control))){setError('Completa la deformación y profundidad del control.');return;}
  const saved={...element.topografia,...Object.fromEntries(editableKeys.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]))};
  setSaving(true);setError('');try{await onSave(saved);}catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <details className="specialty-protocols protocol-pile"><summary>{element.etapa} · Pila {element.numero}</summary>
  {!controlsOnly&&historicKeys.some(k=>editableKeys.includes(k)&&present(historical[k]))&&<div className="protocol-history"><p>Hay mediciones del Excel histórico disponibles para esta pila.</p><button disabled={disabled||saving} onClick={()=>setData(prev=>({...prev,...Object.fromEntries(historicKeys.filter(k=>editableKeys.includes(k)&&!present(prev[k])&&present(historical[k])).map(k=>[k,String(historical[k]).replace(',','.')]))}))}>Copiar datos históricos faltantes</button></div>}
  {!controlsOnly&&<><h4>Mediciones topográficas de la pila</h4><div className="protocol-fields">{fields.map(([k,label])=>input(k,label))}</div>
  {present(data.cota_diseno)&&<p>Cota de diseño histórica: {data.cota_diseno} m. Se conserva; los nuevos protocolos usan la plataforma configurada como cota de proyecto.</p>}</>}
  {controlsOnly&&(!control?<button disabled={disabled||saving} onClick={()=>setControl(true)}>Agregar BST / CST</button>:<fieldset className="protocol-control"><legend>Ítem 3.0 · Control BST / CST de esta pila</legend>
   <div className="protocol-fields"><label>Tipo de ensayo<select aria-label="Tipo de ensayo" disabled={disabled||saving} value={data.tipo_control||''} onChange={e=>setData({...data,tipo_control:e.target.value})}><option value="">Selecciona BST o CST</option><option>BST</option><option>CST</option></select></label>{input('deformacion','Deformación (cm)')}{input('profundidad_control','Profundidad de control (m)')}</div>
   {(present(data.cst)||present(data.bst))&&<div className="protocol-fields">{present(data.cst)&&input('cst','CST histórico (cm)')}{present(data.bst)&&input('bst','BST histórico (cm)')}</div>}
  </fieldset>)}
  {controlsOnly&&<label>Comentarios de esta pila (opcional)<textarea aria-label="Comentarios de esta pila" disabled={disabled||saving} rows={3} value={data.observaciones??''} onChange={e=>setData({...data,observaciones:e.target.value})}/></label>}
  {!controlsOnly&&present(data.referencia)&&<p className="protocol-history">Referencia histórica de esta pila: {data.referencia}. Se conserva sin modificar.</p>}
  {error&&<p role="alert">{error}</p>}<button disabled={disabled||saving} onClick={save}>{saving?'Guardando…':controlsOnly?'Guardar BST / CST y comentario':'Guardar topografía'}</button>
 </details>;
}
