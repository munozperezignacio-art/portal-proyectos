import React from 'react';
import {calculateScheduledAttendance} from '../utils/weeklyWorkSchedule';
export default function AttendanceHoursField({value,data,day}) {
  let hours=null;try{hours=calculateScheduledAttendance(data,day,value);}catch{}
  return <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2"><p className="text-xs font-bold">Jornada aplicada: {day ? day.active ? `${day.start}–${day.end}${day.breakStart ? ` · Colación ${day.breakStart}–${day.breakEnd}` : ''}` : 'Sin jornada ordinaria' : `${value} h (base anterior, sin horario semanal)`}</p><p className="text-[10px] text-slate-500">Se configura en «Jornada semanal», junto a «Registrar marcaje». Las HE calculadas requieren aprobación.</p>{hours && <p className="text-xs font-bold text-indigo-950">Trabajadas: {hours.worked} h · Ordinarias: {hours.ordinary} h · Extras calculadas: {hours.extra} h</p>}</div>;
}
