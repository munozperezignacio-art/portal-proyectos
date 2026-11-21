// Shared by payroll and Excel exports. A missing denominator is not zero pay.
export function workedDaysProration(amount, includedDays, periodDays) {
  if (!Number.isInteger(periodDays) || periodDays <= 0) throw new Error('No hay días trabajados registrados en el período.');
  if (!Number.isInteger(includedDays) || includedDays < 0 || includedDays > periodDays) throw new Error('Revisa los días trabajados del rango y del período.');
  return Math.round(Number(amount) * includedDays / periodDays);
}
