// Closing affects schedule only: financial consumers keep their requested cutoff.
export function scheduleClosing({ cutoff, workId, completion, plannedAt, earnedAt }) {
  const closed = completion?.obra_id === workId && completion.estado === 'completada'
    && /^\d{4}-\d{2}-\d{2}$/.test(completion.fecha_termino || '')
    && completion.fecha_termino <= cutoff;
  const date = closed ? completion.fecha_termino : cutoff;
  const planned = plannedAt(date);
  const earned = earnedAt(date);
  return { date, closed: Boolean(closed), spi: Number.isFinite(planned) && planned > 0 && Number.isFinite(earned) ? earned / planned : null };
}
