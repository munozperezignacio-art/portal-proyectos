/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSupabaseList<T>(loader: () => Promise<T[]>, cacheKey = '') {
  const [data, setData] = useState<T[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setData(await loaderRef.current()); } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible cargar la información.'); } finally { setLoading(false); } }, [cacheKey]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
