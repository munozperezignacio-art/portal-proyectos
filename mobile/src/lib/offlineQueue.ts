import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
const KEY='obraxis:pending-writes:v1';
export type PendingWrite={id:string;kind?:'insert'|'function';target:string;payload:Record<string,any>;createdAt:string};
const read=async():Promise<PendingWrite[]>=>JSON.parse(await AsyncStorage.getItem(KEY)||'[]');
const write=(items:PendingWrite[])=>AsyncStorage.setItem(KEY,JSON.stringify(items));
const enqueue=async(kind:'insert'|'function',target:string,payload:Record<string,any>)=>{const items=await read();items.push({id:`${Date.now()}-${Math.random()}`,kind,target,payload,createdAt:new Date().toISOString()});await write(items)};
export async function insertResilient(table:string,payload:Record<string,any>){const network=await NetInfo.fetch();if(network.isConnected){const result=await supabase.from(table).insert(payload);if(!result.error)return{queued:false,error:null};if(!String(result.error.message).toLowerCase().includes('fetch'))return{queued:false,error:result.error}}await enqueue('insert',table,payload);return{queued:true,error:null}}
export async function invokeResilient(name:string,payload:Record<string,any>){const network=await NetInfo.fetch();if(network.isConnected){const result=await supabase.functions.invoke(name,{body:payload});if(!result.error)return{queued:false,error:null};if(!String(result.error.message).toLowerCase().includes('fetch'))return{queued:false,error:result.error}}await enqueue('function',name,payload);return{queued:true,error:null}}
export async function flushPendingWrites(){const items=await read();if(!items.length)return 0;const remaining:PendingWrite[]=[];let synced=0;for(const item of items){const target=item.target||(item as any).table;const result=item.kind==='function'?await supabase.functions.invoke(target,{body:item.payload}):await supabase.from(target).insert(item.payload);if(result.error)remaining.push(item);else synced++}await write(remaining);return synced}
export async function pendingWriteCount(){return(await read()).length}
