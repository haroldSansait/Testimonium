import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as cache from '../src/services/queryClient.ts';

const admin = existsSync(new URL('../src/context/AuthContext.tsx', import.meta.url));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let dispose;
const queries = new Set();
cache.queryClient.getQueryCache().subscribe(event => { if (event.type === 'added') queries.add(event.query); });
afterEach(async () => {
  dispose?.(); dispose = undefined; cache.setQueryScope(null); await flush();
  queries.forEach(query => query.destroy()); queries.clear();
});

// Actual AuthProvider + SessionService + QueryClient, controlled Firebase,
// backend responses and React effects. No browser reload or real account used.
function harness() {
  const auth = { currentUser: null };
  let authCallback;
  let profileFailure = false;
  let profileWait;
  let signOutWait;
  const fetches = [];
  const states = [], effects = [];
  let cursor = 0, dirty = true, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (fn, deps) => { const i = cursor++; if (!same(states[i]?.deps, deps)) states[i] = { value: fn(), deps }; return states[i].value; };
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { const next = typeof value === 'function' ? value(states[i]) : value; if (!Object.is(next, states[i])) { states[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return states[i] ||= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!same(effects[i]?.deps, deps)) effects[i] = { fn, deps, pending: true, cleanup: effects[i]?.cleanup }; },
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  const profile = uid => admin ? { id: uid, name: uid, email: `${uid}@fixture.test`, role: 'SECRETARY', parishId: uid === 'a' ? '3' : '4' }
    : { id: uid, firebaseUid: uid, fullName: uid, role: 'PARISHIONER', parish: { id: uid === 'a' ? 3 : 4 }, emailVerified: true, termsAccepted: true, privacyAccepted: true };
  const getProfile = async () => {
    const uid = auth.currentUser?.uid;
    fetches.push(['profile', uid]);
    if (profileWait) { const waiting = profileWait; profileWait = undefined; await waiting; }
    if (profileFailure) throw new Error('Profile unavailable');
    return profile(uid);
  };
  const firebase = {
    onAuthStateChanged: (_auth, callback) => { authCallback = callback; return () => { authCallback = undefined; }; },
    signOut: async () => { if (signOutWait) await signOutWait; auth.currentUser = null; await authCallback?.(null); },
    setPersistence: async () => {}, browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    signInWithEmailAndPassword: async (_auth, email) => {
      const uid = email.split('@')[0];
      auth.currentUser = { uid, email, emailVerified: true, providerData: [], getIdToken: async () => 'fixture-token',
        getIdTokenResult: async () => ({ expirationTime: new Date(Date.now() + 3600_000).toISOString() }) };
      await authCallback(auth.currentUser);
      return { user: auth.currentUser };
    },
  };
  const storage = new Map();
  const storageApi = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key), clear: () => storage.clear() };
  const sessionConfig = { SESSION_START_KEY: 'start', STORAGE_SYNC_KEY: 'sync', TOKEN_REFRESH_THRESHOLD_MINUTES: 5 };
  const sandbox = { URLSearchParams, AbortController, console: { debug() {}, warn() {}, error() {} }, setTimeout, clearTimeout, clearInterval,
    localStorage: storageApi, sessionStorage: storageApi,
    window: { addEventListener() {}, location: { pathname: '/login', replace() { throw new Error('Unexpected browser navigation'); } } },
    fetch: async (_url, options) => ({ ok: true, json: async () => ({ data: options?.method === 'POST' ? { user: await getProfile() } : await getProfile() }) }),
  };
  function load(path, modules) {
    const module = { exports: {} };
    const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL', '"http://fixture.test/api/v1"');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
      { ...sandbox, module, exports: module.exports, require: name => {
        if (name in modules) return modules[name];
        throw new Error(`Unexpected dependency ${name}`);
      } });
    return module.exports;
  }
  const session = load('services/SessionService.ts', {
    'firebase/auth': firebase, '../firebaseConfig': { auth }, '@/config/firebase': { auth },
    './queryClient': cache, '../hooks/useService': { clearAllPollingTimers() {} },
    '../config/sessionConfig': { SESSION_CONFIG: sessionConfig }, '@/config/sessionConfig': { SESSION_CONFIG: sessionConfig },
    '../utils/sessionLogger': { logSessionEvent() {} }, '@/utils/sessionLogger': { logSessionEvent() {} },
    '../features/chat/caloyStorage': { clearCaloySessionStorage() {} },
  }).SessionService;
  const authService = { getApplicationUser: getProfile, signIn: async (email, password) => {
    await firebase.signInWithEmailAndPassword(auth, email, password);
    return getProfile();
  } };
  const provider = load(admin ? 'context/AuthContext.tsx' : 'contexts/AuthContext.tsx', {
    react: { ...react, default: react, __esModule: true }, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'firebase/auth': firebase, '../firebaseConfig': { auth }, '@/config/firebase': { auth },
    '../services/SessionService': { SessionService: session }, '@/services/SessionService': { SessionService: session },
    '../services/queryClient': cache, '@/services/queryClient': cache,
    '../config/sessionConfig': { SESSION_CONFIG: sessionConfig }, '@/config/sessionConfig': { SESSION_CONFIG: sessionConfig },
    '../hooks/useIdleTimeout': { useIdleTimeout: () => ({ secondsRemaining: 0, resetTimer() {} }) }, '@/hooks/useIdleTimeout': { useIdleTimeout: () => ({ secondsRemaining: 0, resetTimer() {} }) },
    './SubmissionProtectionContext': { useSubmissionProtection: () => ({ isBusy: false }) }, '@/context/SubmissionProtectionContext': { useSubmissionProtection: () => ({ isBusy: false }) },
    '../utils/sessionLogger': { logSessionEvent() {} }, '@/services/AuthService': { AuthService: authService },
  });
  const render = () => {
    for (let pass = 0; dirty && pass < 20; pass++) {
      dirty = false; cursor = 0; tree = provider.AuthProvider({ children: null });
      effects.forEach(effect => { if (effect?.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.fn(); } });
    }
    return tree.props.value;
  };
  render();
  dispose = () => effects.forEach(effect => effect?.cleanup?.());
  const route = load(admin ? 'routes/ProtectedRoute.tsx' : 'components/ProtectedRoute.tsx', {
    react: { ...react, default: react, __esModule: true }, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-router-dom': { Navigate: 'Navigate', Outlet: 'Outlet', useLocation: () => ({ pathname: '/dashboard' }) },
    '../contexts/AuthContext': { useAuth: render }, '@/hooks/useAuth': { useAuth: render },
    '../services/queryClient': cache, '@/services/queryClient': cache,
    './ui/Spinner': { Spinner: 'Spinner' }, '@/components/ui/LoadingOverlay': { LoadingOverlay: 'LoadingOverlay' },
    './ui/ErrorState': { ErrorState: 'ErrorState' }, '@/components/common/ErrorState': { ErrorState: 'ErrorState' },
    './legal/LegalGate': { LegalGate: 'LegalGate' },
    '../contexts/ProfileRequirementContext': { ProfileRequirementProvider: 'ProfileRequirementProvider' },
    '../contexts/NotificationContext': { NotificationProvider: 'NotificationProvider' },
    '@/permissions/rolePermissions': { hasPermission: () => true },
  }).ProtectedRoute;
  return { session, auth, fetches, render, route: () => route({}),
    observe: async () => { await authCallback(auth.currentUser); await flush(); return render(); },
    failProfile: value => { profileFailure = value; }, waitProfile: promise => { profileWait = promise; },
    pauseLogout: promise => { signOutWait = promise; },
    login: async uid => { const value = render(); await (admin ? value.signIn(`${uid}@fixture.test`, 'fixture') : value.signInWithEmail(`${uid}@fixture.test`, 'fixture')); await flush(); return render(); },
    logout: async () => { await render().logout(); await flush(); return render(); },
  };
}

