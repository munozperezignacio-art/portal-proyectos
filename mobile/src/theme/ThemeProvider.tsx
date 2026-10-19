import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from '@/lib/theme';
import { loadThemePreference, resolveThemeMode, saveThemePreference, type ThemeMode, type ThemePreference } from '@/lib/themePreference';

type ThemeValue = { colors:ThemeColors; mode:ThemeMode; preference:ThemePreference; ready:boolean; setPreference:(value:ThemePreference)=>Promise<void> };
const ThemeContext = createContext<ThemeValue|null>(null);

export function ThemeProvider({userKey,children}:PropsWithChildren<{userKey:string}>) {
  const system = useColorScheme();
  const scope = useRef(userKey);
  const [saved,setSaved] = useState<{key:string;preference:ThemePreference}|null>(null);
  const ready = saved?.key === userKey;
  const preference = ready ? saved!.preference : 'automatic';
  const mode = resolveThemeMode(preference,system);
  const colors = mode === 'dark' ? darkColors : lightColors;
  useEffect(()=>{
    scope.current=userKey;
    let active = true;
    loadThemePreference(AsyncStorage,userKey)
      .then(value=>{if(active)setSaved({key:userKey,preference:value});})
      .catch(()=>{if(active)setSaved({key:userKey,preference:'automatic'});});
    return ()=>{active=false;};
  },[userKey]);
  useEffect(()=>{
    if(ready && Platform.OS !== 'web') Appearance.setColorScheme(preference === 'automatic' ? 'unspecified' : preference);
  },[preference,ready]);
  useEffect(()=>{void SystemUI.setBackgroundColorAsync(colors.soft).catch(()=>undefined);},[colors.soft]);
  const value = useMemo<ThemeValue>(()=>({colors,mode,preference,ready,setPreference:async(next)=>{
    const key=userKey;
    await saveThemePreference(AsyncStorage,key,next);
    if(scope.current===key)setSaved({key,preference:next});
  }}),[colors,mode,preference,ready,userKey]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme=useContext(ThemeContext);
  if(!theme)throw new Error('Tema de la app no disponible.');
  return theme;
}

export function useThemedStyles<T>(factory:(colors:ThemeColors)=>T):T {
  const {colors}=useTheme();
  return useMemo(()=>factory(colors),[colors,factory]);
}
