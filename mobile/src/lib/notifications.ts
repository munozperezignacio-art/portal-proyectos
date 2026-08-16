import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const MAINTENANCE_KEY = 'obraxis:notification:maintenance';
const DEVICE_KEY = 'obraxis:notification:device-id';
export type MobileNotification = { id:number; evento_codigo:string; obra_nombre?:string; asunto?:string; payload?:Record<string,unknown>; created_at:string; leida_at?:string|null };

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

async function deviceId() {
  const stored = await AsyncStorage.getItem(DEVICE_KEY); if (stored) return stored;
  const value = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_KEY, value); return value;
}

export async function configureNotifications() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('operacion', { name: 'Operación Obraxis', description: 'Alertas operacionales configuradas por tu empresa.', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], lightColor: '#F47A0B', sound: 'default' });
  const current = await Notifications.getPermissionsAsync();
  return current.status === 'granted' ? current : Notifications.requestPermissionsAsync();
}

export async function registerMobileNotifications(profileId: string | number) {
  if (!Device.isDevice) return { registered: false, reason: 'simulator' };
  const permission = await configureNotifications(); if (permission.status !== 'granted') return { registered: false, reason: 'permission' };
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return { registered: false, reason: 'project' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { data, error } = await supabase.functions.invoke('notificaciones-moviles', { body: { action: 'register', perfil_id: profileId, expo_push_token: token, dispositivo_id: await deviceId(), plataforma: Platform.OS, app_version: Constants.nativeAppVersion || Constants.expoConfig?.version || '' } });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'No fue posible registrar las notificaciones.');
  return { registered: true };
}

export async function unregisterMobileNotifications(profileId: string | number) {
  await supabase.functions.invoke('notificaciones-moviles', { body: { action: 'unregister', perfil_id: profileId, dispositivo_id: await deviceId() } });
}

export async function fetchNotificationInbox(profileId: string | number) {
  const { data, error } = await supabase.functions.invoke('notificaciones-moviles', { body: { action: 'inbox', perfil_id: profileId } });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'No fue posible cargar las notificaciones.');
  return (data?.data || []) as MobileNotification[];
}

export async function markNotificationRead(profileId: string | number, deliveryId: number) {
  const { data, error } = await supabase.functions.invoke('notificaciones-moviles', { body: { action: 'read', perfil_id: profileId, entrega_id: deliveryId } });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'No fue posible marcar la notificación.');
}

export function openNotification(data?: Record<string, unknown>) {
  const route = typeof data?.route === 'string' ? data.route : '/notificaciones';
  router.push(route as never);
}

export async function scheduleMaintenanceSummary(count:number) {
  const previous = await AsyncStorage.getItem(MAINTENANCE_KEY); if (previous) await Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
  if (!count) { await AsyncStorage.removeItem(MAINTENANCE_KEY); return; }
  const permission = await Notifications.getPermissionsAsync(); if (permission.status !== 'granted') return;
  const when = new Date(Date.now() + 24 * 60 * 60 * 1000); when.setHours(8, 0, 0, 0); if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
  const id = await Notifications.scheduleNotificationAsync({ content: { title: 'Mantenciones por revisar', body: `Hay ${count} equipo${count === 1 ? '' : 's'} con mantención próxima o vencida.`, data: { route: '/maquinaria' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'operacion' } });
  await AsyncStorage.setItem(MAINTENANCE_KEY, id);
}
