import React from 'react';

const number = value => Number(value).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const percent = value => value === null ? 'Sin base' : `${number(value)}%`;
const dateLabel = value => value ? value.split('-').reverse().join('/') : 'Sin fecha';

export default function PartidaProgressSummary({ rows, cutoff }) {
  return <section className="bg-white p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3">
    <div>
      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">📦 Resumen de Avance Físico por Partida</h4>
      <p className="text-xs text-slate-500 mt-1">Al {dateLabel(cutoff)} · Despliega una partida para comparar su avance con el programa.</p>
    </div>
    {rows.length === 0 && <p className="text-sm text-slate-500">No hay partidas en el alcance seleccionado.</p>}
    <div className="space-y-2">
      {rows.map((p, index) => {
        const m = p.comparison;
        const gap = m.difference;
        const onPlan = gap !== null && Math.abs(gap) < 0.000001;
        const tone = gap === null ? 'bg-slate-100 text-slate-600' : onPlan ? 'bg-blue-50 text-blue-900' : gap > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900';
        const status = gap === null ? 'Sin programación' : onPlan ? 'En programa' : `${number(Math.abs(gap))} ${p.unidad || ''} ${gap > 0 ? 'sobre' : 'bajo'} el programa`;
        const metrics = [
          ['Cantidad presupuestada', `${number(p.cantTotal)} ${p.unidad || ''}`],
          ['Programado al corte', m.planned === null ? 'Sin programación' : `${number(m.planned)} ${p.unidad || ''} · ${percent(m.plannedPct)}`],
          ['Ejecutado al corte', `${number(p.cantAv)} ${p.unidad || ''} · ${percent(m.actualPct)}`],
          ['Diferencia de avance', m.differencePct === null ? 'Sin programación' : `${m.differencePct > 0 ? '+' : ''}${number(m.differencePct)} puntos porcentuales`],
          ['Cumplimiento del programa', m.planCompliance === null ? 'No aplica: sin cantidad programada' : percent(m.planCompliance)],
          ['Pendiente del presupuesto', `${number(m.remaining)} ${p.unidad || ''}${p.cantTotal > 0 ? ` · ${percent(m.remaining / p.cantTotal * 100)}` : ''}`],
          ['Promedio por día con reporte', p.uniqueDays > 0 ? `${number(p.cantAv / p.uniqueDays)} ${p.unidad || ''}/día · ${percent(m.actualPct === null ? null : m.actualPct / p.uniqueDays)}/día` : 'Sin reportes'],
          ['Inicio programado', dateLabel(p.scheduledStart)],
        ];
        return <details key={p.id ?? `${p.partida}-${index}`} className="group rounded-xl border border-slate-200 overflow-hidden">
          <summary className="cursor-pointer p-3 focus-visible:outline-2 focus-visible:outline-blue-700">
            <span className="inline-flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-[calc(100%-1.5rem)] align-top">
              <span className="font-bold text-sm text-slate-800">{p.partida}</span>
              <span className={`text-xs font-bold rounded-md px-2 py-1 ${tone}`}>{status}</span>
            </span>
            <div className="mt-2 ml-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
              <span>Ejecutado: <b className="text-blue-900">{number(p.cantAv)} / {number(p.cantTotal)} {p.unidad} · {percent(m.actualPct)}</b></span>
              <span>Programado: <b>{m.planned === null ? 'Sin programación' : `${number(m.planned)} ${p.unidad || ''} · ${percent(m.plannedPct)}`}</b></span>
              <span className="text-blue-800 underline group-open:hidden">Ver detalle</span>
            </div>
          </summary>
          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {metrics.map(([label, value]) => <div key={label} className="rounded-lg bg-white border border-slate-100 p-3">
                <dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-bold text-slate-800 mt-1">{value}</dd>
              </div>)}
            </dl>
            {m.excess > 0 && <p className="text-xs text-amber-900 mt-3">Ejecutado sobre la cantidad presupuestada: {number(m.excess)} {p.unidad}.</p>}
            <p className="text-xs text-slate-500 mt-3">El programa usa el inicio y la duración del cronograma, distribuidos en días hábiles del calendario de obra. Cumplimiento = ejecutado ÷ programado. La diferencia porcentual compara ambos avances respecto del presupuesto. El promedio considera {p.uniqueDays} día(s) con reporte.</p>
          </div>
        </details>;
      })}
    </div>
  </section>;
}
