export const protocolDefaults = values => ({
  graduacion: '3/8" a 1 1/2"', chancado: '> 75%', desgaste: '< 30%',
  finos: '< 5%', criterio_control: '< 5 mm', ...values,
});

export function protocolDayNumber(sessions, sessionId) {
  const day = sessions.find(s => s.id === sessionId)?.fecha;
  const dates = [...new Set(sessions.filter(s => s.estado !== 'abierta').map(s => s.fecha))].sort();
  return day && dates.includes(day) ? String(dates.indexOf(day) + 1) : '';
}
