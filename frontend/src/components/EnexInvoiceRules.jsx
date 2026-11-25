import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {parseMachineryThreshold,readInvoiceRules,saveInvoiceRules} from '../services/enexInvoiceRulesService';

export default function EnexInvoiceRules({company,canEdit,db=supabase}) {
  const [saved,setSaved]=useState(null),[threshold,setThreshold]=useState('');
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0),[requiresRefresh,setRequiresRefresh]=useState(false);
  const guard=useRef(false);
  useEffect(()=>{
    let live=true;setBusy(true);setSaved(null);setNotice('');setError('');
    readInvoiceRules(db,company).then(data=>{
      if(live){setSaved(data);setThreshold(String(data.machinery_threshold_milli/1000));setRequiresRefresh(false);}
    }).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});
    return ()=>{live=false;};
  },[db,company,refresh]);
  async function save(event){
    event.preventDefault();if(!canEdit||!saved||busy||requiresRefresh||guard.current)return;
    setError('');setNotice('');
    let value;try{value=parseMachineryThreshold(threshold);}catch(e){setError(e.message);return;}
    guard.current=true;setBusy(true);
    try{
      const data=await saveInvoiceRules(db,company,saved,value);
      setSaved(data);setNotice('Umbral guardado. Se aplicará a nuevas conciliaciones; no modifica movimientos ni asignaciones.');
    }catch(e){setError(e.message);setRequiresRefresh(true);}
    finally{guard.current=false;setBusy(false);}
  }
  return <section aria-label="Reglas de facturas ENEX" className="enex-invoice-rules" aria-busy={busy}>
    <div><h3 className="font-bold text-lg">Reglas de conciliación de facturas</h3><p className="enex-muted">Configuración de {company}. Los centros de gestión asignados serán los centros de costo de los formularios.</p></div>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <form onSubmit={save}><fieldset disabled={busy||!saved||!canEdit||requiresRefresh}>
      <legend>Clasificación para el formulario de consumo</legend>
      <label>Maquinaria cuando la carga supera (litros)<input inputMode="decimal" value={threshold} onChange={e=>setThreshold(e.target.value)} required aria-describedby="enex-threshold-help"/></label>
      <button type="submit">Guardar regla</button>
      <p id="enex-threshold-help" className="enex-muted">Se evalúan los litros originales de cada movimiento. Una carga igual al umbral no se clasifica como maquinaria. Esta regla no cambia la alerta de cargas mayores a 250 litros.</p>
    </fieldset></form>
    <div className="enex-info"><h4 className="font-bold">Reglas de distribución</h4>
      <p>Shellcard se distribuye proporcionalmente a los litros de los movimientos vinculados y sus centros asignados.</p>
      <p>Se admite una diferencia total de hasta ±20 litros por factura. El ajuste proporcional queda en el formulario, separado del consumo original.</p>
      <p>Guías sin coincidencia, duplicadas o con movimientos sin centro bloquean la emisión. No se crean movimientos ni se cambian asignaciones.</p>
    </div>
    {saved&&<p className="enex-muted">{saved.revision?`Versión ${saved.revision} de la regla guardada.`:'Regla inicial: todavía no hay una versión guardada para esta empresa.'}</p>}
    <button type="button" className="enex-secondary" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Actualizar configuración</button>
  </section>;
}
