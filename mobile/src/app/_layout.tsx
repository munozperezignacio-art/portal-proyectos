import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineSync } from '@/components/OfflineSync';
import { NotificationSetup } from '@/components/NotificationSetup';
import { AuthProvider } from '@/auth/AuthProvider';
import { BiometricGate } from '@/components/BiometricGate';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><BiometricGate><OfflineSync/><NotificationSetup/><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.soft}}}/></BiometricGate></AuthProvider></SafeAreaProvider>;
}
