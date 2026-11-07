import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Card, ErrorBox, Header, Loading, Screen } from '@/components/ui';
import { fetchNotificationDetail, markNotificationRead, MobileNotification } from '@/lib/notifications';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [item, setItem] = useState<MobileNotification | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!profile) return;
    setItem(null); setError('');
    fetchNotificationDetail(profile.id, Number(id)).then(value => {
      if (!active) return;
      setItem(value);
      void markNotificationRead(profile.id, value.id).catch(() => undefined);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'No fue posible abrir el aviso.'); });
    return () => { active = false; };
  }, [id, profile?.id]);
  const workId = Number(item?.payload?.obra_id);
  return <Screen><Pressable onPress={() => router.back()}><Text style={{ color: colors.ink, marginBottom: 16 }}>← Volver</Text></Pressable>
    <Header title={item?.asunto || 'Detalle de notificación'} subtitle={item?.obra_nombre || ''} icon="notifications-outline" />
    <ErrorBox text={error} />{!item && !error ? <Loading /> : null}
    {item ? <Card><Text style={{ color: colors.ink, lineHeight: 24 }}>{String(item.payload?.detalle || 'Revisa la información de este aviso en la obra.')}</Text>
      <Text style={{ color: colors.muted, marginTop: 12 }}>{new Date(item.created_at).toLocaleString('es-CL')}</Text>
      {Number.isSafeInteger(workId) && workId > 0 ? <Pressable onPress={() => router.push({ pathname: '/obra/[id]', params: { id: String(workId), nombre: item.obra_nombre || '', especialidad:item.payload?.sesion_id?'1':undefined } })} style={{ paddingVertical: 18 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>Abrir obra →</Text></Pressable> : null}
    </Card> : null}
  </Screen>;
}
