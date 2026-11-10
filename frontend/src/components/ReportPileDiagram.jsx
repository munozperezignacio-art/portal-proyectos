import React from 'react';
import {reportDiagram} from '../../../mobile/src/lib/reportDiagram.mjs';
export default function ReportPileDiagram({history,session}){
 const ref=React.useRef(null);
 const pts=reportDiagram(history.elements,history.sessions,session.partida_id,session.fecha);
 if(!pts.length)return <p>Sin pilas con coordenadas.</p>;
 return <><button type="button" className="font-semibold text-blue-900 underline" onClick={()=>ref.current?.showModal()}>Ver diagrama de pilas</button><dialog ref={ref} className="m-auto max-w-[95vw] rounded-xl p-4"><div className="flex justify-between gap-4"><strong>Pilas ejecutadas · {session.fecha.split('-').reverse().join('-')}</strong><button onClick={()=>ref.current.close()}>Cerrar</button></div><div className="overflow-auto max-w-[88vw] max-h-[72vh]"><svg width="1000" height="680" viewBox="0 0 1000 680" aria-label="Pilas ejecutadas al día del reporte">{pts.map(p=><g key={p.id}><circle cx={p.x} cy={p.y} r="8" stroke="#334b88" fill={p.pending?'none':p.day?'#facc15':'#334b88'}/><text x={p.x} y={p.y} dy=".35em" textAnchor="middle" fontSize="7" fill={p.day||p.pending?'#172554':'white'}>{p.label}</text></g>)}</svg></div><small>Amarillo: ejecutadas ese día · Azul: anteriores · Borde azul: pendientes</small></dialog></>;
}
