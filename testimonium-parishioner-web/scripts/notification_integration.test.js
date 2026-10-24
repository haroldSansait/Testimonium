import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromePath, notificationBrowser } from './helpers/notification-browser.js';

const notification = (id, overrides = {}) => ({ id, title: `Notification ${id}`, message: `Message ${id}`,
  type: 'general', read: false, createdAt: new Date().toISOString(), referenceType: null, referenceId: null, ...overrides });
const history = [notification('historical-1'), notification('historical-2', { read: true })];
const review = notification('test-new-100', { title: 'Request Under Review',
  message: 'Your document request is now under review.', referenceType: 'DOCUMENT_REQUEST', referenceId: 100 });
const cards = '[aria-label="Notification alerts"] > [role="button"]';
const individuals = `${cards}[aria-label^="Notification:"]`;
const loginItems = count => Array.from({ length: count }, (_, i) => notification(`login-${i}`, {
  createdAt: new Date(Date.UTC(2026, 9, 24, 0, i)).toISOString(),
}));

describe('Real notification provider → query → rendered dashboard toast (Chrome)', { skip: !chromePath && 'Chrome/Chromium unavailable; set CHROME_PATH to run browser integration', timeout: 300000 }, () => {
  let browser;
  before(async () => { browser = await notificationBrowser(); });
  after(async () => { await browser?.close(); });
  beforeEach(async () => {
    // A new scenario is a genuine logout/login; navigation/reload within a
    // scenario deliberately retains sessionStorage to test replay suppression.
    await browser.waitFor('typeof window.fixture?.session === "function"');
    await browser.evaluate('window.fixture.session(null)');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    // Each scenario gets a fresh document so drawer animations, focus and viewport
    // state cannot leak into another scenario. Session behavior is tested within a scenario.
    await browser.send('Page.navigate', { url: `${browser.origin}/dashboard/home` });
    await browser.waitFor('window.fixture?.notifications?.loading && window.fixture.calls >= 1');
    await browser.waitFor(`document.querySelectorAll('${cards}').length === 0`);
  });
  const loadHistory = async () => {
    await browser.evaluate(`window.fixture.initial(${JSON.stringify(history)})`);
    await browser.waitFor('!window.fixture.notifications.loading && window.fixture.notifications.notifications.length === 2');
    await browser.waitFor(`Boolean(document.querySelector('button[aria-label="Dismiss notification: Notification historical-1"]'))`);
    await browser.evaluate(`document.querySelector('button[aria-label="Dismiss notification: Notification historical-1"]').click()`);
    await browser.waitFor(`document.querySelectorAll('${cards}').length === 0`);
  };
  const loadLogin = async items => {
    await browser.evaluate(`window.fixture.initial(${JSON.stringify(items)})`);
    await browser.waitFor(`!window.fixture.notifications.loading && window.fixture.notifications.notifications.length === ${items.length} && window.fixture.notifications.loginBacklog !== null`);
  };
  const arrive = async items => {
    await browser.evaluate(`window.fixture.respond(${JSON.stringify([...history, ...items])}); window.fixture.notifications.refresh()`);
    await browser.waitFor(`window.fixture.notifications.notifications.length === ${history.length + items.length}`);
  };
  const click = async selector => {
    await browser.waitFor(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false;
      for (let parent = e; parent; parent = parent.parentElement) {
        if (parent.getAnimations().some(a => a.playState === 'running')) return false;
      }
      const r = e.getBoundingClientRect(); return r.width > 0 && e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()`);
    const point = await browser.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const key = async name => {
    const code = name === 'Enter' ? 13 : 32;
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name === 'Enter' ? 'Enter' : 'Space', windowsVirtualKeyCode: code, text: name === 'Enter' ? '\r' : ' ' });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name === 'Enter' ? 'Enter' : 'Space', windowsVirtualKeyCode: code });
  };

  it('waits for the first successful snapshot, shows its unread item, then renders a live polling arrival without duplicates', async () => {
    const { evaluate, waitFor } = browser;
    assert.equal(await evaluate('window.fixture.notifications.loading'), true);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0);
    await evaluate(`window.fixture.initial(${JSON.stringify(history)})`);
    await waitFor('!window.fixture.notifications.loading');
    await waitFor(`document.querySelectorAll('${individuals}').length === 1`);
    await click('button[aria-label="Dismiss notification: Notification historical-1"]');
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    // Wait for the application's actual 30-second poll; no injected arrival IDs or reducer calls.
    await evaluate(`window.fixture.respond(${JSON.stringify([...history, review])})`);
    await waitFor(`(() => { const card = document.querySelector('${cards}');
      if (card?.querySelector('h4')?.textContent !== 'Request Under Review' || !window.fixture.notifications.newlyArrivedIds.includes('test-new-100')) return false;
      card.focus(); return true; })()`, 45000);
    assert.equal(await evaluate('window.fixture.notifications.unreadCount'), 2);
    assert.equal(await evaluate(`document.querySelector('${cards} p').textContent`), review.message);
    await evaluate('window.fixture.notifications.refresh()');
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 1);
    const geometry = await evaluate(`(() => {
      const card = document.querySelector('${cards}'); const r = card.getBoundingClientRect();
      const layer = card.parentElement; const style = getComputedStyle(card);
      return { width: r.width, height: r.height, top: r.top, right: r.right,
        display: style.display, visibility: style.visibility, opacity: style.opacity, background: style.backgroundColor,
        z: getComputedStyle(layer).zIndex, headerZ: getComputedStyle(document.querySelector('header')).zIndex,
        clickable: card.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        outsideMain: !layer.closest('main'), badge: document.querySelector('header a[aria-label]').getAttribute('aria-label') };
    })()`);
    assert.ok(geometry.width > 0 && geometry.height > 0 && geometry.top >= 64 && geometry.right <= 1280);
    assert.equal(geometry.visibility, 'visible'); assert.notEqual(geometry.display, 'none');
    assert.equal(geometry.opacity, '1'); assert.equal(geometry.background, 'rgb(255, 255, 255)');
    assert.ok(Number(geometry.z) > Number(geometry.headerZ));
    assert.equal(geometry.clickable, true); assert.equal(geometry.outsideMain, true);
    assert.equal(geometry.badge, '2 unread notifications');
    await evaluate(`window.fixture.toast.success('Ordinary application toast', 0)`);
    await waitFor('document.querySelector("[role=alert]")?.textContent.includes("Ordinary application toast")');
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 1);
    await click('button[aria-label="Dismiss notification: Request Under Review"]');
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    assert.deepEqual(await evaluate('window.fixture.reads'), []);
    assert.equal(await evaluate('window.fixture.notifications.notifications.find(n => n.id === "test-new-100").read'), false);
    // Disappearance, reappearance, rerenders and unread changes must not re-toast a known ID.
    await arrive([]); await arrive([{ ...review, read: true }]); await arrive([review]);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0);
    assert.equal(await evaluate('location.pathname'), '/dashboard/home');
  });

  for (const count of [1, 3, 8]) {
    it(`login with ${count} unread notifications renders the newest three first and the exact remaining summary`, async () => {
      const { evaluate, waitFor } = browser;
      await loadLogin(loginItems(count)); // Deliberately oldest-first API response.
      await waitFor(`document.querySelectorAll('${individuals}').length === ${Math.min(count, 3)}`);
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('${individuals} h4'), e => e.textContent)`),
        Array.from({ length: Math.min(count, 3) }, (_, i) => `Notification login-${count - 1 - i}`));
      assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), count > 3 ? 4 : count);
      assert.equal(await evaluate('window.fixture.notifications.unreadCount'), count);
      assert.deepEqual(await evaluate('window.fixture.reads'), []);
      if (count === 8) {
        const summary = '[aria-label="5 more unread notifications. Click to open notification center."]';
        await waitFor(`Boolean(document.querySelector('${summary}'))`);
        assert.equal(await evaluate(`document.querySelector('${summary} h4').textContent`), '+5 more unread notifications');
        await evaluate('window.fixture.notifications.refresh()');
        await click(summary);
        await waitFor('location.pathname === "/dashboard/notifications" && Boolean(document.getElementById("notification-login-0"))');
        assert.equal(await evaluate('window.fixture.notifications.unreadCount'), 8, 'Opening the summary does not mark the backlog read');
        assert.deepEqual(await evaluate('window.fixture.reads'), []);
        await evaluate(`document.querySelectorAll('${individuals} button').forEach(button => button.click())`);
        await waitFor(`document.querySelectorAll('${cards}').length === 0`);
        await evaluate('window.fixture.notifications.refresh()');
        assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0, 'The other five unread items must stay in the center, not replay through the queue');
      }
    });
  }

  it('login filters mixed read/unread history before selecting the three newest unread items', async () => {
    const items = loginItems(8).map((item, i) => ({ ...item, read: i % 2 === 1 }));
    await loadLogin(items);
    await browser.waitFor(`document.querySelectorAll('${individuals}').length === 3`);
    assert.deepEqual(await browser.evaluate(`Array.from(document.querySelectorAll('${individuals} h4'), e => e.textContent)`),
      ['Notification login-6', 'Notification login-4', 'Notification login-2']);
    assert.equal(await browser.evaluate('window.fixture.notifications.unreadCount'), 4);
    assert.equal(await browser.evaluate(`document.querySelector('${cards}:last-child h4').textContent`), '+1 more unread notification');
  });

  it('login with no unread notifications shows nothing and still accepts the next live arrival', async () => {
    await loadLogin(loginItems(3).map(item => ({ ...item, read: true })));
    assert.equal(await browser.evaluate(`document.querySelectorAll('${cards}').length`), 0);
    await browser.evaluate(`window.fixture.respond([]); window.fixture.session('empty-history')`);
    await browser.waitFor('!window.fixture.notifications.loading && window.fixture.notifications.notifications.length === 0 && window.fixture.notifications.loginBacklog !== null');
    assert.equal(await browser.evaluate(`document.querySelectorAll('${cards}').length`), 0);
    await browser.evaluate(`window.fixture.respond(${JSON.stringify([review])}); window.fixture.notifications.refresh()`);
    await browser.waitFor(`document.querySelector('${individuals} h4')?.textContent === 'Request Under Review'`);
  });

  it('mobile login displays two cards, queues the third newest item, and defers the summary to a free slot', async () => {
    const { evaluate, waitFor, send } = browser;
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await loadLogin(loginItems(8));
    await waitFor(`document.querySelectorAll('${individuals}').length === 2`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('${individuals} h4'), e => e.textContent)`), ['Notification login-7', 'Notification login-6']);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 2);
    await click('button[aria-label="Dismiss notification: Notification login-7"]');
    await waitFor(`document.querySelector('${individuals}:last-child h4')?.textContent === 'Notification login-5'`);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 2);
    await click('button[aria-label="Dismiss notification: Notification login-6"]');
    await waitFor(`document.querySelector('${cards}:last-child h4')?.textContent === '+5 more unread notifications'`);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 2);
    assert.deepEqual(await evaluate('window.fixture.reads'), []);
  });

  it('ordinary navigation, refetch, and an actual Chrome page reload do not replay the unread backlog', async () => {
    const { evaluate, waitFor, send } = browser;
    const items = loginItems(3);
    await loadLogin(items);
    await waitFor(`document.querySelectorAll('${individuals}').length === 3`);
    await evaluate(`document.querySelectorAll('${individuals} button').forEach(button => button.click())`);
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    await evaluate(`window.fixture.navigate('/dashboard/notifications'); window.fixture.notifications.refresh()`);
    await waitFor('Boolean(document.getElementById("notification-login-2"))');
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0);
    await evaluate(`window.fixture.navigate('/dashboard/home')`);
    await send('Page.reload');
    await waitFor('window.fixture?.notifications?.loading && window.fixture.calls >= 1');
    await evaluate(`window.fixture.initial(${JSON.stringify(items)})`);
    await waitFor('!window.fixture.notifications.loading && window.fixture.notifications.notifications.length === 3');
    assert.equal(await evaluate('window.fixture.notifications.loginBacklog'), null);
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0);
    await evaluate(`window.fixture.respond(${JSON.stringify([...items, review])}); window.fixture.notifications.refresh()`);
    await waitFor(`document.querySelector('${individuals} h4')?.textContent === 'Request Under Review'`);
    assert.equal(await evaluate('window.fixture.notifications.notifications.find(n => n.id === "login-2").read'), false);
  });

  it('opening login backlog toasts uses contextual navigation and updates read state only for opened items', async () => {
    const { evaluate, waitFor } = browser;
    await loadLogin([notification('login-document', { referenceType: 'DOCUMENT_REQUEST', referenceId: 301 }),
      notification('login-schedule', { referenceType: 'SCHEDULE_REQUEST', referenceId: 302 })]);
    await waitFor(`document.querySelectorAll('${individuals}').length === 2`);
    await click('[aria-label="Notification: Notification login-document. Click to view details."] h4');
    await waitFor('location.pathname + location.search === "/dashboard/track?requestId=301" && window.fixture.reads.includes("login-document")');
    assert.equal(await evaluate('window.fixture.notifications.notifications.find(n => n.id === "login-schedule").read'), false);
    await click('[aria-label="Notification: Notification login-schedule. Click to view details."] h4');
    await waitFor('location.pathname === "/dashboard/schedule/302" && window.fixture.reads.includes("login-schedule")');
    assert.equal(await evaluate('window.fixture.notifications.unreadCount'), 0);
  });

  it('dismissing or expiring a login backlog toast leaves the underlying notification unread', async () => {
    const { evaluate, waitFor, send } = browser;
    await loadLogin(loginItems(3));
    await waitFor(`document.querySelectorAll('${individuals}').length === 3`);
    await click('button[aria-label="Dismiss notification: Notification login-2"]');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await evaluate('document.activeElement?.blur()');
    await waitFor(`document.querySelectorAll('${cards}').length === 0`, 10000);
    assert.equal(await evaluate('window.fixture.notifications.unreadCount'), 3);
    assert.deepEqual(await evaluate('window.fixture.reads'), []);
  });

  it('Enter and Space on X only dismiss; keyboard/body actions mark read and navigate contextually', async () => {
    const { evaluate, waitFor } = browser;
    await loadHistory();
    for (const name of ['Enter', ' ']) {
      const item = notification(`dismiss-${name}`, { title: `Dismiss ${name}` });
      await arrive([item]);
      const selector = `button[aria-label=${JSON.stringify(`Dismiss notification: ${item.title}`)}]`;
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await key(name);
      await waitFor(`document.querySelectorAll('${cards}').length === 0`);
      assert.deepEqual(await evaluate('window.fixture.reads'), []);
      assert.equal(await evaluate('location.pathname'), '/dashboard/home');
      assert.equal(await evaluate(`window.fixture.notifications.notifications.find(n => n.id === ${JSON.stringify(item.id)}).read`), false);
    }
    for (const [index, action] of ['Enter', ' ', 'click', 'click'].entries()) {
      const item = notification(`open-${index}`, { referenceType: index === 3 ? 'GENERAL' : index === 1 ? 'SCHEDULE_REQUEST' : 'DOCUMENT_REQUEST', referenceId: 101 + index });
      await arrive([item]);
      await waitFor(`document.querySelectorAll('${cards}').length === 1`);
      if (action === 'click') await click(`${cards} h4`);
      else { await evaluate(`document.querySelector('${cards}').focus()`); await key(action); }
      const path = index === 3 ? '/dashboard/notifications?notificationId=open-3' : index === 1 ? `/dashboard/schedule/${101 + index}` : `/dashboard/track?requestId=${101 + index}`;
      await waitFor(`location.pathname + location.search === ${JSON.stringify(path)}`);
      await waitFor(`window.fixture.reads.includes(${JSON.stringify(item.id)})`);
      assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 0);
    }
  });

  it('resizes the actual stack to two mobile cards, preserves FIFO and stays below drawer/modals', async () => {
    const { evaluate, waitFor, send } = browser;
    await loadHistory();
    await arrive(Array.from({ length: 6 }, (_, index) => notification(`stack-${index}`)));
    await waitFor(`document.querySelectorAll('${cards}').length === 3`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor(`document.querySelectorAll('${cards}').length === 2`);
    assert.equal(await evaluate(`(() => { const r = [...document.querySelectorAll('${cards}')].map(e => e.getBoundingClientRect()); return r[0].bottom < r[1].top && r.every(x => x.width > 0 && x.height > 0 && x.left >= 0 && x.right <= innerWidth); })()`), true);
    await click('button[aria-label="Open navigation menu"]');
    await waitFor(`document.querySelector('button[aria-label="Open navigation menu"]').getAttribute('aria-expanded') === 'true'`);
    assert.equal(await evaluate(`(() => { const r = document.querySelector('${cards}').getBoundingClientRect(); return !document.querySelector('[aria-label="Notification alerts"]').contains(document.elementFromPoint(r.right - 20, r.top + 20)); })()`), true);
    await click('button[aria-label="Close navigation"]');
    await click('button[aria-label="Dismiss notification: Notification stack-0"]');
    await waitFor('!document.querySelector(\'button[aria-label="Dismiss notification: Notification stack-0"]\')');
    await waitFor(`document.querySelector('${cards}:last-child h4')?.textContent === 'Notification stack-2'`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor(`document.querySelectorAll('${cards}').length === 3`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('${cards} h4'), e => e.textContent)`), ['Notification stack-1', 'Notification stack-2', 'Notification stack-3']);
    await click('button[aria-label="Help Center"]');
    await waitFor('Boolean(document.querySelector("[aria-labelledby=modal-dialog-title]"))');
    assert.equal(await evaluate(`(() => { const r = document.querySelector('${cards}').getBoundingClientRect(); return document.querySelector('[aria-labelledby="modal-dialog-title"]').contains(document.elementFromPoint(r.right - 20, r.top + 20)); })()`), true);
    await evaluate('document.querySelector("[aria-labelledby=modal-dialog-title]").click()');
  });

  it('retries cancelled deep-link scrolling, expires highlights, and supports unread tabs and repeated navigation', async () => {
    const { evaluate, waitFor } = browser;
    await loadHistory();
    const longHistory = Array.from({ length: 30 }, (_, i) => notification(`long-${i}`));
    const target = notification('deep-target', { read: true });
    await evaluate(`window.fixture.respond(${JSON.stringify([...history, ...longHistory, target])}); window.fixture.session('deep-link-history')`);
    await waitFor('!window.fixture.notifications.loading && window.fixture.notifications.notifications.length === 33');
    await evaluate(`window.fixture.navigate('/dashboard/notifications')`);
    await waitFor(`Array.from(document.querySelectorAll('button')).some(e => e.textContent.startsWith('Unread ('))`);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(e => e.textContent.startsWith('Unread (')).click()`);
    await waitFor('!document.getElementById("notification-deep-target")');
    // Update the query inside scrollIntoView's pending window, reproducing the old cancellation.
    await evaluate(`window.fixture.navigate('/dashboard/notifications?notificationId=deep-target'); setTimeout(() => {
      window.fixture.respond(window.fixture.notifications.notifications.map(n => n.id === 'deep-target' ? { ...n, message: 'Updated during pending scroll' } : n));
      void window.fixture.notifications.refresh();
    }, 60)`);
    await waitFor('document.activeElement?.id === "notification-deep-target" && document.activeElement.classList.contains("animate-highlight")');
    assert.equal(await evaluate('document.getElementById("notification-deep-target").classList.contains("animate-highlight")'), true);
    await waitFor('(() => { const r = document.getElementById("notification-deep-target").getBoundingClientRect(); return r.top >= 64 && r.bottom <= innerHeight; })()');
    await evaluate(`window.fixture.respond(window.fixture.notifications.notifications.map(n => ({ ...n, message: n.message + ' refreshed' }))); window.fixture.notifications.refresh()`);
    await waitFor('!document.getElementById("notification-deep-target").classList.contains("animate-highlight")', 6000);
    await evaluate(`document.activeElement.blur(); document.getElementById('main-content').scrollTop = 0; window.fixture.navigate('/dashboard/notifications?notificationId=deep-target')`);
    await waitFor('document.activeElement?.id === "notification-deep-target"');
    await evaluate(`window.fixture.navigate('/dashboard/notifications'); Array.from(document.querySelectorAll('button')).find(e => e.textContent.startsWith('Unread (')).click()`);
    await waitFor('!document.getElementById("notification-deep-target")');
    await evaluate(`Array.from(document.querySelectorAll('button')).find(e => e.textContent === 'All Notifications').click()`);
    await waitFor('Boolean(document.getElementById("notification-deep-target"))');
  });

  it('same-UID logout/login reevaluates current unread and offline arrivals; account switching clears the old stack and queue', async () => {
    const { evaluate, waitFor } = browser;
    await loadHistory();
    const burst = Array.from({ length: 14 }, (_, i) => notification(`session-${i}`));
    await arrive(burst);
    await waitFor(`document.querySelectorAll('${cards}').length === 3`);
    await evaluate('window.fixture.session(null)');
    await waitFor(`document.querySelectorAll('${cards}').length === 0 && window.fixture.notifications.unreadCount === 0`);
    const offline = notification('offline-arrival', { createdAt: new Date(Date.now() + 1000).toISOString() });
    const current = [...history, ...burst.map(n => ({ ...n, read: n.id === 'session-0' })), offline];
    await evaluate(`window.fixture.respond(${JSON.stringify(current)}); window.fixture.session('fixture-a')`);
    await waitFor(`!window.fixture.notifications.loading && document.querySelectorAll('${individuals}').length === 3`);
    assert.equal(await evaluate(`document.querySelector('${individuals} h4').textContent`), 'Notification offline-arrival');
    assert.equal(await evaluate(`document.querySelectorAll('${cards}').length`), 4);
    assert.equal(await evaluate(`document.querySelector('${cards}:last-child h4').textContent`), '+12 more unread notifications');
    await evaluate(`document.querySelectorAll('${cards} button').forEach(button => button.click())`);
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    await arrive([review]);
    await waitFor(`document.querySelectorAll('${cards}').length === 1`);
    await evaluate(`window.fixture.session('direct-switch')`);
    await waitFor(`document.querySelectorAll('${individuals}').length === 2 && !window.fixture.notifications.loading`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('${individuals} h4'), e => e.textContent).sort()`),
      ['Notification historical-1', 'Request Under Review']);
    await evaluate(`document.querySelectorAll('${cards} button').forEach(button => button.click())`);
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    await arrive([review, notification('post-switch')]);
    await waitFor(`document.querySelector('${cards} h4')?.textContent === 'Notification post-switch'`);
    await evaluate('window.fixture.session(null)');
    await waitFor(`document.querySelectorAll('${cards}').length === 0`);
    assert.deepEqual(browser.errors, []);
  });
  it('auto-dismisses after seven seconds, pauses for focus/hover/visibility, and preserves unread state', async () => {
    const { evaluate, waitFor, send } = browser;
    await loadHistory();
    await arrive([review]);
    await waitFor(`document.querySelectorAll('${cards}').length === 1`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    // Keep real-time assertions inside the browser so CDP/host scheduling delays
    // cannot turn a 5.5-second observation into one made after the seven-second expiry.
    const result = await evaluate(`(async () => {
      const card = document.querySelector('${cards}');
      const elapse = ms => new Promise(done => setTimeout(done, ms));
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const present = () => card.isConnected;
      try {
        card.focus();
        check(document.activeElement === card && document.hasFocus(), 'Toast must receive browser focus');
        await elapse(8000); check(present(), 'Focus must pause expiration');
        card.blur();
        card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
        await elapse(8000); check(present(), 'Hover must pause expiration');
        card.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        await elapse(8000); check(present(), 'Hidden-tab event must pause expiration');
        delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
        await elapse(5500); check(present(), 'Toast must retain its remaining time after resuming');
        for (let i = 0; i < 30 && present(); i++) await elapse(100);
        check(!present(), 'Toast must auto-dismiss after its remaining seven-second duration');
        return { unread: window.fixture.notifications.unreadCount, reads: window.fixture.reads };
      } finally { delete document.visibilityState; }
    })()`);
    assert.equal(result.unread, 2);
    assert.deepEqual(result.reads, []);
  });

});
