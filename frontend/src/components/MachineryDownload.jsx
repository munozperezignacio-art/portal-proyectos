import { useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { readMachineryExport, downloadMachinery } from '../utils/machineryExports';

export default function MachineryDownload({ company, equipmentId, workName, reportId, allowed = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!allowed) return null;
  const download = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await readMachineryExport(supabase, { company, equipmentId, workName, reportId });
      await downloadMachinery(data, reportId ? 'pdf' : 'xlsx');
    } catch (e) { setError(e.message || 'No se pudo descargar. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  return <span className="inline-flex flex-col items-start gap-1"><button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50" aria-label={reportId ? `Descargar PDF del reporte ${reportId}` : 'Descargar historial del equipo en Excel'}><Download className="h-4 w-4" />{busy ? 'Preparando…' : reportId ? 'PDF' : 'Historial Excel'}</button>{error && <span role="alert" className="max-w-xs text-xs text-red-700">{error}</span>}</span>;
}
