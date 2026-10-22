import React,{useMemo,useState} from 'react';
import {simulationAnalysis} from '../utils/simulationAnalysis';
import SimulationCostCalendar from './SimulationCostCalendar';
const money=n=>n==null?'N/D':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export default function SimulationAnalysis({input,costBudget}){
  const [variation,setVariation]=useState(15);
  const analysis=useMemo(()=>{try{return simulationAnalysis(input,{variation,costBudget});}catch{return null;}},[input,variation,costBudget]);
  if(!analysis)return null;
  return <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4" aria-label="Análisis de plazo y costo">
    <h4 className="font-black text-indigo-950">Cómo cambia el futuro del proyecto</h4>
    <label className="block text-xs font-bold">Variación del rendimiento para comparar (%)<input aria-label="Variación de rendimiento" type="number" min="0" max="50" value={variation} onChange={e=>setVariation(e.target.value)} className="ml-2 w-20 rounded border bg-white p-2"/></label>
    <p className="text-xs text-slate-600">Se varía el rendimiento base y diario de todas las partidas pendientes. Se mantienen las tarifas, recursos, dependencias y calendario. No son probabilidades: una mayor producción requiere capacidad real, que debes reflejar en los recursos.</p>
    <div className="overflow-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr>{['Escenario','Término','Costo futuro seleccionado','Real + futuro seleccionado','Diferencia vs. presupuesto de costos'].map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{analysis.scenarios.map(s=><tr key={s.name} className="border-t"><td className="p-2 font-bold">{s.name} ({Math.round(s.factor*100)}%)</td><td className="p-2">{s.result.finish||'Fuera del horizonte'}</td><td className="p-2">{money(s.result.futureCost)}</td><td className="p-2">{money(s.result.totalAtFinish)}</td><td className="p-2">{s.variance==null?'Sin base comparable':`${s.variance>0?'+':''}${money(s.variance)}`}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-slate-600">{Number(costBudget)>0?`Presupuesto aprobado de costos: ${money(costBudget)}. Una diferencia negativa no demuestra ahorro si faltan costos futuros.`:'Falta presupuesto aprobado de costos para medir la desviación; no se utiliza la venta como presupuesto de gasto.'} Si un escenario no termina, su costo cubre solo el horizonte.</p>
    <SimulationCostCalendar scenarios={analysis.scenarios}/>
    <h5 className="text-sm font-bold">Partidas que requieren atención</h5>
    {analysis.drivers.slice(0,5).map(p=><div key={p.id} className="rounded-lg border bg-white p-3 text-xs"><b>{p.name}</b><p>Inicio efectivo: {p.actualStart||'Bloqueado o fuera del horizonte'} · Término: {p.finish||'No alcanza'}.</p><p>{p.requiredPace==null?'No quedan jornadas disponibles para alcanzar el objetivo.':`Para el objetivo: ${p.requiredPace.toLocaleString('es-CL',{maximumFractionDigits:2})} ${p.unit}/día en ${p.availableDays} jornadas.${p.increase>0?` Requiere ${p.increase.toFixed(1)}% más que el rendimiento base.`:''}`}</p></div>)}
    <p className="text-[11px] text-slate-500">Ordenadas por término más tardío, primero las que no alcanzan. No equivale a una ruta crítica contractual: no incluye restricciones automáticas de cuadrillas, suministros ni disponibilidad de equipos.</p>
  </section>;
}
