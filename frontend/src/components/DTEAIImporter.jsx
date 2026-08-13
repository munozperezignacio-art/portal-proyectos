import React, { useRef, useState } from 'react';
import { FileSearch, Loader2, UploadCloud } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function DTEAIImporter({ empresa, onExtracted }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const analyze = async file => {
    if (!file) return;
    setError(''); setResult(null);
    if (!ALLOWED.includes(file.type)) return setError('Usa un archivo PDF, JPG, PNG o WEBP.');
    if (file.size > 10 * 1024 * 1024) return setError('El archivo supera el máximo de 10 MB.');
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('leer-dte-ia', { body: {
        empresa,
        file_name: file.name,
        mime_type: file.type,
        file_base64: await toBase64(file),
      }});
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setResult(data.data);
      onExtracted(data.data);
    } catch (issue) {
      setError(issue?.message || 'No fue posible leer el documento.');
    } finally { setLoading(false); }
  };

  return <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><FileSearch className="mt-0.5 h-5 w-5 text-blue-700"/><div><h4 className="text-sm font-black text-slate-900">Importar DTE con IA</h4><p className="text-xs text-slate-600">Carga una factura, guía o nota recibida. Revisa los datos antes de guardar.</p></div></div>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={e => analyze(e.target.files?.[0])}/>
      <button type="button" disabled={loading} onClick={() => inputRef.current?.click()} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UploadCloud className="h-4 w-4"/>}{loading ? 'Leyendo documento…' : 'Seleccionar archivo'}</button>
    </div>
    {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
    {result && <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3 text-xs text-slate-700"><b>Lectura aplicada · confianza {Math.round(Number(result.confianza || 0) * 100)}%</b>{result.advertencias?.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{result.advertencias.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div>}
  </section>;
}
