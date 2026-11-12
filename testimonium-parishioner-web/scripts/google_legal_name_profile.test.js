import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  constructCanonicalFullName,
  doesConfirmedNameMatchDisplayed,
  normalizeNameForComparison,
} from "../src/utils/nameHelpers.ts";
import { getGovernmentIdErrorPresentation } from "../src/utils/governmentIdVerificationPresentation.ts";

// Execute the actual ProfilePage handlers/effects with controlled hooks and API
// responses. These are source-level UI checks, not browser interaction tests.
function profileHarness(overrides = {}, saveError = null) {
  let appProfile = {
    firebaseUid: 'fixture', fullName: 'MARIA CLARA REYES', firstName: null, lastName: null,
    needsLegalNameConfirmation: true, isGovernmentIdVerified: false, governmentIdVerificationStatus: 'NOT_SUBMITTED',
    ...overrides,
  };
  const mapped = () => ({ ...appProfile, displayName: appProfile.fullName, notificationsEnabled: true });
  let profile = mapped();
  const state = [], effects = [], calls = [], notices = [];
  let cursor = 0, dirty = true, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; dirty = true; }];
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!same(effects[i]?.deps, deps)) effects[i] = { callback, deps, pending: true };
    },
  };
  const modules = {
    react: { ...react, default: react, __esModule: true },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-router-dom': { useLocation: () => ({}), useNavigate: () => () => {} },
    '../../contexts/AuthContext': { useAuth: () => ({ user: { uid: 'fixture' }, appProfile, refreshProfile: async force => {
      calls.push(['refresh', force]); return appProfile;
    } }) },
    '../../contexts/ToastContext': { useToast: () => Object.fromEntries(['success', 'error', 'info'].map(kind => [kind, message => notices.push([kind, message])])) },
    '../../hooks/useService': { useProfile: () => ({ data: profile, loading: false, refetch() {}, updateProfile: async payload => {
      calls.push(['save', payload]);
      if (saveError) throw saveError;
      if (payload.legalNameConfirmationAction) {
        appProfile = { ...appProfile, ...payload, fullName: payload.legalNameConfirmationAction === 'confirm' ? appProfile.fullName : constructCanonicalFullName(payload), needsLegalNameConfirmation: false };
        profile = mapped(); dirty = true;
      }
    } }) },
    '../../utils/nameHelpers': { doesConfirmedNameMatchDisplayed },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/pages/dashboard/ProfilePage.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports,
    require: name => modules[name] || new Proxy({ __esModule: true }, { get: (_, prop) => prop === '__esModule' ? true : String(prop) }),
    console: { error() {} },
    document: { getElementById: id => ({ scrollIntoView: () => calls.push(['scroll', id]) }) },
  });
  const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
  const walk = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(child => walk(child, predicate)) : [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
  const render = () => {
    for (let pass = 0; dirty && pass < 10; pass++) {
      dirty = false; cursor = 0; tree = module.exports.ProfilePage();
      effects.forEach(effect => { if (effect?.pending) { effect.pending = false; effect.callback(); } });
    }
  };
  render();
  return {
    calls, notices, render,
    button: label => { const result = walk(tree, node => node.type === 'Button' && text(node) === label)[0]; assert.ok(result, label); return result; },
    input: label => { const result = walk(tree, node => node.type === 'Input' && node.props.label === label)[0]; assert.ok(result, label); return result; },
    text: () => text(tree),
    async settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); render(); } },
    async change(label, value) { this.input(label).props.onChange({ target: { value } }); render(); },
    async click(label) { this.button(label).props.onClick(); await this.settle(); },
    async saveSettings() { await walk(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); render(); },
  };
}

