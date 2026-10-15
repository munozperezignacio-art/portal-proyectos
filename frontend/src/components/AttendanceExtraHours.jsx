import React from 'react';
import { calculateScheduledAttendance } from '../utils/weeklyWorkSchedule';
export default function AttendanceExtraHours({record,onReview}) {
  let expected=null;try{expected=calculateScheduledAttendance(record,record.jornada_aplicada,record.jornada_ordinaria_horas ?? 9).extra;}catch{}
  const stored=Number(record.horas_extras_auto)||0;
  return <div><span>{stored} hrs</span>{expected!=null && Math.abs(expected-stored)>.01 && <div className="mt-1 text-[10px] font-normal text-amber-800">Según horario: {expected} h{onReview && <button type="button" onClick={onReview} className="block font-bold underline">Revisar y recalcular</button>}</div>}</div>;
}
