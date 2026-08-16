import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { openNotification, registerMobileNotifications } from '@/lib/notifications';

export function NotificationSetup() {
  const { session, profile } = useAuth();
  useEffect(() => {
    if (!session || !profile) return;
    void registerMobileNotifications(profile.id).catch(error => console.warn('Notificaciones móviles:', error));
    const response = Notifications.addNotificationResponseReceivedListener(event => openNotification(event.notification.request.content.data));
    void Notifications.getLastNotificationResponseAsync().then(last => { if (last) openNotification(last.notification.request.content.data); });
    return () => response.remove();
  }, [session, profile]);
  return null;
}
