import { requireOptionalNativeModule } from 'expo';
export type DownloadState={status:'idle'|'downloading'|'ready';progress:number};
type NativeUpdater={start(url:string,hash:string):Promise<void>;status(hash:string):Promise<DownloadState>;cancel():Promise<void>;install(hash:string):Promise<'permission'|'installer'>};
export const nativeUpdater=requireOptionalNativeModule<NativeUpdater>('ObraxisUpdater');