test('actual auth lifecycle resumes fresh queries after same-UID reauthentication and isolates another account', async () => {
  const h = harness();
  await h.login('a');
  assert.equal(h.session.getState(), 'ACTIVE');
  const read = async () => {
    const uid = h.auth.currentUser.uid;
    assert.ok(cache.getQueryScope(), 'backend profile must establish an enabled query scope');
    return cache.queryClient.fetchQuery({ queryKey: cache.privateQueryKey('requests'), queryFn: cache.guardedQuery(async () => {
      h.fetches.push(['requests', uid]); return [`${uid}-document`, `${uid}-events`, `${uid}-parish`];
    }), staleTime: 60_000 });
  };
  const firstKey = cache.privateQueryKey('requests');
  assert.deepEqual(await read(), ['a-document', 'a-events', 'a-parish']);
  await read(); assert.equal(h.fetches.filter(([type]) => type === 'requests').length, 1);
  const oldSignal = cache.getSessionSignal();
  await h.logout();
  assert.equal(oldSignal.aborted, true);
  assert.equal(cache.queryClient.getQueryCache().getAll().length, 0);
  await h.login('a');
  assert.equal(h.session.getState(), 'ACTIVE', 'a new Firebase-authenticated session must leave LOGGED_OUT');
  assert.ok((h.render().appProfile ?? h.render().applicationUser), 'the reauthenticated backend profile must publish');
  assert.equal(cache.getSessionSignal().aborted, false);
  await read(); assert.equal(h.fetches.filter(([type]) => type === 'requests').length, 2);
  assert.equal(await h.session.refreshToken(), true);
  await h.logout(); await h.login('b');
  assert.equal(cache.queryClient.getQueryData(firstKey), undefined);
  assert.deepEqual(await read(), ['b-document', 'b-events', 'b-parish']);
  await h.logout(); assert.equal(h.session.getState(), 'LOGGED_OUT', 'subsequent logout must also clear the restarted session');
});

