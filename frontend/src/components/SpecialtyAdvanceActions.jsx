import React from 'react';
import {Plus} from 'lucide-react';
import {configuredAdvanceParts} from '../utils/specialtyAdvance';
export default function SpecialtyAdvanceActions({workId,parts,history,mode,onChange}){
 if(String(history?.workId)!==String(workId)||!configuredAdvanceParts(parts,history?.settings,history?.elements||[]).length)return null;
 return <>{[['especialidad','Ejecución',history.can_execute],['topografia','Topografía',history.can_topography]].filter(([, ,allowed])=>allowed===true).map(([value,label])=><button key={value} type="button" aria-expanded={mode===value} onClick={()=>onChange(mode===value?'registro':value)} className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs"><Plus className="w-4 h-4"/>Pilas de grava · {label}</button>)}</>;
}
