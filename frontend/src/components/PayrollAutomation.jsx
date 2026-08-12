import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, FileSpreadsheet, RefreshCw, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { attendanceSummary, calculatePayroll } from '../utils/payrollChile';

const afpCommissionRates = { Habitat: 11.27, Capital: 11.44, Cuprum: 11.44, Modelo: 10.58, PlanVital: 11.16, ProVida: 11.45, Uno: 10.49, 'Sin Previsión': 0 };

const money = value => `$${Number(value || 0).toLocaleString('es-CL')}`;
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function PayrollAutomation({ user, personal, indicadores, onEmit }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [attendance, setAttendance] = useState([]);
  const [novelties, setNovelties] = useState({});
  const [savedItems, setSavedItems] = useState([]);
  const [status, setStatus] = useState('Borrador');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const parameters = useMemo(() => ({ ...indicadores, horasSemanales: indicadores.horasSemanales || 44, afpRates: afpCommissionRates }), [indicadores]);

  const load = async () => {
    setLoading(true); setMessage('');
    const start = `${period}-01T00:00:00`, endDate = new Date(`${period}-01T00:00:00`); endDate.setMonth(endDate.getMonth() + 1);
    const [attendanceResult, runResult] = await Promise.all([
      supabase.from('asistencia_personal').select('*').gte('created_at', start).lt('created_at', endDate.toISOString()),
      supabase.from('rrhh_nominas_mensuales').select('*,rrhh_nomina_items(*)').eq('empresa', user.empresa).eq('periodo', period).maybeSingle()
    ]);
    setAttendance(attendanceResult.data || []);
    if (runResult.data) { setStatus(runResult.data.estado); setSavedItems(runResult.data.rrhh_nomina_items || []); setNovelties(Object.fromEntries((runResult.data.rrhh_nomina_items || []).map(item => [item.trabajador_id, item.novedades || {}]))); }
    else { setStatus('Borrador'); setSavedItems([]); setNovelties({}); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [period, user.empresa]);

  const calculations = useMemo(() => personal.filter(worker => String(worker.estado || 'Activo').toLowerCase() !== 'inactivo').map(worker => calculatePayroll(worker, attendanceSummary(worker, attendance, period), parameters, novelties[worker.id] || {})), [personal, attendance, period, parameters, novelties]);
  const totals = useMemo(() => calculations.reduce((sum, row) => ({ gross: sum.gross + row.totalAssets, legal: sum.legal + row.legalDiscounts, net: sum.net + row.net }), { gross: 0, legal: 0, net: 0 }), [calculations]);
  const setNovelty = (id, key, value) => setNovelties(current => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } }));

  const save = async (close = false) => {
    setMessage('');
    const header = { empresa: user.empresa, periodo: period, estado: close ? 'Cerrada' : 'Borrador', parametros: parameters, total_haberes: totals.gross, total_descuentos: totals.legal, total_liquido: totals.net, generado_por: user.nombre || user.usuario || user.correo, updated_at: new Date().toISOString() };
    const { data: payroll, error } = await supabase.from('rrhh_nominas_mensuales').upsert(header, { onConflict: 'empresa,periodo' }).select().single();
    if (error) { setMessage(error.message); return; }
    await supabase.from('rrhh_nomina_items').delete().eq('nomina_id', payroll.id);
    const items = calculations.map(row => ({ nomina_id: payroll.id, trabajador_id: row.workerId, trabajador_rut: row.rut, trabajador_nombre: row.nombre, obra_nombre: row.obra, cargo: row.cargo, novedades: novelties[row.workerId] || {}, calculo: row, sueldo_liquido: row.net }));
    const itemResult = await supabase.from('rrhh_nomina_items').insert(items);
    if (itemResult.error) { setMessage(itemResult.error.message); return; }
    setStatus(header.estado); setSavedItems(items); setMessage(close ? 'Nómina cerrada y congelada para emisión.' : 'Borrador mensual guardado.');
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-950 to-slate-950 p-5 text-white"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h4 className="text-base font-black">Cálculo mensual automatizado</h4><p className="mt-1 text-xs text-emerald-100">Ficha contractual + asistencia + horas extra + novedades + parámetros previsionales del período.</p></div><div className="flex flex-wrap gap-2"><input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-900"/><button onClick={load} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-black"><RefreshCw className="mr-1 inline h-4 w-4"/>Actualizar</button><span className={`rounded-xl px-3 py-2 text-xs font-black ${status === 'Cerrada' ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950'}`}>{status}</span></div></div></div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total haberes" value={money(totals.gross)}/><Metric label="Descuentos legales" value={money(totals.legal)}/><Metric label="Líquido nómina" value={money(totals.net)} strong/></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[1500px] text-left text-[11px]"><thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-600"><tr><th className="p-3">Trabajador</th><th className="p-3">Asistencia</th><th className="p-3">Días pagados</th><th className="p-3">H. extra</th><th className="p-3">Bonos imponibles</th><th className="p-3">Base</th><th className="p-3">Gratificación</th><th className="p-3">Imponible</th><th className="p-3">AFP</th><th className="p-3">Salud</th><th className="p-3">AFC</th><th className="p-3">Impuesto</th><th className="p-3">Otros desc.</th><th className="p-3">Líquido</th><th className="p-3">Documento</th></tr></thead><tbody className="divide-y divide-slate-100">{calculations.map(row => <tr key={row.workerId} className="hover:bg-slate-50"><td className="p-3"><b>{row.nombre}</b><div className="font-mono text-[9px] text-slate-500">{row.rut} · {row.obra || 'Sin obra'}</div></td><td className="p-3"><b>{row.attendanceRecords}</b> marcas<div className="text-[9px] text-slate-500">{row.absentDays} ausencias</div></td><td className="p-2"><input disabled={status === 'Cerrada'} type="number" min="0" max="30" value={novelties[row.workerId]?.dias_pagados ?? row.paidDays} onChange={e => setNovelty(row.workerId, 'dias_pagados', e.target.value)} className="w-16 rounded-lg border p-2"/></td><td className="p-2"><input disabled={status === 'Cerrada'} type="number" min="0" step="0.5" value={novelties[row.workerId]?.horas_extra ?? row.overtimeHours} onChange={e => setNovelty(row.workerId, 'horas_extra', e.target.value)} className="w-16 rounded-lg border p-2"/></td><td className="p-2"><input disabled={status === 'Cerrada'} type="number" min="0" value={novelties[row.workerId]?.bonos ?? ''} onChange={e => setNovelty(row.workerId, 'bonos', e.target.value)} className="w-24 rounded-lg border p-2"/></td><MoneyCell value={row.base}/><MoneyCell value={row.gratification}/><MoneyCell value={row.taxableGross} bold/><MoneyCell value={row.afp}/><MoneyCell value={row.health}/><MoneyCell value={row.afc}/><MoneyCell value={row.tax}/><td className="p-2"><input disabled={status === 'Cerrada'} type="number" min="0" value={novelties[row.workerId]?.otros_descuentos ?? ''} onChange={e => setNovelty(row.workerId, 'otros_descuentos', e.target.value)} className="w-24 rounded-lg border p-2"/></td><MoneyCell value={row.net} bold green/><td className="p-3"><button onClick={() => onEmit({ ...personal.find(worker => worker.id === row.workerId), payroll: row, periodo: period })} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[9px] font-black text-white">Liquidación</button></td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap justify-end gap-2"><button disabled={loading || status === 'Cerrada'} onClick={() => save(false)} className="rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-black text-slate-800 disabled:opacity-40"><Save className="mr-1 inline h-4 w-4"/>Guardar borrador</button><button disabled={loading || status === 'Cerrada'} onClick={() => save(true)} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Cerrar nómina mensual</button><button disabled={!savedItems.length && status !== 'Cerrada'} className="rounded-xl bg-blue-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><FileSpreadsheet className="mr-1 inline h-4 w-4"/>Emitir planillas</button></div>
    <p className="text-[10px] text-slate-500">El cálculo es un borrador administrativo y debe validarse antes del cierre. La asistencia sin registros se considera mes contractual completo y queda señalada para revisión.</p>
  </div>;
}
function Metric({ label, value, strong }) { return <div className={`rounded-2xl border p-4 ${strong ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="text-[9px] font-black uppercase text-slate-500">{label}</div><div className={`mt-2 text-xl font-black ${strong ? 'text-emerald-900' : 'text-slate-900'}`}>{value}</div></div>; }
function MoneyCell({ value, bold, green }) { return <td className={`p-3 font-mono ${bold ? 'font-black' : 'font-bold'} ${green ? 'text-emerald-800' : ''}`}>{money(value)}</td>; }
