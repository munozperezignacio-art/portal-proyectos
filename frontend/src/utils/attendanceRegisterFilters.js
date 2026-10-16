import {attendanceDay,sortAttendanceRecords} from './attendanceDates.js';
const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function filterAttendanceRegister(records,{date='',person=''}={}) {
  const query=normalize(person);
  const rutQuery=/^[\d.kK\s-]+$/.test(query) && /\d/.test(query)?query.replace(/[^\dk]/g,''):'';
  return sortAttendanceRecords(records.filter(record=>(!date || attendanceDay(record)===date) && (!query
    || normalize(record.trabajador).includes(query)
    || normalize(record.rut).includes(query)
    || (rutQuery && normalize(record.rut_normalizado || record.rut).replace(/[^\dk]/g,'').includes(rutQuery)))));
}
