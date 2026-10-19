import { Stack, DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineSync } from '@/components/OfflineSync';
import { NotificationSetup } from '@/components/NotificationSetup';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { BiometricGate } from '@/components/BiometricGate';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><UserTheme/></AuthProvider></SafeAreaProvider>;
}

function UserTheme() {
  const {profile}=useAuth();
  const userKey=profile?`${profile.empresa}:${profile.id}`:'device';
  return <ThemeProvider userKey={userKey}><AppShell/></ThemeProvider>;
}

function AppShell() {
  const {colors,mode,ready}=useTheme();
  const navigationTheme=useMemo(()=>{
    const base=mode==='dark'?DarkTheme:DefaultTheme;
    return {...base,colors:{...base.colors,background:colors.soft,card:colors.surface,text:colors.ink,border:colors.line,primary:colors.blue,notification:colors.red}};
  },[mode,colors]);
  return <NavigationThemeProvider value={navigationTheme}><BiometricGate><OfflineSync/><NotificationSetup/><StatusBar style={mode==='dark'?'light':'dark'}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.soft}}}/></BiometricGate>{!ready&&<View style={[StyleSheet.absoluteFill,{backgroundColor:colors.soft,alignItems:"center",justifyContent:"center"}]}><ActivityIndicator color={colors.blue}/></View>}</NavigationThemeProvider>;
}
