import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { openNotification, registerMobileNotifications } from '@/lib/notifications';

export function NotificationSetup() {
  const { session, profile } = useAuth();
  const lastOpened = useRef('');
  useEffect(() => {
    if (Platform.OS === 'web' || !session || !profile) return;
    const register = () => void registerMobileNotifications(profile.id).catch(error => console.warn('Notificaciones móviles:', error));
    register();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') register(); });
    const open = (event: Notifications.NotificationResponse) => {
      const id = event.notification.request.identifier;
      if (lastOpened.current === id) return;
      lastOpened.current = id;
      openNotification(event.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync();
    };
    const response = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(last => { if (last) open(last); });
    return () => { response.remove(); foreground.remove(); };
  }, [session?.user.id, profile?.id]);
  return null;
}
