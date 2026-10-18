export function calculateAttendanceHours({ ingreso, salida, colacion, ordinaryHours = 9, status = 'PRESENTE' }: {ingreso?: string; salida?: string; colacion?: string; ordinaryHours?: number | string; status?: string}) {
  const threshold=Number(ordinaryHours);
  if (ordinaryHours === '' || !Number.isFinite(threshold) || threshold<0 || threshold>24) throw new Error('La jornada ordinaria debe estar entre 0 y 24 horas.');
  if (status !== 'PRESENTE' || !ingreso || !salida) return { worked:0, ordinary:0, extra:0 };
  const minutes=(value: string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Hora de ingreso o salida inválida.');const [h,m]=value.split(':').map(Number);return h*60+m;};
  const entry=minutes(ingreso), exit=minutes(salida);
  const total=exit>=entry ? exit-entry : exit+1440-entry;
  const worked=Math.max(0,total-(colacion==='SI'?60:0))/60;
  const round=(n: number)=>Math.round((n+Number.EPSILON)*100)/100;
  return {worked:round(worked),ordinary:round(Math.min(worked,threshold)),extra:round(Math.max(0,worked-threshold))};
}
