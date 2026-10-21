const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(initial = []) {
  let disk = JSON.stringify(initial), user = 'A', connected = false, failWrite = false;
  const sent = [];
  let transport = async request => { sent.push(request); return { error: null }; };
  const module = { exports: {} };
  const mocks = {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async () => disk,
      setItem: async (_, value) => { if (failWrite) throw Error('disk full'); disk = value; },
    } },
    '@react-native-community/netinfo': { default: { fetch: async () => ({ isConnected: connected }) } },
    './supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: user ? { user: { id: user }, access_token: `token-${user}` } : null } }) },
      from: target => ({ insert: payload => ({ setHeader: (name, token) => transport({ target, payload, token, name }) }) }),
      functions: { invoke: (target, options) => transport({ target, payload: options.body, token: options.headers.Authorization }) },
    } },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/offlineQueue.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'module', 'require', code)(module.exports, module, name => ({ __esModule: true, ...mocks[name] }));
  const q = module.exports;
  q.setPendingWriteOwner({ userId: 'A', company: 'ACME' });
  return { q, sent, items: () => JSON.parse(disk), raw: () => disk,
    account(id, company = 'ACME') { user = id; q.setPendingWriteOwner(id ? { userId: id, company } : null); },
    transport(fn) { transport = fn; }, online() { connected = true; },
    corrupt() { disk = '{broken'; }, failWrite() { failWrite = true; },
  };
}
test('concurrent offline saves retain every record', async () => {
  const h = harness();
  const results = await Promise.all(Array.from({ length: 20 }, (_, id) => h.q.insertResilient('advances', { id })));
  assert.ok(results.every(result => result.queued && !result.error));
  assert.equal(h.items().length, 20);
});
test('enqueue during a flush survives, and overlapping flushes dispatch once', async () => {
  const h = harness(), entered = deferred(), release = deferred();
  await h.q.insertResilient('advances', { id: 'old' });
  let calls = 0;
  h.transport(async () => { calls++; entered.resolve(); await release.promise; return { error: null }; });
  const first = h.q.flushPendingWrites();
  await entered.promise;
  const second = h.q.flushPendingWrites();
  assert.equal(first, second);
  await h.q.insertResilient('advances', { id: 'new' });
  release.resolve();
  assert.deepEqual(await Promise.all([first, second]), [1, 1]);
  assert.equal(calls, 1);
  assert.deepEqual(h.items().map(item => item.payload.id), ['new']);
});
test('account and company isolation; switching back recovers owned records', async () => {
  const h = harness();
  await h.q.insertResilient('advances', { id: 'A' });
  h.account('B');
  assert.equal(await h.q.flushPendingWrites(), 0);
  assert.equal(await h.q.pendingWriteCount(), 0);
  h.account('A', 'OTHER');
  assert.equal(await h.q.flushPendingWrites(), 0);
  h.account('A');
  assert.equal(await h.q.flushPendingWrites(), 1);
  assert.equal(h.sent[0].token, 'Bearer token-A');
});
test('switch during a request pins old credentials and stops the remaining batch', async () => {
  const h = harness(), entered = deferred(), release = deferred();
  await h.q.invokeResilient('save', { id: 1 });
  await h.q.insertResilient('advances', { id: 2 });
  const sent = [];
  h.transport(async request => { sent.push(request); entered.resolve(); await release.promise; return { error: null }; });
  const flush = h.q.flushPendingWrites();
  await entered.promise;
  h.account('B');
  release.resolve();
  assert.equal(await flush, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].token, 'Bearer token-A');
  assert.equal(h.items().length, 1);
});
test('legacy unowned and interrupted records remain intact without replay', async () => {
  const entries = [
    { id: 'legacy', table: 'advances', payload: { id: 1 } },
    { id: 'interrupted', target: 'advances', payload: { id: 2 }, owner: { userId: 'A', company: 'ACME' }, sending: true },
  ];
  const h = harness(entries);
  assert.equal(await h.q.flushPendingWrites(), 0);
  assert.deepEqual(h.items(), entries);
  assert.deepEqual(await h.q.pendingWriteStatus(), { pending: 0, review: 2 });
});
test('lost response is preserved for review, not automatically duplicated', async () => {
  const h = harness();
  await h.q.insertResilient('advances', { id: 1 });
  let calls = 0;
  h.transport(async () => { calls++; throw Error('Network request failed'); });
  await assert.rejects(h.q.flushPendingWrites());
  assert.equal(await h.q.flushPendingWrites(), 0);
  assert.equal(calls, 1);
  assert.equal(h.items().length, 1);
  assert.equal((await h.q.pendingWriteStatus()).review, 1);
});
test('function application error does not delete the pending entry', async () => {
  const h = harness();
  await h.q.invokeResilient('save', { id: 1 });
  h.transport(async () => ({ error: null, data: { error: 'permission denied' } }));
  assert.equal(await h.q.flushPendingWrites(), 0);
  assert.equal(h.items().length, 1);
});
test('storage errors and absent session never report a successful save', async () => {
  const h = harness();
  h.failWrite();
  assert.ok((await h.q.insertResilient('advances', {})).error);
  h.account(null);
  assert.ok((await h.q.insertResilient('advances', {})).error);
});
test('corrupt storage is not overwritten by another save', async () => {
  const h = harness();
  h.corrupt();
  assert.ok((await h.q.insertResilient('advances', {})).error);
  assert.equal(h.raw(), '{broken');
});
test('online rejected requests are not silently queued for later replay', async () => {
  const h = harness();
  h.online();
  h.transport(async () => ({ error: { message: 'Failed to fetch' } }));
  const result = await h.q.insertResilient('advances', { id: 1 });
  assert.ok(result.error);
  assert.equal(result.queued, false);
  assert.equal(h.items().length, 0);
});
test('failed local delete after server success does not replay the accepted write', async () => {
  const h = harness();
  await h.q.insertResilient('advances', { id: 1 });
  let calls = 0;
  h.transport(async () => { calls++; h.failWrite(); return { error: null }; });
  await assert.rejects(h.q.flushPendingWrites());
  assert.equal(await h.q.flushPendingWrites(), 0);
  assert.equal(calls, 1);
  assert.equal(h.items()[0].sending, true);
});
test('subscribers see new enqueues and can unsubscribe', async () => {
  const h = harness();
  let updates = 0;
  const unsubscribe = h.q.subscribePendingWrites(() => updates++);
  await h.q.insertResilient('advances', { id: 1 });
  assert.equal(updates, 1);
  unsubscribe();
  await h.q.insertResilient('advances', { id: 2 });
  assert.equal(updates, 1);
});
