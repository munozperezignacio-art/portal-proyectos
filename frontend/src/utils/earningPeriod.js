import {workedDaysProration} from './workedDaysProration.js';
export const periodEnd=month=>new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
export function earningDates(reference){
 if(reference?.includes('/'))return reference.split('/');
 if(reference?.length===7)return [reference+'-01',periodEnd(reference)];
 return [reference,reference];
}
export function earningOverlaps(reference,from,to){const [start,end]=earningDates(reference);return Boolean(start&&end&&start<=to&&end>=from);}
const rut=value=>String(value||'').replace(/[^0-9k]/gi,'').toUpperCase();
export function earningForExport(earning,marks,from,to){
 if(!earningOverlaps(earning.date,from,to))return null;
 const [start,end]=earningDates(earning.date),vigencia=`Vigencia: ${start} al ${end}`;
 if(!earning.proportional)return {...earning,note:`${vigencia}. Monto completo`};
 const days=[...new Set(marks.filter(m=>rut(m.rut)&&rut(m.rut)===rut(earning.worker.rut)&&(!earning.workId||String(m.obra_id)===String(earning.workId))&&m.fecha_marcacion>=start&&m.fecha_marcacion<=end&&/^(presente|asisti|trabaj)/i.test(m.asistencia||'')).map(m=>m.fecha_marcacion))];
 if(!days.length)throw Error(`No se puede calcular «${earning.name}» de ${earning.worker.nombre}: no hay días trabajados registrados en su vigencia (${start} al ${end}).`);
 const included=days.filter(d=>d>=from&&d<=to).length;
 return {...earning,amount:workedDaysProration(earning.amount,included,days.length),note:`${vigencia}. Proporcional: ${included}/${days.length} días trabajados; base $${earning.amount}`};
}
