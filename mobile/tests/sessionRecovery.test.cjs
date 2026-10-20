const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const sessionFor = id => ({ user: { id }, access_token: `token-${id}` });
const profileFor = id => ({ id, usuario: id, empresa: 'ACME', rol: 'worker' });
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };

// Minimal hook lifecycle runner: re-renders state updates and cleans up effects
// when their dependencies change. All storage/auth calls remain local mocks.
function harness(options = {}) {
  let session = sessionFor('A'), callback, signouts = 0, value, scheduled = false, stopped = false;
  let query = async table => table === 'usuarios' ? { data: profileFor(session.user.id) } : { data: { permisos: { read: true } } };
  let sessionError = false, roleError = false, profileCalls = 0;
  let cursor = 0;
  const slots = [], effects = [], owners = [];
  function schedule() { if (!scheduled && !stopped) { scheduled = true; queueMicrotask(render); } }
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], next => {
        const result = typeof next === 'function' ? next(slots[slot]) : next;
        if (!Object.is(result, slots[slot])) { slots[slot] = result; schedule(); }
      }];
    },
    useRef(initial) { const slot = cursor++; return slots[slot] ??= { current: initial }; },
    useEffect(fn, deps) {
      const slot = cursor++, previous = slots[slot];
      if (!previous || deps.some((dependency, index) => !Object.is(dependency, previous.deps[index]))) {
        effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: fn() }; });
      }
    },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (_, props) => { value = props.value; return null; } },
    '@react-native-async-storage/async-storage': { default: { getItem: options.getItem || (async () => null), setItem: async () => {} } },
    'expo-local-authentication': { hasHardwareAsync: async () => true, isEnrolledAsync: async () => true, authenticateAsync: async () => ({ success: true }) },
    '@/lib/notifications': { unregisterMobileNotifications: async () => {} },
    '@/lib/offlineQueue': { setPendingWriteOwner: owner => owners.push(owner) },
    '@/lib/supabase': { supabase: {
      auth: {
        getSession: async () => { if (sessionError) throw Error('offline'); return { data: { session } }; },
        onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe() {} } } }; },
        signOut: async () => { signouts++; session = null; callback('SIGNED_OUT', null); return { error: null }; },
      },
      from: table => {
        let id;
        const builder = {
          select() { return this; }, limit() { return this; }, ilike() { return this; },
          eq(field, value) { if (field === 'auth_user_id') id = value; return this; },
          maybeSingle() {
            if (table === 'usuarios') profileCalls++;
            if (table === 'roles' && roleError) return Promise.resolve({ data: null, error: Error('roles offline') });
            return query(table, id);
          },
        };
        return builder;
      },
    } },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/auth/AuthProvider.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('exports', 'module', 'require', code)(module.exports, module, name => {
    assert.ok(mocks[name], `Unexpected import ${name}`);
    return { __esModule: true, ...mocks[name] };
  });
  function render() {
    scheduled = false;
    if (stopped) return;
    cursor = 0;
    module.exports.AuthProvider({ children: null });
    while (effects.length) effects.shift()();
  }
  return {
    start: render, value: () => value, owners, signouts: () => signouts, calls: () => profileCalls,
    query(fn) { query = fn; },
    sessionError(enabled) { sessionError = enabled; }, roleError(enabled) { roleError = enabled; },
    account(id) { session = id ? sessionFor(id) : null; callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', session); },
    refresh() { session = { ...session, access_token: 'refreshed' }; callback('TOKEN_REFRESHED', session); },
    stop() { stopped = true; slots.forEach(slot => slot?.cleanup?.()); },
  };
}
test('temporary profile failure preserves session, blocks permissions, and recovers on retry', async () => {
  const h = harness();
  h.query(async () => ({ data: null, error: Error('Network request failed') }));
  h.start(); await settle();
  assert.equal(h.value().session.user.id, 'A');
  assert.equal(h.value().profile, null);
  assert.ok(h.value().profileError);
  assert.equal(h.value().loading, false);
  assert.equal(h.signouts(), 0);
  h.query(async table => ({ data: table === 'usuarios' ? profileFor('A') : { permisos: { read: true } } }));
  h.value().retryProfile(); await settle();
  assert.equal(h.value().profile.id, 'A');
  assert.equal(h.value().profileError, null);
  assert.deepEqual(h.owners.at(-1), { userId: 'A', company: 'ACME' });
  h.stop();
});
test('late profile response cannot restore a signed-out account', async () => {
  const h = harness(), response = deferred();
  h.query(table => table === 'usuarios' ? response.promise : Promise.resolve({ data: {} }));
  h.start(); await settle();
  await h.value().signOut(); await settle();
  response.resolve({ data: profileFor('A') }); await settle();
  assert.equal(h.value().session, null);
  assert.equal(h.value().profile, null);
  assert.equal(h.owners.at(-1), null);
  h.stop();
});
test('late A profile cannot overwrite B after changing accounts', async () => {
  const h = harness(), response = deferred();
  h.query((table, id) => table !== 'usuarios' ? Promise.resolve({ data: {} })
    : id === 'A' ? response.promise : Promise.resolve({ data: profileFor(id) }));
  h.start(); await settle();
  h.account('B'); await settle();
  response.resolve({ data: profileFor('A') }); await settle();
  assert.equal(h.value().session.user.id, 'B');
  assert.equal(h.value().profile.id, 'B');
  assert.deepEqual(h.owners.at(-1), { userId: 'B', company: 'ACME' });
  h.stop();
});
test('role lookup failure never grants a partly loaded permission set', async () => {
  const h = harness(); h.roleError(true); h.start(); await settle();
  assert.equal(h.value().profile, null);
  assert.ok(h.value().profileError);
  assert.equal(h.signouts(), 0);
  h.stop();
});
test('token refresh keeps the verified profile without restarting its request', async () => {
  const h = harness(); h.start(); await settle();
  const calls = h.calls();
  h.refresh(); await settle();
  assert.equal(h.calls(), calls);
  assert.equal(h.value().session.access_token, 'refreshed');
  assert.equal(h.value().profile.id, 'A');
  h.stop();
});
test('session restoration failure ends loading and can be retried', async () => {
  const h = harness(); h.sessionError(true); h.start(); await settle();
  assert.equal(h.value().loading, false);
  assert.ok(h.value().profileError);
  h.sessionError(false); h.value().retryProfile(); await settle();
  assert.equal(h.value().profile.id, 'A');
  assert.equal(h.value().profileError, null);
  h.stop();
});
test('biometric preferences must finish before protected content can appear', async () => {
  const preference = deferred();
  const h = harness({ getItem: () => preference.promise });
  h.start(); await settle();
  assert.equal(h.value().loading, true);
  preference.resolve('true'); await settle();
  assert.equal(h.value().loading, false);
  assert.equal(h.value().locked, true);
  h.stop();
});
