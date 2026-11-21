export function activityMinutes(row){
 const parse=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):v==='24:00'?1440:NaN;
 return parse(row.termino)-parse(row.inicio);
}
export function validateActivities(rows){
 let end='';
 for(const row of [...rows].sort((a,b)=>a.inicio.localeCompare(b.inicio))){
  if(!row.actividad.trim())throw Error('Completa el nombre de cada actividad.');
  if(!(activityMinutes(row)>0)||row.inicio<end)throw Error('Revisa los horarios: término posterior al inicio y sin superponer actividades.');
  end=row.termino;
 }
 return rows;
}
export function activityText(rows){return [...rows].sort((a,b)=>a.inicio.localeCompare(b.inicio)).map(r=>`- ${r.inicio} - ${r.termino} ${r.actividad}`).join('\n');}
export function progressDate(r){return r.fecha||r.fecha_avance||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.created_at));}
export function dailyProgressMessage(work,date,rows,reports,notes=''){
 const day=reports.filter(r=>progressDate(r)===date);
 return `Reporte de avance · ${work}\n${date.split('-').reverse().join('-')}\n\nActividades del día:\n${activityText(rows)}\n\nAvance del día:\n${day.map(r=>`- ${r.partida}: ${r.cantidad} ${r.unidad||''}`).join('\n')||'Sin avance cuantificado registrado.'}\n\nObservaciones:\n${notes.trim()||[...new Set(day.map(r=>r.observaciones).filter(Boolean))].join('\n')||'Sin observaciones.'}`;
}
