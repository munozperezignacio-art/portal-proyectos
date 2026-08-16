import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';

const REMEMBER_KEY = 'obraxis_remember_session';
const authStorage = {
  getItem(key) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  },
  setItem(key, value) {
    if (localStorage.getItem(REMEMBER_KEY) === 'true') {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
};

export const setSessionPersistence = remember => {
  if (remember) localStorage.setItem(REMEMBER_KEY, 'true');
  else localStorage.removeItem(REMEMBER_KEY);
};

export const isSessionRemembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
