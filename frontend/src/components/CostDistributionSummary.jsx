import React from 'react';
import { costDistribution } from '../utils/costDistribution';

const money = n => '$' + Math.round(n).toLocaleString('es-CL');
const colors = ['#28387e','#0d9488','#f59e0b','#8b5cf6','#e879a0','#0284c7','#a16207','#475569','#dc2626','#65a30d','#c026d3','#0891b2'];
const documentLabel = r => [r.num_factura && `Factura ${r.num_factura}`,r.num_oc && `OC ${r.num_oc}`].filter(Boolean).join(' · ') || r.fuente || 'Sin documento';

export default function CostDistributionSummary({ records, parts, matches, global, sale, cutoff, expectedTotal, issue }) {
  const model = costDistribution(records, parts, matches, global);
  const margin = sale - model.total;
  const slices = [...model.categories.filter(c => c.value > 0), ...(margin > 0 ? [{ name: 'Margen estimado', value: margin, margin: true }] : [])];
  const denominator = slices.reduce((sum,c) => sum+c.value,0);
  let cursor = 0;
  const segments = slices.map((slice,index) => {
    const start = cursor;
    cursor += denominator > 0 ? slice.value / denominator * 100 : 0;
    return { ...slice, color: slice.margin ? '#cbd5e1' : colors[index % colors.length], start, end: cursor };
  });
  const mismatch = Math.abs(model.total - expectedTotal) > 1;
  return <section className="space-y-4" aria-label="Distribución y detalle de costos">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h4 className="font-extrabold text-sm text-slate-900">Distribución de costos y margen</h4>
      <p className="mt-1 text-xs text-slate-500">Venta de avance al {cutoff}: {money(sale)} · Costos netos incurridos, incluidos pendientes de confirmar. No incluye costos futuros.</p>
      {(issue || mismatch) && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Información incompleta: {issue || 'el detalle no concilia con el total de control; revisar las fuentes de costos.'}</p>}
      <div className="mt-5 grid gap-6 md:grid-cols-[240px_1fr] items-center">
        <div className="mx-auto h-56 w-56 rounded-full border-4 border-white shadow-sm" role="img" aria-label={`Distribución: ${segments.map(s=>`${s.name} ${money(s.value)}`).join(', ')}`} style={{ background: denominator > 0 ? `conic-gradient(${segments.map(s=>`${s.color} ${s.start}% ${s.end}%`).join(',')})` : '#e2e8f0' }} />
        <ul className="space-y-2 min-w-0">{segments.map(s=><li key={s.name} className="flex items-start gap-2 text-sm border-b border-slate-100 pb-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{background:s.color}}/><span className="flex-1 break-words">{s.name}</span><span className="text-right font-bold tabular-nums">{money(s.value)}<small className="block font-normal text-slate-500">{(s.value / denominator * 100).toFixed(1)}%</small></span></li>)}{!segments.length && <li className="text-sm text-slate-500">Sin importes para graficar en este corte.</li>}</ul>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>Costos: <strong>{money(model.total)}</strong></span><span className={margin<0?'text-rose-700':'text-emerald-800'}>{margin<0?'Pérdida al corte':'Margen estimado'}: <strong>{money(Math.abs(margin))}</strong></span></div>
      <p className="mt-2 text-xs text-slate-500">Margen = venta de avance − costos incurridos. No es utilidad final ni considera gastos aún no registrados.{margin<0?' La torta muestra solo costos; la pérdida se informa aparte.':''}{model.categories.some(c=>c.value<0)?' Los ajustes negativos se incluyen en el total, pero no como sectores de la torta.':''}</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h4 className="font-extrabold text-sm text-slate-900">Gastos por partida</h4>
      <p className="mt-1 mb-4 text-xs text-slate-500">Despliega cada partida para ver todos sus gastos. Personal: se usa la cuadrilla del reporte o, si no existe, la dotación con costo del mismo día y obra. Entre partidas avanzadas se pondera por su presupuesto total. Días sin avance o sin presupuesto suficiente quedan sin imputar.</p>
      <div className="space-y-2">{model.groups.map(group=><details key={group.name} className="rounded-xl border border-slate-200 open:border-indigo-200">
        <summary className="cursor-pointer p-3 text-sm font-semibold text-slate-800"><span className="ml-1 break-words">{group.name}</span><span className="ml-3 inline-block text-indigo-900">{money(group.total)} · {group.rows.length} cargos</span></summary>
        {group.rows.length ? <div className="overflow-x-auto px-3 pb-3"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{['Fecha','Concepto / persona / equipo','Categoría','Documento','Monto imputado'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{group.rows.map((r,i)=><tr key={`${r.id}-${i}`} className="border-t border-slate-100"><td className="p-2 whitespace-nowrap">{r.fecha || 'Sin fecha'}</td><td className="p-2 break-words max-w-xs">{r.nombre || r.concepto || r.descripcion || r.trabajador || r.trabajador_nombre || 'Gasto registrado'}{r.allocationReason && <small className="block mt-1 text-slate-500">{r.allocationReason} · Factor {(Number(r.allocationFactor)*100).toFixed(2)}%</small>}</td><td className="p-2">{r.category}</td><td className="p-2">{documentLabel(r)}</td><td className="p-2 text-right font-semibold whitespace-nowrap">{money(r.allocated)}</td></tr>)}</tbody></table></div>:<p className="px-3 pb-3 text-xs text-slate-500">Sin gastos imputados al corte.</p>}
      </details>)}</div>
    </div>
  </section>;
}
