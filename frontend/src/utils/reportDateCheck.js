export function previousReportDay(date) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'') || !Number.isFinite(Date.parse(date+'T12:00:00Z')))throw Error('Selecciona una fecha válida.');
 return new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
}
export function reportDateMessage(date,previousExists,equipment) {
 const format=d=>d.split('-').reverse().join('/');
 const previous=previousReportDay(date);
 return `${equipment || 'Equipo'} · Fecha del reporte: ${format(date)}. `+(previousExists===false?`No hay reporte para el día anterior (${format(previous)}). `:previousExists==null?'No se pudo comprobar el reporte del día anterior. ':'')+`¿Confirmas que la fecha ${format(date)} es correcta?`;
}
