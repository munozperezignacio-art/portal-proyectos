import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.soft}}}/></AuthProvider></SafeAreaProvider>;
}
