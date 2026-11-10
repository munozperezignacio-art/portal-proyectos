import {attendanceDay,sortAttendanceRecords} from './attendanceDates.js';
const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function filterAttendanceRegister(records,{date='',person='',from='',to='',state='',extra='',validation=''}={}) {
  const query=normalize(person);
  const rutQuery=/^[\d.kK\s-]+$/.test(query) && /\d/.test(query)?query.replace(/[^\dk]/g,''):'';
  return sortAttendanceRecords(records.filter(record=>(!from || attendanceDay(record)>=from) && (!to || (!!attendanceDay(record)&&attendanceDay(record)<=to)) && (!state || record.asistencia===state) && (!extra || (Number(record.horas_extras_auto)>0)===(extra==='Con horas extra')) && (!validation || Boolean(record.verificado_qr)===(validation==='QR/GPS')) && (!date || attendanceDay(record)===date) && (!query
    || normalize(record.trabajador).includes(query)
    || normalize(record.rut).includes(query)
    || (rutQuery && normalize(record.rut_normalizado || record.rut).replace(/[^\dk]/g,'').includes(rutQuery)))));
}
