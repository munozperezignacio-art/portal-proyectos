import React,{useState} from 'react';
import {supabase} from '../supabaseClient';
export default function ProtocolReviewAction({workId,kind,protocol,allowed,onSaved}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const reviewed=protocol.revision_revisada===protocol.revision&&!!protocol.revisado_at;
 const review=async()=>{if(!window.confirm('¿Confirmas que revisaste los datos de este borrador?'))return;setBusy(true);setError('');try{const r=await supabase.rpc('protocol_review_api',{p_work:workId,p_kind:kind,p_id:protocol.id,p_revision:protocol.revision});if(r.error)throw r.error;await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="space-y-2"><p className="text-sm text-slate-600">{protocol.estado==='aprobado'?'Protocolo aprobado':reviewed?`Revisado por ${protocol.revisado_por} · ${new Date(protocol.revisado_at).toLocaleString('es-CL')}`:'Pendiente de revisión de esta versión'}</p>{protocol.estado==='borrador'&&!reviewed&&allowed&&<button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" disabled={busy} onClick={review}>Marcar como revisado</button>}{error&&<p role="alert">{error}</p>}</div>;
}
