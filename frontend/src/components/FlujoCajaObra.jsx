import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, Trash2, WalletCards } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {loadEconomicIndicator} from '../utils/economicIndicatorsCache';
import { monthlyCashForecast } from '../utils/monthlyCashForecast';
import { CHILEAN_HOLIDAYS } from '../utils/chileanHolidays';

const money = value => value == null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
const monthKey = value => String(value || '').slice(0, 7);
const monthLabel = key => new Date(`${key}-15T12:00:00`).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });

export default function FlujoCajaObra({ obra, user, partidas = [], costos = [], liquidaciones = [], avances = [], cutoff, marginRatio }) {
  const [ajustes, setAjustes] = useState([]);
  const [estadosPago, setEstadosPago] = useState([]);
  const [budgetCurrency, setBudgetCurrency] = useState('CLP');
  const [ufRate, setUfRate] = useState({ value: 1, date: '', source: 'Presupuesto en CLP', loading: false, error: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ periodo: new Date().toISOString().slice(0, 7), tipo: 'egreso', monto: '', descripcion: '' });

  useEffect(() => {
    if (!obra?.nombre) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const [budgetResult, paymentsResult] = await Promise.all([
        supabase.from('obra_presupuestos').select('flujo_caja_ajustes,presupuesto_id').eq('obra_nombre', obra.nombre).maybeSingle(),
        supabase.from('estados_pago_obra').select('numero,fecha_corte,monto_neto,estado').eq('obra_nombre', obra.nombre).order('fecha_corte')
      ]);
      if (!active) return;
      setAjustes(Array.isArray(budgetResult.data?.flujo_caja_ajustes) ? budgetResult.data.flujo_caja_ajustes : []);
      setEstadosPago(paymentsResult.data || []);
      let currency = 'CLP';
      if (budgetResult.data?.presupuesto_id) {
        const { data: budget } = await supabase.from('presupuestos_proyectos').select('moneda_base,tipo_proyecto').eq('id', budgetResult.data.presupuesto_id).maybeSingle();
        const legacyCurrency = String(budget?.tipo_proyecto || '').match(/MONEDA:(CLP|UF|USD)/)?.[1];
        currency = String(budget?.moneda_base || legacyCurrency || 'CLP').toUpperCase();
      }
      if (!active) return;
      setBudgetCurrency(currency);
      if (currency === 'UF') {
        setUfRate(current => ({ ...current, value: 0, loading: true, error: '' }));
        try {
          const quote=await loadEconomicIndicator('UF');
          if (active) setUfRate({ ...quote, loading: false, error: '' });
        } catch (error) {
          if (active) setUfRate({ value: 0, date: '', source: 'mindicador.cl', loading: false, error: error.message });
        }
      } else setUfRate({ value: 1, date: '', source: 'Presupuesto en CLP', loading: false, error: '' });
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [obra?.nombre]);

  const saveAjustes = async next => {
    setSaving(true);
    const { error } = await supabase.from('obra_presupuestos').upsert({ empresa: user?.empresa || obra?.empresa || 'Obraxis', obra_nombre: obra.nombre, flujo_caja_ajustes: next }, { onConflict: 'obra_nombre' });
    setSaving(false);
    if (error) { window.alert(`No fue posible guardar el ajuste: ${error.message}`); return false; }
    setAjustes(next);
    return true;
  };

  const forecast = useMemo(() => monthlyCashForecast({
    parts: partidas, reports: avances, cutoff, marginRatio,
    currencyRate: budgetCurrency === 'UF' ? Number(ufRate.value || 0) : 1,
    isBusinessDay: date => ![0,6].includes(new Date(date+'T12:00:00Z').getUTCDay()) && !CHILEAN_HOLIDAYS.includes(date)
  }), [partidas, avances, cutoff, marginRatio, budgetCurrency, ufRate.value]);
  const rows = useMemo(() => {
    let accumulated = 0;
    return forecast.rows.map(row => {
      const ajuste = ajustes.filter(a => a.periodo === row.key).reduce((sum,a) => sum + (a.tipo === 'ingreso' ? 1 : -1) * Number(a.monto || 0), 0);
      const realIngreso = estadosPago.filter(p => ['Aprobado','Pagado'].includes(p.estado) && monthKey(p.fecha_corte) === row.key).reduce((sum,p) => sum + Number(p.monto_neto || 0),0);
      const realEgreso = [...costos,...liquidaciones].filter(c => {
        const date = String(c.fecha_costo || c.fecha || c.fecha_emision || c.periodo || c.created_at || '').slice(0,10);
        return monthKey(date) === row.key && date <= cutoff;
      }).reduce((sum,c) => sum + Number(c.monto ?? c.monto_real ?? 0),0);
      const flujo = row.flujo == null ? null : row.flujo + ajuste;
      accumulated = accumulated == null || flujo == null ? null : accumulated + flujo;
      return {...row, ajuste, flujo, accumulated, realIngreso, realEgreso};
    });
  }, [forecast, ajustes, estadosPago, costos, liquidaciones, cutoff]);
  const totals = rows.reduce((acc, row) => ({ ingreso: acc.ingreso + row.ingreso, egreso: acc.egreso == null || row.egreso == null ? null : acc.egreso + row.egreso, flujo: acc.flujo == null || row.flujo == null ? null : acc.flujo + row.flujo }), { ingreso: 0, egreso: 0, flujo: 0 });
  const submit = async event => { event.preventDefault(); const amount = Number(form.monto); if (!form.periodo || !amount || !form.descripcion.trim()) return; const next = [...ajustes, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...form, monto: amount, creado_por: user?.nombre || user?.email || 'Usuario autorizado', created_at: new Date().toISOString() }]; if (await saveAjustes(next)) setForm(current => ({ ...current, monto: '', descripcion: '' })); };

  return <div className="space-y-4"><section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><div className="rounded-xl bg-emerald-700 p-2.5 text-white"><WalletCards className="h-5 w-5" /></div><div><h3 className="text-sm font-black text-emerald-950">Flujo de caja de la obra · CLP</h3><p className="mt-1 text-[11px] text-emerald-900">Venta ejecutada más saldo proyectado según programación y tendencia de los últimos cinco días laborables cerrados. Cada mes se estima hasta su último día; no representa cobros confirmados.</p>{budgetCurrency === 'UF' && <p className={`mt-1 text-[10px] font-bold ${ufRate.error ? 'text-rose-700' : 'text-emerald-800'}`}>{ufRate.loading ? 'Consultando UF vigente…' : ufRate.error ? `No se pudo obtener la UF: ${ufRate.error}. La proyección presupuestaria queda pendiente.` : `Presupuesto en UF convertido a CLP: 1 UF = ${money(ufRate.value)} · ${ufRate.date} · ${ufRate.source}`}</p>}</div></div><span className={`rounded-xl px-3 py-2 text-xs font-black ${totals.flujo >= 0 ? 'bg-white text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>Saldo proyectado: {money(totals.flujo)}</span></div></section>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Ingresos proyectados" value={totals.ingreso} color="emerald" /><Metric label="Egresos proyectados" value={totals.egreso} color="rose" /><Metric label="Caja acumulada final" value={rows.at(-1)?.accumulated} color={rows.at(-1)?.accumulated >= 0 ? 'blue' : 'rose'} /></div>
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[880px] w-full text-left text-xs"><thead className="bg-slate-900 text-white"><tr><th className="p-3">Mes</th><th className="p-3 text-right">Ingresos</th><th className="p-3 text-right">Egresos</th><th className="p-3 text-right">Ajustes</th><th className="p-3 text-right">Flujo neto</th><th className="p-3 text-right">Caja acumulada</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="p-8 text-center text-slate-500">Calculando flujo de caja…</td></tr> : rows.map(row => <tr key={row.key} className="border-t border-slate-100"><td className="p-3 font-black capitalize text-slate-800">{monthLabel(row.key)}<div className="mt-1 text-[10px] font-normal">Cierre: {row.close}</div>{(row.realIngreso || row.realEgreso) ? <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700">con registros reales</span> : null}</td><td className="p-3 text-right text-emerald-700">{money(row.ingreso)}<div className="mt-1 text-[10px] text-slate-500">Ejecutado: {money(row.ejecutado)} · EP aprobados: {money(row.realIngreso)}</div></td><td className="p-3 text-right text-rose-700">{money(row.egreso)}<div className="mt-1 text-[10px] text-slate-500">Costo registrado al corte: {money(row.realEgreso)}</div></td><td className={`p-3 text-right ${row.ajuste < 0 ? 'text-rose-700' : 'text-blue-700'}`}>{row.ajuste ? money(row.ajuste) : '—'}</td><td className={`p-3 text-right font-black ${row.flujo >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>{money(row.flujo)}</td><td className={`p-3 text-right font-black ${row.accumulated >= 0 ? 'text-slate-800' : 'text-rose-700'}`}>{money(row.accumulated)}</td></tr>)}</tbody></table></section>
    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600"><b>Costos proyectados:</b> venta mensual × (1 − margen proyectado de Control de costos). Margen al {cutoff}: {Number.isFinite(marginRatio) ? (marginRatio*100).toFixed(1)+'%' : 'No calculable: falta venta programada al corte'}. Los costos registrados y EP se muestran como referencia, sin sumarlos otra vez ni reemplazar el cierre mensual. Los días laborables sin reporte cuentan como cero; sin reportes previos se usa la programación.</p>
    {forecast.warnings.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{forecast.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>}
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Ajuste manual de caja · CLP</h4><p className="mt-1 text-[10px] text-slate-500">Anticipos, pagos no presupuestados, aportes o egresos extraordinarios.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><input required type="month" value={form.periodo} onChange={event => setForm({ ...form, periodo: event.target.value })} className="rounded-lg border border-slate-300 p-2 text-xs" /><select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value })} className="rounded-lg border border-slate-300 p-2 text-xs"><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select><input required min="1" type="number" value={form.monto} onChange={event => setForm({ ...form, monto: event.target.value })} placeholder="Monto CLP" className="rounded-lg border border-slate-300 p-2 text-xs" /><input required value={form.descripcion} onChange={event => setForm({ ...form, descripcion: event.target.value })} placeholder="Descripción" className="rounded-lg border border-slate-300 p-2 text-xs" /></div><button disabled={saving} className="mt-3 flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"><Plus className="h-3.5 w-3.5" />{saving ? 'Guardando…' : 'Agregar ajuste'}</button></form><section className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Ajustes registrados</h4><div className="mt-3 space-y-2">{ajustes.length ? ajustes.slice().reverse().map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2 text-xs"><div><b className={item.tipo === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'}>{item.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {money(item.monto)}</b><p className="mt-0.5 text-slate-600">{item.periodo} · {item.descripcion}</p></div><button type="button" onClick={() => saveAjustes(ajustes.filter(current => current.id !== item.id))} className="rounded p-1 text-rose-600 hover:bg-rose-50" title="Eliminar ajuste"><Trash2 className="h-4 w-4" /></button></div>) : <p className="text-xs text-slate-500">Aún no hay ajustes manuales.</p>}</div></section></section>
  </div>;
}

function Metric({ label, value, color }) { const tones = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800', rose: 'border-rose-200 bg-rose-50 text-rose-800', blue: 'border-blue-200 bg-blue-50 text-blue-800' }; const Icon = color === 'rose' ? ArrowDownRight : ArrowUpRight; return <div className={`rounded-xl border p-3 ${tones[color] || tones.blue}`}><div className="flex items-center gap-1 text-[10px] font-bold uppercase"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-1 text-lg font-black">{money(value)}</p></div>; }
