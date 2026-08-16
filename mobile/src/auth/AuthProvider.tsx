import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthValue = { session: Session | null; profile: Profile | null; loading: boolean; locked:boolean; biometricAvailable:boolean; biometricEnabled:boolean; biometricOfferPending:boolean; unlock:()=>Promise<boolean>; setBiometricEnabled:(enabled:boolean)=>Promise<boolean>; dismissBiometricOffer:()=>Promise<void>; signIn: (u:string,e:string,p:string)=>Promise<void>; signOut:()=>Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);
const fields = 'id,usuario,empresa,rol,rol_base,obras,modulos,correo,submenus,nombre,cargo,auth_user_id,permisos';
const BIOMETRIC_KEY = 'obraxis_biometric_enabled';
const BIOMETRIC_ASKED_KEY = 'obraxis_biometric_asked';

async function loadProfile(session: Session, company?: string) {
  let query = supabase.from('usuarios').select(fields).eq('auth_user_id', session.user.id).limit(1);
  if (company) query = query.ilike('empresa', company.trim());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tu cuenta no tiene un perfil activo para esta empresa.');
  const { data: role } = await supabase.from('roles').select('permisos').eq('empresa', data.empresa).eq('nombre', data.rol || data.rol_base || '').maybeSingle();
  return { ...data, permisos: { ...(role?.permisos || {}), ...(data.permisos || {}) } } as Profile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricOfferPending, setBiometricOfferPending] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(BIOMETRIC_KEY), AsyncStorage.getItem(BIOMETRIC_ASKED_KEY), LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(async ([{ data }, preference, asked, hardware, enrolled]) => {
      if (!active) return;
      const available = hardware && enrolled;
      const enabled = preference === 'true' && available;
      setBiometricAvailable(available); setBiometricEnabledState(enabled);
      setSession(data.session);
      if (data.session) try { setProfile(await loadProfile(data.session)); } catch { await supabase.auth.signOut(); }
      if (data.session && enabled) setLocked(true);
      setBiometricOfferPending(Boolean(data.session && available && asked !== 'true' && preference === null));
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setProfile(null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const unlock = async () => {
    if (!biometricEnabled) { setLocked(false); return true; }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Acceder a Obraxis', cancelLabel: 'Cancelar', fallbackLabel: 'Usar clave del dispositivo', disableDeviceFallback: false });
    if (result.success) setLocked(false);
    return result.success;
  };
  const setBiometricEnabled = async (enabled:boolean) => {
    if (enabled && !biometricAvailable) return false;
    if (enabled) {
      const verified = await LocalAuthentication.authenticateAsync({ promptMessage: 'Activar acceso biométrico', cancelLabel: 'Cancelar', disableDeviceFallback: false });
      if (!verified.success) return false;
    }
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(enabled));
    await AsyncStorage.setItem(BIOMETRIC_ASKED_KEY, 'true');
    setBiometricOfferPending(false);
    setBiometricEnabledState(enabled); setLocked(false);
    return true;
  };
  const dismissBiometricOffer = async () => {
    await AsyncStorage.setItem(BIOMETRIC_ASKED_KEY, 'true');
    setBiometricOfferPending(false);
  };
  const signIn = async (usuario:string, empresa:string, password:string) => {
    const { data, error } = await supabase.functions.invoke('login-usuario', { body: { usuario: usuario.trim(), empresa: empresa.trim(), password } });
    if (error || data?.error || !data?.access_token) throw new Error(data?.error || 'Usuario, empresa o contraseña incorrectos.');
    const result = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (result.error || !result.data.session) throw new Error('No fue posible iniciar la sesión segura.');
    const nextProfile = await loadProfile(result.data.session, empresa);
    setSession(result.data.session); setProfile(nextProfile);
    const [asked, preference, hardware, enrolled] = await Promise.all([AsyncStorage.getItem(BIOMETRIC_ASKED_KEY), AsyncStorage.getItem(BIOMETRIC_KEY), LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    setBiometricOfferPending(Boolean(hardware && enrolled && asked !== 'true' && preference === null));
  };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setLocked(false); };
  const value = { session, profile, loading, locked, biometricAvailable, biometricEnabled, biometricOfferPending, unlock, setBiometricEnabled, dismissBiometricOffer, signIn, signOut };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider no disponible'); return value; };
