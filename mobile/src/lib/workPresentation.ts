type WorkInfo = { estado?: string | null; tipo?: string | null; area?: string | null; cliente?: string | null };

export function workStatus(work: WorkInfo): { label: string; tone: 'green' | 'amber' | 'blue' } {
  const value = work.estado?.trim() || 'Activa';
  const states: Record<string, string> = {
    activa: 'Activa', 'en pausa': 'En pausa', 'en cierre': 'En cierre',
    terminada: 'Terminada', archivada: 'Archivada',
  };
  const key = value.toLocaleLowerCase('es-CL');
  return { label: states[key] || value, tone: key === 'activa' ? 'green' : ['terminada', 'archivada'].includes(key) ? 'blue' : 'amber' };
}

export function workDescription(work: WorkInfo) {
  return [work.tipo?.trim() || work.area?.trim() || 'Obra', work.cliente?.trim()].filter(Boolean).join(' \u00b7 ');
}
