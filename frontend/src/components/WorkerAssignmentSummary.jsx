import React from 'react';
import {workerAssignmentDestinations} from '../utils/workerCenters';

export default function WorkerAssignmentSummary({worker,centers,assignments}){
  const destinations=workerAssignmentDestinations(worker,centers,assignments);
  if(!destinations.length)return <span className="block text-xs text-slate-500">Sin centros asignados</span>;
  return <div className="mt-1 flex flex-wrap gap-1">{destinations.map(destination=><span key={destination.key} className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-900">
    {destination.name}{destination.primary&&<strong className="ml-1">· Principal</strong>}
    {destination.start&&<small className="block text-slate-500">Desde {destination.start}{destination.end?` · hasta ${destination.end}`:''}</small>}
  </span>)}</div>;
}