test('Web Option A rejects mismatch, saves explicit boundaries, preserves the name and reaches verification', async () => {
  const h = profileHarness();
  await h.click('Yes, this is my legal name');
  assert.equal(h.input('First Name *').props.value, '');
  await h.change('First Name *', 'Ana'); await h.change('Last Name *', 'Reyes');
  await h.click('Confirm Legal Name');
  assert.equal(h.calls.length, 0);
  assert.match(h.text(), /do not match/);
  await h.change('First Name *', 'Maria'); await h.change('Middle Name', 'Clara');
  await h.click('Confirm Legal Name');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])), { firstName: 'Maria', middleName: 'Clara', lastName: 'Reyes', suffix: '', legalNameConfirmationAction: 'confirm' });
  assert.equal(h.calls[1][1], true);
  assert.equal(h.input('Full Name').props.value, 'MARIA CLARA REYES');
  assert.doesNotMatch(h.text(), /Is this your actual full legal name/);
  await h.click('Verify Government ID Now');
  assert.deepEqual(h.calls.at(-1), ['scroll', 'government-id-section']);
});

test('Web Option B saves the corrected name and failed saves never announce success', async () => {
  for (const failure of [null, new Error('Save failed')]) {
    const h = profileHarness({}, failure);
    await h.click('No, I need to correct my name');
    await h.change('First Name *', 'Juan Miguel'); await h.change('Last Name *', 'Dela Cruz');
    await h.click('Save Corrected Legal Name');
    assert.equal(h.calls[0][1].legalNameConfirmationAction, 'correct');
    if (failure) {
      assert.match(h.text(), /Save failed/);
      assert.equal(h.notices.some(([kind]) => kind === 'success'), false);
      assert.doesNotMatch(h.text(), /Verify Government ID Now/);
    } else {
      assert.equal(h.input('Full Name').props.value, 'Juan Miguel Dela Cruz');
      assert.match(h.text(), /Verify Government ID Now/);
    }
  }
});

test('Web expired database VERIFIED names remain read-only and contact saves omit names', async () => {
  const h = profileHarness({ needsLegalNameConfirmation: false, governmentIdVerificationStatus: 'VERIFIED', isGovernmentIdVerified: false });
  assert.equal(h.input('Full Name').props.readOnly, true);
  await h.saveSettings();
  assert.equal('displayName' in h.calls[0][1], false);
  assert.equal('firstName' in h.calls[0][1], false);
});

test("Web nameHelpers normalize and compare confirmed Google legal names", () => {
  assert.equal(
    constructCanonicalFullName({
      firstName: "  Juan   Miguel ",
      middleName: " Santos ",
      lastName: " Dela Cruz ",
      suffix: " Jr. ",
    }),
    "Juan Miguel Santos Dela Cruz Jr."
  );

  assert.equal(
    doesConfirmedNameMatchDisplayed("JUAN MIGUEL SANTOS DELA CRUZ JR", {
      firstName: "Juan Miguel",
      middleName: "Santos",
      lastName: "Dela Cruz",
      suffix: "Jr.",
    }),
    true
  );

  assert.equal(
    doesConfirmedNameMatchDisplayed("Maria Clara", {
      firstName: "Juan",
      middleName: "",
      lastName: "Dela Cruz",
      suffix: "",
    }),
    false
  );

  assert.equal(normalizeNameForComparison("José Rizal"), "JOSE RIZAL");
});

test("Web Government ID error presentation handles LEGAL_NAME_CONFIRMATION_REQUIRED", () => {
  const presentation = getGovernmentIdErrorPresentation({
    code: "LEGAL_NAME_CONFIRMATION_REQUIRED",
  });
  assert.equal(presentation.kind, "BUSINESS_REJECTION");
  assert.match(presentation.message, /confirm or correct your legal name/i);
});

test("Web ProfilePage uses Full Name label, legal-name confirmation prompt, and Government ID prompt", () => {
  const src = readFileSync(
    new URL("../src/pages/dashboard/ProfilePage.tsx", import.meta.url),
    "utf8"
  );
  assert.equal(src.includes('label="Display Name"'), false);
  assert.equal(src.includes('label="Full Name"'), true);
  assert.equal(
    src.includes(
      "Is this your actual full legal name as shown on your Government ID?"
    ),
    true
  );
  assert.equal(src.includes("Yes, this is my legal name"), true);
  assert.equal(src.includes("No, I need to correct my name"), true);
  assert.equal(
    src.includes(
      "Your legal name has been saved successfully. Please verify your Government ID to confirm your identity and access document requests."
    ),
    true
  );
  assert.equal(src.includes("Verify Government ID Now"), true);
  assert.equal(src.includes("isLegalNameLocked || needsLegalNameConfirmation"), true);
});

