export const ANDROID_RELEASE_URL='https://raw.githubusercontent.com/munozperezignacio-art/portal-proyectos/main/releases/android.json';
export const UPDATE_CHECK_INTERVAL=6*60*60*1000;
export type AndroidRelease={schema:1;platform:'android';packageName:'cl.obraxis.terreno';version:string;build:number;apkUrl:string;sha256:string;commit:string;sourceHash:string;publishedAt:string;notes:string[]};
const versionParts=(value:string)=>/^\d+\.\d+\.\d+$/.test(value)?value.split('.').map(Number):null;
export function parseAndroidRelease(value:unknown):AndroidRelease {
  if(!value||typeof value!=='object')throw new Error('Catálogo de actualizaciones inválido.');
  const r=value as AndroidRelease;
  if(r.schema!==1||r.platform!=='android'||r.packageName!=='cl.obraxis.terreno'||typeof r.version!=='string'||!versionParts(r.version)||!Number.isSafeInteger(r.build)||r.build<1)throw new Error('Versión de actualización inválida.');
  if(typeof r.apkUrl!=='string'||!/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/.test(r.apkUrl))throw new Error('Enlace de actualización no reconocido.');
  if(!/^[a-f0-9]{64}$/.test(r.sha256)||!/^[a-f0-9]{40}$/.test(r.commit)||!/^[a-f0-9]{64}$/.test(r.sourceHash)||typeof r.publishedAt!=='string'||!Number.isFinite(Date.parse(r.publishedAt)))throw new Error('Registro de actualización incompleto.');
  if(!Array.isArray(r.notes)||r.notes.length>8||r.notes.some(n=>typeof n!=='string'||n.length>200))throw new Error('Novedades inválidas.');
  return r;
}
export function isNewerRelease(release:AndroidRelease,installed:{version:string;build:number}):boolean {
  const remote=versionParts(release.version),local=versionParts(installed.version);
  if(!remote||!local||!Number.isSafeInteger(installed.build)||installed.build<0)return false;
  // Android cannot install a build with a lower/equal code over the current app.
  if(release.build<=installed.build)return false;
  for(let i=0;i<3;i++){if(remote[i]!==local[i])return remote[i]>local[i];}
  return true;
}
export function shouldCheckUpdate(lastAttempt:number,now:number,manual=false) {
  return manual||lastAttempt===0||now<lastAttempt||now-lastAttempt>=UPDATE_CHECK_INTERVAL;
}
export async function fetchAndroidRelease(signal:AbortSignal):Promise<AndroidRelease> {
  const response=await fetch(`${ANDROID_RELEASE_URL}?t=${Date.now()}`,{signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo consultar la última versión.');
  return parseAndroidRelease(await response.json());
}
