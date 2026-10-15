import React, { useEffect, useRef, useState } from 'react';
import { calendarLabelIndices } from '../utils/sCurveTimeline';

export default function DailySCurve({ points }) {
  const container = useRef(null);
  const [width, setWidth] = useState(440);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setSelected(null), [points[0]?.dateStr, points.at(-1)?.dateStr]);
  const left = 40, right = width - 18, plotWidth = right - left;
  const x = i => left + i / Math.max(1, points.length - 1) * plotWidth;
  const y = value => 170 - value * 1.5;
  const labels = new Set(calendarLabelIndices(points.length, plotWidth));
  const index = Math.min(selected ?? points.length - 1, points.length - 1);
  const active = points[index];
  const path = key => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ');
  const selectAtPointer = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSelected(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - rect.left) / rect.width * (points.length - 1)))));
  };
  return <div ref={container} className="w-full min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-2 py-3">
    {!points.length ? <p className="p-6 text-xs text-slate-500">Sin días disponibles para el período seleccionado.</p> : <>
      <svg className="block w-full" style={{ height: 204 }} viewBox={`0 0 ${width} 204`} role="img" aria-label="Curva S diaria: avance real y programado, incluidos fines de semana y feriados">
        {[0,25,50,75,100].map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#cbd5e1" strokeDasharray={value ? '3 3' : undefined}/><text x={left - 7} y={y(value) + 3} textAnchor="end" fontSize="9" fill="#64748b">{value}%</text></g>)}
        <path d={path('pvPct')} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="4 2"/>
        <path d={path('evPct')} fill="none" stroke="#1e3a8a" strokeWidth="3"/>
        {points.map((p,i) => <g key={p.dateStr}>
          <line x1={x(i)} x2={x(i)} y1="171" y2={labels.has(i) ? 178 : 174} stroke="#94a3b8" strokeOpacity={labels.has(i) ? 1 : .35}/>
          {labels.has(i) && <><text x={x(i)} y="193" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#475569">{p.label}</text><circle cx={x(i)} cy={y(p.evPct)} r="3" fill="#1e3a8a" stroke="white"/></>}
        </g>)}
        {active && <g pointerEvents="none"><line x1={x(index)} x2={x(index)} y1="20" y2="170" stroke="#64748b" strokeDasharray="2 3"/><circle cx={x(index)} cy={y(active.evPct)} r="4" fill="#1e3a8a" stroke="white"/><circle cx={x(index)} cy={y(active.pvPct)} r="3.5" fill="#16a34a" stroke="white"/></g>}
        <rect x={left} y="16" width={plotWidth} height="163" fill="transparent" onPointerMove={selectAtPointer} onPointerDown={selectAtPointer}/>
      </svg>
      <input className="block w-full accent-blue-900" type="range" min="0" max={Math.max(0,points.length-1)} value={Math.max(0,index)} onChange={e => setSelected(Number(e.target.value))} aria-label="Consultar día de la curva S" aria-valuetext={active ? `${active.dateStr}: real ${active.evPct}%, programado ${active.pvPct}%` : ''}/>
      <p className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] font-bold" aria-live="polite"><span>{active?.dateStr.split('-').reverse().join('-')}</span><span className="text-blue-900">Real: {active?.evPct}%</span><span className="text-green-700">Programado: {active?.pvPct}%</span></p>
      <p className="mt-1 text-center text-[10px] text-slate-500">Todos los días calendario · Desliza para consultar cada fecha</p>
    </>}
  </div>;
}
