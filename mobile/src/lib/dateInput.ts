export function validInputDate(value:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
}
export function calendarMonth(value:string) {
  const d=validInputDate(value)?new Date(`${value}T12:00:00`):new Date();
  return new Date(d.getFullYear(),d.getMonth(),1,12);
}
export function calendarCells(month:Date):(string|null)[] {
  const year=month.getFullYear(),m=month.getMonth();
  const prefix=(new Date(year,m,1,12).getDay()+6)%7;
  const days=new Date(year,m+1,0,12).getDate();
  return Array.from({length:Math.ceil((prefix+days)/7)*7},(_,i)=>i<prefix||i>=prefix+days?null:`${year}-${String(m+1).padStart(2,'0')}-${String(i-prefix+1).padStart(2,'0')}`);
}
