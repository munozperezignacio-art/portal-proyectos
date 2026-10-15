import React from 'react';
import { chileanAttendanceToday } from '../utils/attendanceDates';
export default function AttendanceDateField({ mode, value, onChange }) {
  if (mode !== 'manual') return <p className="text-xs text-slate-500">Fecha de marcaje QR: {chileanAttendanceToday().split('-').reverse().join('/')} (hoy, Chile).</p>;
  return <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3"><label className="block text-[10px] font-bold uppercase text-slate-600">Fecha del marcaje manual<input aria-label="Fecha del marcaje manual" required type="date" max={chileanAttendanceToday()} value={value} onChange={event=>onChange(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800"/></label><p className="mt-1 text-[10px] text-slate-500">Selecciona el día trabajado. La fecha y hora de ingreso del registro se conservan por separado.</p></div>;
}
