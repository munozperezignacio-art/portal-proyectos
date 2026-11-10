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

let rolePreviewReadOnly=false;
export const setRolePreviewReadOnly=value=>{rolePreviewReadOnly=Boolean(value);};
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global:{fetch:(input,init)=>{
    const method=(init?.method||input?.method||'GET').toUpperCase();
    const path=new URL(typeof input==='string'?input:input.url||String(input),supabaseUrl).pathname;
    if(rolePreviewReadOnly&&!['GET','HEAD','OPTIONS'].includes(method)&&!['/auth/v1/token','/auth/v1/logout'].includes(path))return Promise.resolve(new Response(JSON.stringify({message:'Vista de rol: vuelve a tu rol para realizar esta acción.'}),{status:403,headers:{'Content-Type':'application/json'}}));
    return fetch(input,init);
  }},
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
