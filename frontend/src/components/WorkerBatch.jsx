import React,{useState} from 'react';

export default function WorkerBatch({title,workers,onApply,period,inline=false,savedMessage}) {
 const [ids,pick]=useState([]),[form,set]=useState({}),[busy,wait]=useState(false),[msg,say]=useState('');
 const field=(k,v)=>set(f=>({...f,[k]:v}));
 const selected=workers.filter(w=>ids.includes(w.id));
 const Wrapper=inline?'section':'details';
 return <Wrapper className={inline?'space-y-2 [&_select]:rounded-lg [&_select]:border [&_select]:p-2 [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:p-2':'my-3 rounded-xl border bg-white p-3'}>{inline?<h4 className="text-sm font-bold text-blue-900">{title}</h4>:<summary className="cursor-pointer font-bold text-blue-900">{title}</summary>}
 <form className="grid gap-3 p-2 text-sm" onSubmit={async e=>{e.preventDefault();if(busy||!selected.length)return;wait(true);say('');try{if(period&&form.scope!=='dia'&&(!form.from||!form.to?.startsWith(period)||form.from>form.to))throw Error('Revisa las fechas y el mes de nómina.');await onApply(selected,form);pick([]);say(savedMessage || (period?'Agregado al borrador. Guarda la nómina para conservarlo.':'Correcciones guardadas.'));}catch(err){say(err.message)}finally{wait(false)}}}>
 <label><input type="checkbox" disabled={!workers.length} checked={!!workers.length&&selected.length===workers.length} onChange={e=>pick(e.target.checked?workers.map(w=>w.id):[])}/> Seleccionar todos ({workers.length})</label>
 <div className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">{workers.map(w=><label key={w.id}><input type="checkbox" checked={ids.includes(w.id)} onChange={e=>pick(e.target.checked?[...ids,w.id]:ids.filter(i=>i!==w.id))}/> {w.name}</label>)}</div>
 {period?<><label>Aplicar a <select onChange={e=>field('scope',e.target.value)}><option value="rango">Por período</option><option value="dia">Día específico</option></select></label>
 {form.scope!=='dia'&&<div className="grid gap-3 sm:grid-cols-2"><label>Desde <input required type="date" max={form.to||undefined} onChange={e=>field('from',e.target.value)}/></label><label>Hasta <input required type="date" min={form.from>period+'-01'?form.from:period+'-01'} max={period+'-'+new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate()} onChange={e=>field('to',e.target.value)}/></label><small className="sm:col-span-2">Un solo monto por trabajador. Elige la nómina del mes en que termina el período.</small></div>}
 {form.scope==='dia'&&<label>Fecha <input required type="date" min={period+'-01'} max={period+'-'+new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate()} onChange={e=>field('day',e.target.value)}/></label>}
 <label>Nombre del haber <input required maxLength={120} onChange={e=>field('name',e.target.value)}/></label>
 <label>Monto por trabajador ($) <input type="number" min="1" step="1" required onChange={e=>field('amount',e.target.value)}/></label>
 <label>Tipo <select onChange={e=>field('type',e.target.value)}><option>Imponible</option><option>No imponible</option></select></label></>:<>
 <p>Solo se modifican los campos que completes.</p>
 <label>Estado <select onChange={e=>field('asistencia',e.target.value)}><option value="">Sin cambio</option><option>PRESENTE</option><option>AUSENTE</option></select></label>
 <label>Ingreso <input type="time" onChange={e=>field('ingreso',e.target.value)}/></label><label>Salida <input type="time" onChange={e=>field('salida',e.target.value)}/></label>
 <label>Colación <select onChange={e=>field('colacion',e.target.value)}><option value="">Sin cambio</option><option>SI</option><option>NO</option></select></label>
 <label>Otras horas <input type="number" min="0" max="24" step="0.25" onChange={e=>field('otras_horas',e.target.value)}/></label></>}
 <button className="rounded-xl bg-blue-900 p-2 text-white disabled:opacity-50" disabled={busy||!selected.length}>{busy?'Aplicando…':'Aplicar a '+selected.length+' seleccionados'}</button><span role="status">{msg}</span></form></Wrapper>;
}
