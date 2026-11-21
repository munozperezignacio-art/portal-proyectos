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
import {progressShareMessage} from './progressShare.mjs';
export function progressEntries(parts,reports){
 const norm=s=>String(s||'').trim().toLocaleLowerCase();
 const entries=parts.filter(p=>!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)).map(part=>({part,history:reports.filter(r=>r.partida_id!=null?String(r.partida_id)===String(part.id):norm(r.partida)===norm(part.partida)&&parts.filter(p=>norm(p.partida)===norm(part.partida)).length===1)}));
 const matched=new Set(entries.flatMap(e=>e.history));
 for(const r of reports.filter(r=>!matched.has(r))){let e=entries.find(e=>e.legacy===norm(r.partida));if(!e){e={part:{partida:r.partida,unidad:r.unidad},history:[],legacy:norm(r.partida)};entries.push(e);}e.history.push(r);}
 return entries;
}
export function dailyProgressMessage(work,date,rows,reports,notes,parts=[]){return progressShareMessage(work,date,activityText(rows),progressEntries(parts,reports),notes);}
