import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ProjectAlertNotifications({ company, workId, cutoff, enabled, alerts }) {
  const [error, setError] = useState('');
  const sent = useRef('');
  const snapshot = JSON.stringify(alerts);
  useEffect(() => {
    if (!enabled || !workId || !company) return;
    const key = `${company}:${workId}:${cutoff}:${snapshot}`;
    if (sent.current === key || snapshot === '[]') return;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await supabase.rpc('sync_work_alerts', { p_company: company, p_work: workId, p_cutoff: cutoff, p_alerts: JSON.parse(snapshot) });
      if (!active) return;
      if (result.error) setError('No se pudieron sincronizar las alertas con la campana.');
      else { sent.current = key; setError(''); window.dispatchEvent(new Event('obraxis:notifications')); }
    }, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [company, workId, cutoff, enabled, snapshot]);
  return error ? <p role="alert" className="text-xs text-amber-800">{error}</p> : null;
}
