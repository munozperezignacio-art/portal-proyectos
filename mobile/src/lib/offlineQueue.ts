import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const KEY = 'obraxis:pending-writes:v1';
type Owner = { userId: string; company: string };
export type PendingWrite = {
  id: string; kind?: 'insert' | 'function'; target: string;
  payload: Record<string, any>; createdAt: string; owner?: Owner; sending?: boolean;
};
let owner: Owner | null = null;
let revision = 0;
let storageTail: Promise<unknown> = Promise.resolve();
let flush: Promise<number> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const sameOwner = (a?: Owner | null, b?: Owner | null) =>
  Boolean(a && b && a.userId === b.userId && a.company === b.company);

// Unowned records from older apps are retained, never assigned to a new login.
export function setPendingWriteOwner(next: Owner | null) {
  if (sameOwner(owner, next) || (!owner && !next)) return;
  owner = next;
  revision++;
  notify();
}
export function subscribePendingWrites(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageTail.then(operation);
  storageTail = result.catch(() => undefined);
  return result;
}
async function read(): Promise<PendingWrite[]> {
  const items = JSON.parse(await AsyncStorage.getItem(KEY) || '[]');
  if (!Array.isArray(items) || items.some(item =>
    !item || typeof item.id !== 'string' || !(item.target || item.table) || !item.payload)) {
    throw new Error('No se pudo leer la cola local. Los registros se conservaron.');
  }
  return items;
}
const write = (items: PendingWrite[]) => AsyncStorage.setItem(KEY, JSON.stringify(items));
const message = (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) });
async function credentials(expected: Owner, expectedRevision: number) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expected.userId ||
      revision !== expectedRevision || !sameOwner(owner, expected)) {
    throw new Error('Verifica tu sesión antes de guardar o sincronizar.');
  }
  return data.session.access_token;
}
async function send(item: PendingWrite, token: string) {
  // Pin the identity even if a different account logs in during this request.
  const headers = { Authorization: `Bearer ${token}` };
  if (item.kind === 'function') {
    const result = await supabase.functions.invoke(item.target, { body: item.payload, headers });
    return result.error || (result.data?.error ? message(result.data.error) : null);
  }
  const result = await supabase.from(item.target).insert(item.payload)
    .setHeader('Authorization', headers.Authorization);
  return result.error;
}
async function save(kind: 'insert' | 'function', target: string, payload: Record<string, any>) {
  try {
    const expected = owner;
    const expectedRevision = revision;
    if (!expected) throw new Error('Verifica tu sesión antes de guardar.');
    const item: PendingWrite = {
      id: `${Date.now()}-${Math.random()}`, kind, target, payload,
      createdAt: new Date().toISOString(), owner: expected,
    };
    const network = await NetInfo.fetch();
    if (revision !== expectedRevision) throw new Error('La sesión cambió. Vuelve a guardar.');
    if (network.isConnected && network.isInternetReachable !== false) {
      const token = await credentials(expected, expectedRevision);
      const error = await send(item, token);
      if (!error) return { queued: false, error: null };
      // An ambiguous online failure might already have committed on the server.
      // Do not silently replay it under a fresh request.
      return { queued: false, error };
    }
    await serialized(async () => {
      if (revision !== expectedRevision) throw new Error('La sesión cambió. Vuelve a guardar.');
      const items = await read();
      items.push(item);
      await write(items);
    });
    notify();
    return { queued: true, error: null };
  } catch (error) {
    return { queued: false, error: message(error) };
  }
}
export const insertResilient = (table: string, payload: Record<string, any>) => save('insert', table, payload);
export const invokeResilient = (name: string, payload: Record<string, any>) => save('function', name, payload);

export function flushPendingWrites(): Promise<number> {
  if (flush) return flush;
  const expected = owner;
  const expectedRevision = revision;
  if (!expected) return Promise.resolve(0);
  flush = (async () => {
    const items = await serialized(read);
    let synced = 0;
    for (const item of items) {
      if (!sameOwner(item.owner, expected) || item.sending || revision !== expectedRevision) continue;
      const token = await credentials(expected, expectedRevision);
      // Persist before dispatch. A crash, lost response, or failed local delete
      // must not cause automatic duplicate submission on the next launch.
      await serialized(async () => {
        await write((await read()).map(current => current.id === item.id ? { ...current, sending: true } : current));
      });
      if (revision !== expectedRevision) {
        await serialized(async () => {
          await write((await read()).map(current => current.id === item.id ? { ...current, sending: false } : current));
        });
        break;
      }
      notify();
      const error = await send(item, token);
      if (error) { notify(); break; }
      await serialized(async () => {
        // A new enqueue may have completed while the request was in flight.
        await write((await read()).filter(current => current.id !== item.id));
      });
      synced++;
      notify();
    }
    return synced;
  })().finally(() => { flush = null; });
  return flush;
}
export function pendingWriteStatus() {
  return serialized(async () => {
    const items = await read();
    return {
      pending: items.filter(item => sameOwner(item.owner, owner) && !item.sending).length,
      review: items.filter(item => !item.owner || (sameOwner(item.owner, owner) && item.sending)).length,
    };
  });
}
export async function pendingWriteCount() { return (await pendingWriteStatus()).pending; }
