import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromePath, schedulerBrowser } from './helpers/scheduler-browser.js';

describe('Web scheduler with real React UI and API provider (Chrome, controlled transport)', { skip: !chromePath, timeout: 180000 }, () => {
  let browser;
  before(async () => { browser = await schedulerBrowser(); });
  after(async () => { await browser?.close(); });
  beforeEach(async () => {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${browser.origin}/dashboard/schedule` });
    await browser.waitFor('window.fixture && document.body.textContent.includes("Target Parish Office")');
  });
  const clickText = async (text) => {
    const expression = `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled)`;
    await browser.waitFor(`Boolean(${expression})`);
    await browser.evaluate(`(${expression}).click()`);
  };
  const choose = async (service = 'Baptism') => {
    await clickText('Next Step'); await clickText(service); await clickText('Next Step');
    await browser.waitFor(`Boolean(document.querySelector('button[title$=" is available"]'))`);
    await browser.evaluate(`document.querySelector('button[title$=" is available"]').click()`);
    await clickText('Next Step'); await clickText('08:00 AM');
  };
  const upload = async (id, name = 'evidence.pdf', type = 'application/pdf', content = '%PDF example') => {
    await browser.evaluate(`(() => { const input = document.getElementById('schedule-file-${id}'); const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} }));
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  };

  it('requires every document, validates files, replaces/removes selections, and submits once on a narrow viewport', async () => {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await choose('Marriage (Canonical Interview)'); await clickText('Next Step');
    await browser.waitFor(`document.querySelectorAll('input[type=file]').length === 3`);
    assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm Booking').disabled`), true);
    await upload('cenomar', 'bad.exe', 'application/octet-stream');
    await browser.waitFor(`document.body.innerText.includes('Unsupported file format')`);
    await upload('cenomar'); await upload('marriage_license'); await upload('baptismal_cert');
    await browser.waitFor(`!Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm Booking').disabled`);
    await upload('cenomar', 'replacement.pdf');
    await browser.waitFor(`document.body.innerText.includes('replacement.pdf')`);
    await clickText('Remove');
    await browser.waitFor(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm Booking').disabled`);
    await upload('cenomar', 'final.pdf');
    await browser.evaluate(`window.fixture.hold = true`);
    await clickText('Confirm Booking');
    await browser.waitFor(`window.fixture.bookings.length === 1`);
    assert.equal(await browser.evaluate(`document.querySelector('fieldset').disabled`), true);
    await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Booking')).click(); window.fixture.hold = false`);
    await browser.waitFor(`document.body.innerText.includes('Schedule Request Submitted')`);
    const calls = await browser.evaluate('window.fixture.bookings');
    assert.equal(calls.length, 1); assert.equal(calls[0].endpoint, '/schedule-requests/web');
    assert.deepEqual(calls[0].ids, ['baptismal_cert', 'cenomar', 'marriage_license']);
    assert.ok(calls[0].files.includes('final.pdf'));
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  });

  it('clears documents after changing service and loads the new service dates', async () => {
    await choose(); await clickText('Next Step'); await upload('birth_cert');
    await clickText('Back'); await clickText('Back'); await clickText('Back');
    await clickText('Marriage (Canonical Interview)'); await clickText('Next Step');
    await browser.waitFor(`Boolean(document.querySelector('button[title$=" is available"]'))`);
    await browser.evaluate(`document.querySelector('button[title$=" is available"]').click()`);
    await clickText('Next Step'); await clickText('08:00 AM'); await clickText('Next Step');
    assert.equal(await browser.evaluate(`document.body.innerText.includes('evidence.pdf')`), false);
    assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm Booking').disabled`), true);
  });

  it('uses the new parish configuration and clears previously selected documents', async () => {
    await choose(); await clickText('Next Step'); await upload('birth_cert');
    await clickText('Back'); await clickText('Back'); await clickText('Back'); await clickText('Back');
    await browser.evaluate(`document.querySelector('button[aria-label="Select parish..."]').click()`);
    await browser.waitFor(`document.querySelectorAll('[role=option]').length === 2`);
    await browser.evaluate(`Array.from(document.querySelectorAll('[role=option]')).find(e => e.textContent.includes('Second Parish')).click()`);
    await choose(); await clickText('Confirm Booking');
    await browser.waitFor(`document.body.innerText.includes('Schedule Request Submitted')`);
    const call = await browser.evaluate('window.fixture.bookings[0]');
    assert.equal(call.booking.parishId, 52); assert.deepEqual(call.ids, []); assert.deepEqual(call.files, []);
  });

  it('refreshes changed requirements after rejection and keeps a retry idempotent', async () => {
    await choose(); await clickText('Next Step'); await upload('birth_cert');
    await browser.evaluate(`window.fixture.nextError = 'SCHEDULE_REQUIREMENTS_CHANGED'; window.fixture.configs['51'].BAPTISM.push({ id: 'marriage_cert', label: 'Marriage Certificate' })`);
    await clickText('Confirm Booking');
    await browser.waitFor(`document.getElementById('schedule-file-marriage_cert')`);
    assert.equal(await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Confirm Booking').disabled`), true);
    assert.equal(await browser.evaluate(`document.body.innerText.includes('evidence.pdf')`), true);
    await upload('marriage_cert', 'marriage.pdf');
    await browser.evaluate(`window.fixture.nextError = 'TEMPORARY_UPLOAD_FAILURE'`);
    await clickText('Confirm Booking'); await browser.waitFor(`window.fixture.bookings.length === 2 && !document.querySelector('fieldset').disabled`);
    // Reselecting identical evidence after an uncertain response remains the same submission.
    await upload('marriage_cert', 'marriage.pdf');
    await clickText('Confirm Booking'); await browser.waitFor(`document.body.innerText.includes('Schedule Request Submitted')`);
    const calls = await browser.evaluate('window.fixture.bookings');
    assert.notEqual(calls[0].key, calls[1].key); assert.equal(calls[1].key, calls[2].key);
  });

  it('skips uploads when the parish has no enabled prerequisites', async () => {
    await browser.evaluate(`window.fixture.configs['51'].BAPTISM = []; window.dispatchEvent(new Event('focus'))`);
    await choose(); await clickText('Confirm Booking');
    await browser.waitFor(`document.body.innerText.includes('Schedule Request Submitted')`);
    const call = await browser.evaluate('window.fixture.bookings[0]');
    assert.deepEqual(call.ids, []); assert.deepEqual(call.files, []);
    assert.equal(await browser.evaluate(`document.querySelectorAll('input[type=file]').length`), 0);
  });
});
