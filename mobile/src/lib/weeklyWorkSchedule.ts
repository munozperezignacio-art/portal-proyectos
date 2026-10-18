import { calculateAttendanceHours } from './attendanceHours';
type Row = Record<string, any>;
export const WEEK_DAYS = [[1,'Lunes'],[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado'],[0,'Domingo']];
const minutes=(value: string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || ''))throw new Error('Indica horarios válidos.');const [h,m]=value.split(':').map(Number);return h*60+m;};
const overlap=(a: number,b: number,c: number,d: number)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
export function validateWeeklySchedule(schedule: Row) {
  for(const [key,label] of WEEK_DAYS) {
    const day=schedule?.[key]; if(!day || typeof day.active!=='boolean')throw new Error(`Falta configurar ${label}.`);
    if(!day.active)continue;
    const start=minutes(day.start),end=minutes(day.end);
    if(end<=start)throw new Error(`${label}: la salida debe ser posterior a la entrada. Esta configuración admite jornadas dentro del mismo día.`);
    if(day.breakStart || day.breakEnd){const a=minutes(day.breakStart),b=minutes(day.breakEnd);if(a<start || b>end || b<=a)throw new Error(`${label}: la colación debe estar dentro de la jornada.`);}
  }
  return schedule;
}
export function draftWeeklySchedule(work: Row) {
  return work?.jornada_semanal || Object.fromEntries(WEEK_DAYS.map(([key])=>[key,{active:key!==0 && key!==6,start:'08:00',end:'18:00',breakStart:'13:00',breakEnd:'14:00'}]));
}
export function scheduleForDate(work: Row | null,date: string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))return null;
  return work?.jornada_semanal?.[new Date(`${date}T12:00:00Z`).getUTCDay()] || null;
}
export function scheduledDayHours(day: Row | null) {
  if(!day?.active)return 0;
  return (minutes(day.end)-minutes(day.start)-(day.breakStart && day.breakEnd ? minutes(day.breakEnd)-minutes(day.breakStart):0))/60;
}
export function calculateScheduledAttendance(data: Row,day: Row | null,legacyHours=9) {
  if(!day)return calculateAttendanceHours({...data,ordinaryHours:legacyHours,status:data.asistencia});
  if(data.asistencia!=='PRESENTE' || !data.ingreso || !data.salida)return {worked:0,ordinary:0,extra:0};
  const entry=minutes(data.ingreso),exitRaw=minutes(data.salida),exit=exitRaw<entry?exitRaw+1440:exitRaw;
  let worked=exit-entry,ordinary=0;
  if(day.active){
    ordinary=overlap(entry,exit,minutes(day.start),minutes(day.end));
    if(day.breakStart && day.breakEnd){
      const meal=overlap(entry,exit,minutes(day.breakStart),minutes(day.breakEnd));
      ordinary-=meal;if(data.colacion==='SI')worked-=meal;
    }else if(data.colacion==='SI'){worked-=60;ordinary-=60;}
  }else if(data.colacion==='SI')worked-=60;
  worked=Math.max(0,worked);ordinary=Math.max(0,Math.min(worked,ordinary));
  const round=(n: number)=>Math.round(n/60*100)/100;
  return {worked:round(worked),ordinary:round(ordinary),extra:round(worked-ordinary)};
}
