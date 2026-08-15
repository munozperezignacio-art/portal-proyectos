import type { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthValue = { session: Session | null; profile: Profile | null; loading: boolean; signIn: (u:string,e:string,p:string)=>Promise<void>; signOut:()=>Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);
const fields = 'id,usuario,empresa,rol,rol_base,obras,modulos,correo,submenus,nombre,cargo,auth_user_id';

async function loadProfile(session: Session, company?: string) {
  let query = supabase.from('usuarios').select(fields).eq('auth_user_id', session.user.id).limit(1);
  if (company) query = query.ilike('empresa', company.trim());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tu cuenta no tiene un perfil activo para esta empresa.');
  return data as Profile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) try { setProfile(await loadProfile(data.session)); } catch { await supabase.auth.signOut(); }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setProfile(null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const signIn = async (usuario:string, empresa:string, password:string) => {
    const { data, error } = await supabase.functions.invoke('login-usuario', { body: { usuario: usuario.trim(), empresa: empresa.trim(), password } });
    if (error || data?.error || !data?.access_token) throw new Error(data?.error || 'Usuario, empresa o contraseña incorrectos.');
    const result = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (result.error || !result.data.session) throw new Error('No fue posible iniciar la sesión segura.');
    const nextProfile = await loadProfile(result.data.session, empresa);
    setSession(result.data.session); setProfile(nextProfile);
  };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); };
  const value = useMemo(() => ({ session, profile, loading, signIn, signOut }), [session, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider no disponible'); return value; };
