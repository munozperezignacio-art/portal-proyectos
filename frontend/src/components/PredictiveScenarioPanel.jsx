import React, { useMemo } from 'react';
import { AlertTriangle, CalendarRange, CircleDollarSign, FlaskConical, ShieldCheck, TrendingUp } from 'lucide-react';

const DAY = 86400000;
const number = value => Number(value || 0);
const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(number(value));
const dateKey = value => String(value || '').slice(0, 10);
const validDate = value => { const date = new Date(`${dateKey(value)}T12:00:00`); return Number.isNaN(date.getTime()) ? null : date; };
const businessDays = (from, to) => { const start = validDate(from), end = validDate(to); if (!start || !end || end <= start) return 0; let days = 0; for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) if (![0, 6].includes(cursor.getDay())) days += 1; return days; };
const addBusinessDays = (from, amount) => { const date = validDate(from) || new Date(); let pending = Math.max(0, Math.round(amount)); while (pending > 0) { date.setDate(date.getDate() + 1); if (![0, 6].includes(date.getDay())) pending -= 1; } return date.toISOString().slice(0, 10); };
const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value)));

export default function PredictiveScenarioPanel({ cutoff, baselineFinish, bac, eac, spi, cpi, actualProgress, plannedProgress, advances = [], costs = [], criticalItems = [] }) {
  const model = useMemo(() => {
    const dates = advances.map(row => validDate(row.fecha || row.fecha_avance || row.created_at)).filter(Boolean).sort((a, b) => a - b);
    const historyDays = dates.length > 1 ? Math.round((dates.at(-1) - dates[0]) / DAY) : 0;
    const ready = advances.length >= 24 && costs.length >= 24 && historyDays >= 84;
    const scheduleIndex = clamp(spi || 1, 0.35, 1.4), costIndex = clamp(cpi || 1, 0.35, 1.5);
    const remainingBaseline = Math.max(1, businessDays(cutoff, baselineFinish));
    const duration = factor => Math.ceil(remainingBaseline / clamp(scheduleIndex + factor, 0.35, 1.5));
    const finish = factor => addBusinessDays(cutoff, duration(factor));
    const cost = factor => bac > 0 ? Math.round(bac / clamp(costIndex + factor, 0.35, 1.6)) : number(eac);
    const baseCost = number(eac) || cost(0), baseDuration = duration(0);
    const monthCount = Math.max(1, Math.min(12, Math.ceil(baseDuration / 21)));
    const rawWeights = Array.from({ length: monthCount }, (_, index) => Math.sin(Math.PI * (index + 1) / (monthCount + 1)) + 0.2);
    const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
    const remainingCost = Math.max(0, baseCost - costs.reduce((sum, row) => sum + number(row.monto || row.monto_real), 0));
    const cashflow = rawWeights.map((weight, index) => ({ month: index + 1, amount: remainingCost * weight / weightTotal }));
    const completeness = [advances.length >= 24, costs.length >= 24, historyDays >= 84, Boolean(baselineFinish), bac > 0].filter(Boolean).length;
    const criticalRate = criticalItems.length / Math.max(1, advances.length);
    return { ready, historyDays, confidence: Math.round(completeness / 5 * 100), cashflow,
      scenarios: [
        { name: 'Favorable', finish: finish(0.12), cost: cost(0.08), tone: 'emerald' },
        { name: 'Base', finish: finish(0), cost: baseCost, tone: 'blue' },
        { name: 'Adverso', finish: finish(-0.15), cost: cost(-0.12), tone: 'rose' },
      ],
      delay: Math.max(0, businessDays(baselineFinish, finish(0))), overrun: Math.max(0, baseCost - bac),
      milestoneRisk: scheduleIndex < 0.9 || criticalRate > 0.1 ? 'Alto' : scheduleIndex < 1 ? 'Medio' : 'Bajo' };
  }, [advances, bac, baselineFinish, cpi, costs, cutoff, eac, criticalItems, spi]);
  const tones = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900', blue: 'border-blue-200 bg-blue-50 text-blue-950', rose: 'border-rose-200 bg-rose-50 text-rose-900' };
  const maxCash = Math.max(1, ...model.cashflow.map(item => item.amount));
  return <div className="space-y-5">
    <section className={`rounded-2xl border p-5 ${model.ready ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/80'}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-3"><span className={`h-fit rounded-xl p-3 ${model.ready ? 'bg-emerald-700' : 'bg-amber-500'} text-white`}><FlaskConical className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-slate-950">Laboratorio predictivo de obra</h4><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${model.ready ? 'bg-emerald-700 text-white' : 'bg-amber-200 text-amber-950'}`}>{model.ready ? 'Proyección habilitada' : 'Modo simulación'}</span></div><p className="mt-1 max-w-3xl text-xs text-slate-600">Escenarios determinísticos basados en EVM. No modifican programación, presupuesto ni flujo oficial y no consumen tokens de IA.</p></div></div><div className="rounded-xl bg-white px-4 py-3 text-right shadow-sm"><p className="text-[9px] font-black uppercase text-slate-500">Confianza de datos</p><p className="text-2xl font-black text-slate-950">{model.confidence}%</p><p className="text-[9px] text-slate-500">{advances.length} avances · {costs.length} costos · {model.historyDays} días</p></div></div></section>
    <div className="grid gap-3 md:grid-cols-3">{model.scenarios.map(item => <article key={item.name} className={`rounded-2xl border p-4 ${tones[item.tone]}`}><p className="text-[10px] font-black uppercase">Escenario {item.name}</p><div className="mt-3 flex items-center gap-2"><CalendarRange className="h-4 w-4"/><b className="text-lg">{new Date(`${item.finish}T12:00:00`).toLocaleDateString('es-CL')}</b></div><div className="mt-2 flex items-center gap-2 text-xs"><CircleDollarSign className="h-4 w-4"/><span>Costo al término <b>{money(item.cost)}</b></span></div></article>)}</div>
    <div className="grid gap-3 sm:grid-cols-4"><Metric icon={TrendingUp} label="Avance real / plan" value={`${number(actualProgress).toFixed(1)}% / ${number(plannedProgress).toFixed(1)}%`} /><Metric icon={CalendarRange} label="Atraso probable" value={`${model.delay} días hábiles`} alert={model.delay > 0}/><Metric icon={CircleDollarSign} label="Sobrecosto probable" value={money(model.overrun)} alert={model.overrun > 0}/><Metric icon={ShieldCheck} label="Riesgo de hitos" value={model.milestoneRisk} alert={model.milestoneRisk === 'Alto'}/></div>
    <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h4 className="text-xs font-black uppercase text-slate-900">Flujo de costo restante proyectado</h4><p className="mt-1 text-[10px] text-slate-500">Distribución orientativa del costo pendiente según la duración del escenario base.</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black">{model.cashflow.length} meses</span></div><div className="mt-5 flex h-44 items-end gap-2 border-b border-slate-200 px-2">{model.cashflow.map(item => <div key={item.month} className="flex h-full flex-1 flex-col justify-end"><div title={money(item.amount)} className="min-h-1 rounded-t bg-gradient-to-t from-indigo-900 to-blue-500" style={{ height: `${Math.max(4, item.amount / maxCash * 100)}%` }}/><p className="mt-1 text-center text-[8px] font-bold text-slate-500">M{item.month}</p></div>)}</div></section>
    {!model.ready && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p><b>Resultado de simulación:</b> faltan al menos 24 costos y 12 semanas continuas de historia. Los datos ficticios permiten validar la interfaz y las fórmulas, pero no constituyen una predicción estadística.</p></div>}
  </div>;
}

function Metric({ icon: Icon, label, value, alert = false }) { return <div className={`rounded-2xl border p-4 ${alert ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}><Icon className={`h-4 w-4 ${alert ? 'text-rose-700' : 'text-indigo-800'}`}/><p className="mt-3 text-[9px] font-black uppercase text-slate-500">{label}</p><p className={`mt-1 text-base font-black ${alert ? 'text-rose-800' : 'text-slate-900'}`}>{value}</p></div>; }
