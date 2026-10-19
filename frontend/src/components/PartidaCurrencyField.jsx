import React,{useEffect,useEffectEvent,useState} from 'react';
import {fetchCurrencyIndicator,chileanDate} from '../utils/currencyIndicator';

export default function PartidaCurrencyField({currency='CLP',value,onCurrencyChange,onRateChange}) {
  const [status,setStatus]=useState({state:'saved'});
  const [retry,setRetry]=useState(0);
  const updateRate=useEffectEvent(rate=>onRateChange(rate));
  useEffect(()=>{
    if(currency==='CLP')return;
    if(Number.isFinite(Number(value))&&Number(value)>0){setStatus(current=>current.state==='loading'?{state:'saved'}:current);return;}
    const controller=new AbortController();let active=true;
    setStatus({state:'loading'});
    const timer=setTimeout(()=>controller.abort(),12000);
    fetchCurrencyIndicator(currency,{signal:controller.signal}).then(quote=>{
      if(!active)return;
      setStatus({state:'ready',...quote});updateRate(quote.value);
    }).catch(()=>{if(active)setStatus({state:'error'});}).finally(()=>clearTimeout(timer));
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  },[currency,value,retry]);
  return <div className="space-y-2">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs">Moneda<select aria-label="Moneda" value={currency} onChange={e=>{setStatus({state:'saved'});onCurrencyChange(e.target.value);}} className="mt-1 w-full rounded-lg border p-2">{['CLP','UF','USD'].map(code=><option key={code}>{code}</option>)}</select></label>
      {currency!=='CLP'&&<label className="text-xs">Valor de 1 {currency} en CLP<input required min="0.000001" step="any" type="number" value={value||''} onChange={e=>{setStatus({state:'manual'});onRateChange(e.target.value);}} className="mt-1 w-full rounded-lg border p-2"/></label>}
    </div>
    {currency!=='CLP'&&<div aria-live="polite" className={`rounded-lg p-2 text-xs ${status.state==='error'?'bg-amber-50 text-amber-900':'bg-slate-50 text-slate-600'}`}>
      {status.state==='loading'?'Consultando valor automáticamente…':status.state==='ready'?`Valor automático · ${status.date} · ${status.source}${status.date!==chileanDate()?' · Último valor publicado':''}`:status.state==='error'?'No se pudo obtener el indicador. Reintenta o ingresa un valor manual.':status.state==='manual'?'Valor ingresado manualmente.':'Conversión guardada: se conserva para no modificar el presupuesto.'}
      {status.state==='error'&&<button type="button" onClick={()=>setRetry(n=>n+1)} className="ml-2 font-bold underline">Reintentar</button>}
    </div>}
  </div>;
}