test('a cancelled old query cannot block or overwrite a fresh query for the same UID', async () => {
  const h = harness(); await h.login('a');
  const pending = deferred();
  const key = cache.privateQueryKey('requests');
  const old = cache.queryClient.fetchQuery({ queryKey: key, queryFn: cache.guardedQuery(() => pending.promise) }).catch(() => null);
  await h.logout(); await h.login('a');
  const fresh = await cache.queryClient.fetchQuery({ queryKey: cache.privateQueryKey('requests'), queryFn: cache.guardedQuery(async () => ['new session']) });
  assert.deepEqual(fresh, ['new session']);
  pending.resolve(['old session']); await old; await flush();
  assert.deepEqual(cache.queryClient.getQueryData(key), ['new session']);
});

test('an old token refresh cannot revive logout or clear a new session refresh', async () => {
  const h = harness(); await h.login('a');
  const oldToken = deferred();
  h.auth.currentUser.getIdToken = async () => { await oldToken.promise; throw new Error('old refresh failed'); };
  const oldRefresh = h.session.refreshToken(true);
  await h.logout(); await h.login('a');
  const newToken = deferred(); let refreshes = 0;
  h.auth.currentUser.getIdToken = async () => { refreshes++; await newToken.promise; return 'fixture-token'; };
  const newRefresh = h.session.refreshToken(true);
  oldToken.resolve(); assert.equal(await oldRefresh, false);
  const duplicate = h.session.refreshToken(true);
  assert.equal(refreshes, 1);
  newToken.resolve();
  assert.equal(await newRefresh, true); assert.equal(await duplicate, true);
  assert.equal(h.session.getState(), 'ACTIVE');
});

test('only a current Firebase identity can restart, and an in-progress logout stays terminal', async () => {
  const h = harness(); await h.login('a');
  assert.equal(h.session.startAuthenticatedSession('another-uid'), false);
  const wait = deferred(); h.pauseLogout(wait.promise);
  const logout = h.logout();
  assert.equal(h.session.getState(), 'LOGGING_OUT');
  assert.equal(h.session.startAuthenticatedSession('a'), false);
  wait.resolve(); await logout;
  assert.equal(h.session.startAuthenticatedSession('a'), false);
  assert.equal(h.session.transitionTo('ACTIVE'), false);
});

test('pending and failed backend profile resolution cannot render an empty protected dashboard', async () => {
  const h = harness(); await h.login('a'); await h.logout();
  const wait = deferred(); h.waitProfile(wait.promise);
  const login = h.login('a'); await flush();
  const pending = h.render();
  assert.equal(pending.loading, true);
  assert.equal(cache.getQueryScope(), null);
  const gate = h.route();
  assert.notEqual(gate.type, 'Outlet');
  assert.notEqual(gate.type, 'ProfileRequirementProvider');
  wait.resolve(); await login;
  h.failProfile(true); await h.observe();
  assert.equal(h.render().loading, false);
  assert.ok(h.render().profileError);
  assert.equal(cache.getQueryScope(), null);
  const error = h.route(); assert.equal(error.type, 'ErrorState');
  h.failProfile(false);
  await (admin ? h.render().refreshUser() : h.render().refreshProfile());
  await flush();
  assert.equal(h.render().profileError, null);
  assert.ok(cache.getQueryScope());
  assert.equal(h.route().type, admin ? 'Outlet' : 'ProfileRequirementProvider');
});

test('a delayed profile from a previous same-UID session cannot replace the new profile', async () => {
  const h = harness(); await h.login('a');
  const wait = deferred(); h.waitProfile(wait.promise);
  const oldProfile = admin ? h.render().refreshUser() : h.render().refreshProfile();
  await h.logout(); await h.login('a');
  const currentProfile = h.render().appProfile ?? h.render().applicationUser;
  const signal = cache.getSessionSignal();
  const currentWait = deferred(); h.waitProfile(currentWait.promise);
  const currentRefresh = admin ? h.render().refreshUser() : h.render().refreshProfile();
  wait.resolve(); await oldProfile; await flush();
  assert.equal(h.render().appProfile ?? h.render().applicationUser, currentProfile);
  assert.equal(cache.getSessionSignal(), signal);
  let duplicate;
  if (!admin) {
    const calls = h.fetches.length;
    duplicate = h.render().refreshProfile(); await flush();
    assert.equal(h.fetches.length, calls, 'old refresh completion must not clear the new same-UID single-flight request');
  }
  currentWait.resolve(); await currentRefresh; await duplicate;
});
