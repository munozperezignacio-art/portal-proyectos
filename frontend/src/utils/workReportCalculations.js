const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function matchesWorkReport(report, partida) {
  if (report.partida_id != null && partida.id != null) return String(report.partida_id) === String(partida.id);
  return normalize(report.partida) === normalize(partida.partida);
}

export function reportedProgress(partida, reports) {
  const quantity = Number(partida.cantidad ?? partida.cantidad_presupuestada) || 0;
  const completed = reports.filter(report => matchesWorkReport(report, partida)).reduce((sum, report) => sum + (Number(report.cantidad) || 0), 0);
  return quantity > 0 ? Math.max(0, Math.min(100, completed / quantity * 100)) : 0;
}

export function dailyTimeRate(item) {
  // Una tarifa mensual se prorratea sobre 30 días. La duración aplicada sigue
  // siendo la duración laboral del cronograma de cada partida.
  return (Number(item.tarifa_tiempo_dia) || 0) / (item.periodicidad === 'Mes' ? 30 : 1);
}
