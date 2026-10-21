import { useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { flushPendingWrites, pendingWriteStatus, subscribePendingWrites } from '@/lib/offlineQueue';

export function OfflineSync() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const profileId = profile?.id;
  const company = profile?.empresa;
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [review, setReview] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!profileId || !userId) return;
    let active = true;
    let connected = false;
    let running = false;
    const refresh = async () => {
      try {
        const status = await pendingWriteStatus();
        if (active) { setPending(status.pending); setReview(status.review); }
      } catch { if (active) setError(true); }
    };
    const sync = async () => {
      if (!active || running || !connected) return;
      running = true;
      setError(false);
      try {
        if ((await pendingWriteStatus()).pending) {
          if (!active) return;
          setSyncing(true);
          await flushPendingWrites();
        }
      }
      catch { if (active) setError(true); }
      finally {
        running = false;
        if (active) { setSyncing(false); await refresh(); }
      }
    };
    const unsubscribeQueue = subscribePendingWrites(() => { void refresh(); });
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (!active) return;
      setOnline(connected);
      void refresh();
      void sync();
    });
    // Retry records added during a flush without requiring a network change.
    const timer = setInterval(() => { void sync(); }, 30000);
    return () => { active = false; clearInterval(timer); unsubscribeNetwork(); unsubscribeQueue(); };
  }, [profileId, company, userId]);
  if (!profile || !session || (online && !pending && !review && !error && !syncing)) return null;
  const text = syncing ? 'Sincronizando registros pendientes.'
    : review ? `${review} registro(s) conservado(s) para revisión. No se reenviarán automáticamente.`
    : error ? 'No se pudo sincronizar. Los pendientes se conservaron.'
    : `${online ? 'Pendientes' : 'Sin conexión'} · ${pending} registro(s)`;
  return <View pointerEvents="none" style={[s.banner, { top: insets.top + 6 }]}><Text accessibilityLiveRegion="polite" style={s.text}>{text}</Text></View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({ banner: { position: 'absolute', right: 12, left: 12, zIndex: 9999, backgroundColor: colors.navy, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8, elevation: 8 }, text: { fontSize: 12, fontWeight: '700', color: colors.onPrimary } });
