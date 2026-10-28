import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createParishMapFixture } from './fixtures/parishMapFixture.js';
import { ParishService } from '../services/ParishService.js';

async function fixture(t) {
  const state = createParishMapFixture(t.mock);
  t.after(state.restore);
  const server = state.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = async (path, body, role, method = 'PATCH') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/parishes${path}`, {
      method, headers: { 'content-type': 'application/json', ...(role ? { 'x-fixture-role': role } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, ...await response.json() };
  };
  return { ...state, request };
}

test('directory PATCH persists through the real router/controller/service and reloads all three fields', async (t) => {
  const { request, rows, audits } = await fixture(t);
  const original = structuredClone(rows[0]);
  const payload = { directoryDescription: 'Saved <b>directory</b> description', contactNumber: '09987654321', email: 'saved@example.test' };
  const saved = await request('/1/directory-settings', payload);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.directoryDescription, 'Saved directory description');
  const reloaded = (await request('/map-config', undefined, undefined, 'GET')).data.find((parish) => parish.id === '1');
  for (const field of ['directoryDescription', 'contactNumber', 'email']) assert.equal(reloaded[field], saved.data[field]);
  assert.equal(rows[0].contactNumber, payload.contactNumber);
  assert.equal(rows[0].email, payload.email);
  for (const field of ['latitude', 'longitude', 'pinColor', 'mapZoom', 'showLabel', 'locationUpdatedAt', 'documentSettings', 'eventSettings', 'officeHours']) {
    assert.deepEqual(rows[0][field], original[field]);
  }
  assert.equal(audits.at(-1)[1], 'Parish Directory Settings Updated');
});

test('directory route remains coordinator-only, authenticated, validated, and separate from general settings', async (t) => {
  const { request, writes } = await fixture(t);
  for (const role of ['SECRETARY', 'PRIEST', 'PARISHIONER']) {
    assert.equal((await request('/1/directory-settings', { directoryDescription: 'Denied' }, role)).status, 403);
  }
  assert.equal((await request('/1/directory-settings', {}, 'ANONYMOUS')).status, 401);
  assert.equal((await request('/1/directory-settings', { email: 'invalid' })).status, 400);
  assert.equal((await request('/1/directory-settings', { directoryDescription: 42 })).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await request('/999/directory-settings', { directoryDescription: 'Missing' })).status, 404);
});

test('existing general PATCH and PUT preserve payload forwarding, staff roles and tenant restrictions', async (t) => {
  const { request } = await fixture(t);
  const calls = [];
  t.mock.method(ParishService.prototype, 'editParish', async (...args) => { calls.push(args); return { id: args[0] }; });
  const payload = { documentSettings: {}, eventSettings: {}, officeHours: {}, venueCapacity: 100 };
  for (const method of ['PATCH', 'PUT']) {
    for (const role of ['DIOCESE_COORDINATOR', 'SECRETARY']) {
      assert.equal((await request('/1/settings', payload, role, method)).status, 200);
      assert.deepEqual(calls.at(-1), ['1', payload, 10, role]);
    }
    assert.equal((await request('/1/settings', { venueCapacity: 150 }, 'PRIEST', method)).status, 200);
    assert.equal((await request('/1/settings', payload, 'PRIEST', method)).status, 403);
    assert.equal((await request('/2/settings', payload, 'SECRETARY', method)).status, 403);
  }
  assert.equal(calls.length, 6);
});

test('map batch plus directory PATCH reloads all values and retains optimistic locking and audit calls', async (t) => {
  const { request, rows, audits } = await fixture(t);
  const originalTimestamp = rows[0].locationUpdatedAt.toISOString();
  const map = { id: '1', latitude: 10.5, longitude: 123.3, mapZoom: 16, pinColor: '#10b981', showLabel: false, locationUpdatedAt: originalTimestamp };
  const saved = await request('/map-config/batch', { updates: [map] });
  assert.equal(saved.status, 200);
  assert.notEqual(saved.data[0].locationUpdatedAt, originalTimestamp);
  assert.equal((await request('/1/directory-settings', { directoryDescription: 'Combined save', contactNumber: '09999999999', email: 'combined@example.test' })).status, 200);
  const reloaded = (await request('/map-config', undefined, undefined, 'GET')).data[0];
  for (const field of ['latitude', 'longitude', 'mapZoom', 'pinColor', 'showLabel']) assert.equal(reloaded[field], map[field]);
  assert.equal(reloaded.directoryDescription, 'Combined save');
  assert.equal(reloaded.contactNumber, '09999999999');
  assert.equal(reloaded.email, 'combined@example.test');
  assert.equal(reloaded.locationUpdatedAt, saved.data[0].locationUpdatedAt);
  const beforeConflict = structuredClone(rows);
  assert.equal((await request('/map-config/batch', { updates: [{ ...map, latitude: 10.6 }] })).status, 409);
  assert.deepEqual(rows, beforeConflict);
  assert.equal((await request('/map-config/batch', { updates: [{ ...map, latitude: 12 }] })).status, 400);
  assert.ok(audits.some((entry) => entry[1] === 'Parish Coordinates Updated'));
  assert.ok(audits.some((entry) => entry[1] === 'Parish Directory Settings Updated'));
});
