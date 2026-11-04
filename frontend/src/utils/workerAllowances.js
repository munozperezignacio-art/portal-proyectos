const monthPattern = /^(19|20|21|22|23|24|25|26|27|28|29)\d{2}-(0[1-9]|1[0-2])$/;
export const allowanceMonth = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
export function validateAllowances(rows = []) {
  if (!Array.isArray(rows) || rows.length > 50) throw new Error('Se permiten hasta 50 asignaciones por trabajador.');
  return rows.map((row,index) => {
    const nombre = String(row.nombre || '').trim();
    const monto = Number(row.monto);
    if (!nombre || nombre.length > 160) throw new Error(`Asignación ${index+1}: ingresa un nombre de hasta 160 caracteres.`);
    if (row.monto === '' || !Number.isSafeInteger(monto) || monto <= 0 || monto > 1000000000) throw new Error(`Asignación ${index+1}: ingresa un monto mensual positivo en pesos, sin decimales.`);
    if (!['imponible','no_imponible'].includes(row.tipo)) throw new Error(`Asignación ${index+1}: selecciona el tipo.`);
    if (!monthPattern.test(row.desde) || (row.hasta && (!monthPattern.test(row.hasta) || row.hasta < row.desde))) throw new Error(`Asignación ${index+1}: revisa los meses de vigencia.`);
    return {nombre,monto,tipo:row.tipo,desde:row.desde,hasta:row.hasta || null};
  });
}
export function allowanceTotals(worker, period, days = 30) {
  const details = (worker?.otras_asignaciones || []).filter(row => row.desde <= period && (!row.hasta || row.hasta >= period))
    .map(row => ({...row,amount:Math.round(Number(row.monto)*Math.max(0,Math.min(30,days))/30)}));
  return {details,taxable:details.filter(r=>r.tipo==='imponible').reduce((s,r)=>s+r.amount,0),nonTaxable:details.filter(r=>r.tipo==='no_imponible').reduce((s,r)=>s+r.amount,0)};
}
