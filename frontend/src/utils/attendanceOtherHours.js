export function parseOtherHours(value) {
  const hours = value === '' || value == null ? 0 : Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 99999999.99 || Math.abs(hours * 100 - Math.round(hours * 100)) > 0.000001) {
    throw new Error('Otras horas debe ser un número positivo o cero, con hasta 2 decimales.');
  }
  return hours;
}
