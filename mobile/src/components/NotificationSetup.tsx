import { useEffect } from 'react';
import { configureNotifications } from '@/lib/notifications';
export function NotificationSetup(){useEffect(()=>{void configureNotifications()},[]);return null}
