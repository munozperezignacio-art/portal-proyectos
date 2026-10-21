import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { nativeUpdater, type DownloadState } from './nativeUpdater';
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
  const [transfer,setTransfer]=useState<DownloadState>({status:'idle',progress:0});
  const [busy,setBusy]=useState(false);
  const [installMessage,setInstallMessage]=useState('');
  const action=useRef(false);
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
  const hash=state.release?.sha256;
  useEffect(()=>{
    if(!hash||!nativeUpdater)return;
    const updater=nativeUpdater;
    let active=true,polling=false;
    const poll=async()=>{
      if(polling||action.current)return;polling=true;
      try{const next=await updater.status(hash);if(active&&!action.current)setTransfer(next);}
      catch(error){if(active){setTransfer({status:'idle',progress:0});setState(old=>({...old,error:error instanceof Error?error.message:'No se pudo verificar la descarga.'}));}}
      finally{polling=false;}
    };
    void poll();const timer=setInterval(()=>void poll(),1500);
    return()=>{active=false;clearInterval(timer);};
  },[hash]);
  const download=async()=>{
    if(action.current||!state.release||!isNewerRelease(state.release,{version,build}))return;
    if(!nativeUpdater){setState(old=>({...old,error:'Esta función necesita la nueva APK de Obraxis instalada en Android.'}));return;}
    action.current=true;setBusy(true);setInstallMessage('');setState(old=>({...old,error:''}));
    try{
      if(transfer.status==='ready'){
        const result=await nativeUpdater.install(state.release.sha256);
        if(mounted.current)setInstallMessage(result==='permission'?'Autoriza a Obraxis en la pantalla de Android. Luego vuelve y pulsa Instalar actualización.':'Confirma la actualización en el instalador de Android. Si lo cerraste, puedes abrirlo de nuevo.');
      }else{
        await nativeUpdater.start(state.release.apkUrl,state.release.sha256);
        if(mounted.current)setTransfer({status:'downloading',progress:0});
      }
    }catch(error){if(mounted.current)setState(old=>({...old,error:error instanceof Error?error.message:'No se pudo iniciar la actualización. Inténtalo de nuevo.'}));}
    finally{action.current=false;if(mounted.current)setBusy(false);}
  };
  const cancel=async()=>{
    if(action.current||!nativeUpdater)return;action.current=true;setBusy(true);
    try{await nativeUpdater.cancel();if(mounted.current)setTransfer({status:'idle',progress:0});}
    catch{if(mounted.current)setState(old=>({...old,error:'No se pudo cancelar la descarga. Inténtalo de nuevo.'}));}
    finally{action.current=false;if(mounted.current)setBusy(false);}
  };
  return {...state,transfer,busy,installMessage,cancel,available:!!state.release&&isNewerRelease(state.release,{version,build}),enabled,known,version,build,check:()=>check(true),download};
}
export type AppUpdates=ReturnType<typeof useAppUpdates>;
