import React from 'react';

export default function DocumentAuditTrail({ records = [], title = 'Registro de firmas y acciones' }) {
  const items = Array.isArray(records) ? records : [];
  return <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-xs font-black text-slate-800">{title}</h4><span className="text-[10px] font-bold text-slate-500">Sistema Obraxis</span></div>
    {items.length ? <div className="space-y-2">{items.map((item, index) => <div key={`${item.fecha_hora || index}-${index}`} className="border-t border-slate-100 pt-2 text-[11px] text-slate-600 first:border-t-0 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-slate-800">{item.accion || 'Acción registrada'}</b><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">{item.estado || 'Registrado'}</span></div><p className="mt-1"><b>{item.nombre || 'No informado'}</b> · RUT: {item.rut || 'No informado'} · {item.cargo || 'Sin cargo'} · {item.empresa || 'Sin empresa'}</p><p>{item.fecha_hora ? new Date(item.fecha_hora).toLocaleString('es-CL') : 'Fecha no informada'} · {item.medio || 'Sistema Obraxis'}</p>{item.comentario && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-slate-700">{item.comentario}</p>}</div>)}</div> : <p className="text-[11px] text-slate-500">Aún no hay acciones registradas.</p>}
  </section>;
}
