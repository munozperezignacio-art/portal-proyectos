import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '../supabaseClient';

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function MachineryMeterAI({ empresa, equipment, previousValue, expectedUnit, onRead }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const analyze = async file => {
    if (!file) return;
    setError(''); setResult(null);
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return setError('Usa una fotografía JPG, PNG o WEBP.');
    if (file.size > 8 * 1024 * 1024) return setError('La fotografía supera el máximo de 8 MB.');
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('leer-medidor-maquinaria-ia', { body: {
        empresa,
        file_name: file.name,
        mime_type: file.type,
        file_base64: await toBase64(file),
        equipo_id: equipment?.id,
        equipo_patente: equipment?.patente,
        equipo_tipo: equipment?.tipo,
        lectura_anterior: Number(previousValue || 0),
        unidad_esperada: expectedUnit,
      }});
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setResult(data.data);
      onRead(data.data);
    } catch (issue) { setError(issue?.message || 'No fue posible leer el medidor.'); }
    finally { setLoading(false); if (inputRef.current) inputRef.current.value=''; }
  };

  return <section className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-slate-900">Lectura inteligente del medidor</p><p className="text-[10px] text-slate-600">Fotografía del tablero · revisión humana obligatoria</p></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event=>analyze(event.target.files?.[0])}/><button type="button" disabled={loading||!equipment} onClick={()=>inputRef.current?.click()} className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Camera className="h-4 w-4"/>}{loading?'Leyendo…':'Tomar foto'}</button></div>
    {error&&<p className="mt-2 rounded-lg bg-rose-50 p-2 text-[10px] font-bold text-rose-700">{error}</p>}
    {result&&<div className={`mt-2 flex items-start gap-2 rounded-lg border p-2 text-[10px] ${result.es_anomalia?'border-amber-300 bg-amber-50 text-amber-900':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{result.es_anomalia?<TriangleAlert className="h-4 w-4 shrink-0"/>:<CheckCircle2 className="h-4 w-4 shrink-0"/>}<div><b>Lectura {Number(result.lectura).toLocaleString('es-CL')} {result.unidad}</b> · confianza {Math.round(Number(result.confianza||0)*100)}%<p>{result.observacion}</p></div></div>}
  </section>;
}
