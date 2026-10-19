import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { fetchAndroidRelease, isNewerRelease, shouldCheckUpdate, type AndroidRelease } from './appUpdates';

type State={status:'idle'|'checking'|'current'|'available'|'error';release:AndroidRelease|null;checkedAt:number|null;error:string};
export function useAppUpdates() {
  const preview=__DEV__&&Platform.OS==='web';
  const enabled=Platform.OS==='android'||preview;
  const version=Application.nativeApplicationVersion||(preview?Constants.expoConfig?.version:null)||'';
  const build=Number(Application.nativeBuildVersion||(preview?'0':NaN));
  const known=!!version&&Number.isSafeInteger(build)&&build>=0;
  const [state,setState]=useState<State>({status:'idle',release:null,checkedAt:null,error:''});
  const lastAttempt=useRef(0),request=useRef<AbortController|null>(null),mounted=useRef(false);
  const check=useCallback(async(manual=false)=>{
    if(!mounted.current||!enabled||!known||request.current||!shouldCheckUpdate(lastAttempt.current,Date.now(),manual))return;
    lastAttempt.current=Date.now();
    const controller=new AbortController();request.current=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    setState(old=>({...old,status:'checking',error:''}));
    try{
      const release=await fetchAndroidRelease(controller.signal);
      if(mounted.current&&request.current===controller)setState({status:isNewerRelease(release,{version,build})?'available':'current',release,checkedAt:Date.now(),error:''});
    }catch{
      if(mounted.current&&request.current===controller)setState(old=>({...old,status:'error',error:'No pudimos comprobar las actualizaciones. Revisa tu conexión e inténtalo de nuevo.'}));
    }finally{clearTimeout(timeout);if(request.current===controller)request.current=null;}
  },[enabled,known,version,build]);
  useEffect(()=>{
    mounted.current=true;const scheduled=setTimeout(()=>void check(),0);
    const subscription=AppState.addEventListener('change',value=>{if(value==='active')void check();});
    return ()=>{mounted.current=false;clearTimeout(scheduled);subscription.remove();if(request.current){request.current.abort();request.current=null;lastAttempt.current=0;}};
  },[check]);
  const download=async()=>{
    if(!state.release||!isNewerRelease(state.release,{version,build}))return;
    try{await Linking.openURL(state.release.apkUrl);}catch{setState(old=>({...old,error:'No se pudo abrir la descarga. Inténtalo de nuevo.'}));}
  };
  return {...state,available:!!state.release&&isNewerRelease(state.release,{version,build}),enabled,known,version,build,check:()=>check(true),download};
}
export type AppUpdates=ReturnType<typeof useAppUpdates>;
