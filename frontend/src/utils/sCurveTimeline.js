// UTC avoids skipping or repeating calendar days during daylight-saving changes.
export function calendarTimeline(start, end) {
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const first = parse(start), last = parse(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return [];
  const result = [];
  for (let day = first; day <= last; day += 86400000) {
    const date = new Date(day);
    result.push({ dateStr: date.toISOString().slice(0, 10), label: date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replaceAll('.', '') });
  }
  return result;
}

export function calendarLabelIndices(count, plotWidth, minSpacing = 85) {
  if (count <= 0) return [];
  if (count === 1) return [0];
  // ceil division also reserves room near the final day: no adjacent end labels.
  const step = Math.max(1, Math.ceil((count - 1) / Math.max(1, Math.floor(plotWidth / minSpacing))));
  const indices = [0];
  for (let i = step; i < count - 1; i += step) indices.push(i);
  if (indices.length > 1 && (count - 1 - indices.at(-1)) * plotWidth / (count - 1) < minSpacing) indices.pop();
  indices.push(count - 1);
  return indices;
}
