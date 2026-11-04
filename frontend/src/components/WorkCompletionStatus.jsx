import React from 'react';

export default function WorkCompletionStatus({completion,period,plannedEnd,error}) {
  if(error)return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">No se pudo consultar el término automático: {error}</p>;
  if(!completion)return null;
  const review=completion.estado==='revisar';
  const done=completion.estado==='completada';
  return <section aria-label="Término automático de trabajos" className={`rounded-xl border p-4 text-sm ${review?'border-amber-300 bg-amber-50':done?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'}`}>
    <h4 className="font-bold">{review?'Revisar término: cambió el avance o el alcance':done?'Trabajos terminados al 100%':'Trabajos en ejecución'} · {period?.hasta?`Cierre de cargos configurado: ${period.hasta}`:'Cierre de costos pendiente'}</h4>
    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2"><div><dt className="text-xs text-slate-500">Término real de trabajos · automático</dt><dd className="font-semibold">{completion.fecha_termino||'Pendiente de completar el alcance'}</dd></div><div><dt className="text-xs text-slate-500">Término programado · sin modificar</dt><dd>{plannedEnd||'Sin fecha programada'}</dd></div><div><dt className="text-xs text-slate-500">Partidas completas del alcance actual</dt><dd>{completion.partidas_completas} de {completion.partidas_total}</dd></div></dl>
    <p className="mt-2 text-xs">{review?'Se conserva el término registrado en Bitácora. Revisa los reportes y las partidas antes de cerrar los cargos. ':''}El término físico no bloquea los costos finales. El período de cargos de personal y maquinaria se confirma por separado.</p>
  </section>;
}
