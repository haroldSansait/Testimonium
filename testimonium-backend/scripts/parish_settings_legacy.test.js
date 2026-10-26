import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentSettingsForSave } from '../config/documents.js';
import { prisma } from '../config/db.js';
import { ParishService } from '../services/ParishService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { ScheduleAvailabilityService } from '../services/ScheduleAvailabilityService.js';
import { WEEKDAYS } from '../services/SchedulingAvailability.js';
import { DocumentRequirementService } from '../services/DocumentRequirementService.js';

const historical = () => ({
  BAPTISMAL_CERTIFICATE: { price: 150, note: 'Keep', requirements: { gkk_endorsement: true, valid_id: false, endorsement_letter: false } },
  CONFIRMATION_CERTIFICATE: { requirements: { gkk_endorsement: true } },
  ENDORSEMENT: { price: 75, requirements: { old_requirement: true } },
  paymentMethods: { gcash: true, maya: false },
});
function stub(t, target, key, value) {
  const original = target[key]; target[key] = value; t.after(() => { target[key] = original; });
}
function fixture(t) {
  const row = { id: 2, parishName: 'Fixture', users: [], documentSettings: JSON.stringify(historical()),
    eventSettings: JSON.stringify({ FUNERAL: { requirements: { death_cert: true } } }),
    schedulingConfigVersion: 4, officeHours: '{}', availableDocuments: ['BAPTISMAL_CERTIFICATE'],
    paymentQrEnabled: true, paymentQrImage: '/qr.png', venueCapacity: 100 };
  const writes = []; const locks = [];
  const tx = { $queryRaw: async (sql, id) => { locks.push(id); return [{ parish_id: row.id }]; }, parish: {
    findUnique: async ({ where }) => { assert.equal(where.id, 2); return structuredClone(row); },
    update: async ({ where, data }) => {
      assert.equal(where.id, 2); writes.push(data);
      const increment = data.schedulingConfigVersion?.increment;
      const version = row.schedulingConfigVersion;
      Object.assign(row, data); if (increment) row.schedulingConfigVersion = version + increment;
      return structuredClone(row);
    },
  }, parishWeekdayRule: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} },
  parishServiceWeekdayRule: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} } };
  stub(t, prisma, '$transaction', async (callback) => callback(tx));
  stub(t, prisma.parish, 'findUnique', tx.parish.findUnique);
  t.mock.method(ParishService.prototype, 'getCanonicalParishDto', async () => ({ ...row, documentSettings: JSON.parse(row.documentSettings) }));
  t.mock.method(AuditLogService, 'log', async () => {});
  return { row, tx, writes, locks };
}

test('existing historical entries pass unchanged, omissions preserve them, and input is not mutated', () => {
  const stored = historical(); const original = structuredClone(stored);
  const incoming = { BAPTISMAL_CERTIFICATE: { price: 175, requirements: { valid_id: false, endorsement_letter: true } } };
  const result = validateDocumentSettingsForSave(incoming, JSON.stringify(stored));
  assert.equal(result.BAPTISMAL_CERTIFICATE.requirements.gkk_endorsement, true);
  assert.deepEqual(result.ENDORSEMENT, stored.ENDORSEMENT);
  assert.deepEqual(result.CONFIRMATION_CERTIFICATE, stored.CONFIRMATION_CERTIFICATE);
  assert.equal(result.BAPTISMAL_CERTIFICATE.requirements.valid_id, false);
  assert.deepEqual(stored, original);
  assert.equal(Object.hasOwn(incoming.BAPTISMAL_CERTIFICATE.requirements, 'gkk_endorsement'), false);
  assert.deepEqual(validateDocumentSettingsForSave(stored, stored), stored);
});

test('new unknown IDs, moved historical IDs, and changes to historical entries remain rejected', () => {
  const stored = historical();
  for (const input of [
    { BAPTISMAL_CERTIFICATE: { requirements: { unknown_new: true } } },
    { MARRIAGE_CERTIFICATE: { requirements: { gkk_endorsement: true } } },
    { BAPTISMAL_CERTIFICATE: { requirements: { gkk_endorsement: false } } },
    { ENDORSEMENT: { price: 80 } }, { NEW_DOCUMENT: {} },
    { BAPTISMAL_CERTIFICATE: { requirements: { endorsement_letter: 'false' } } },
  ]) assert.throws(() => validateDocumentSettingsForSave(input, stored), (e) => e.statusCode === 400);
  assert.throws(() => validateDocumentSettingsForSave(stored), /Invalid requirement ID/);
  assert.throws(() => validateDocumentSettingsForSave({ ENDORSEMENT: stored.ENDORSEMENT }, {}), /Invalid document type/);
});

test('document persistence uses locked parish history and canonical toggles never alias gkk_endorsement', async (t) => {
  const { row, locks } = fixture(t);
  const service = new ParishService();
  const initial = structuredClone(row);
  for (const enabled of [true, false, true]) {
    const settings = JSON.parse(row.documentSettings);
    settings.BAPTISMAL_CERTIFICATE.requirements.endorsement_letter = enabled;
    await service.editParish('2', { documentSettings: settings }, 10, 'SECRETARY');
    const saved = JSON.parse(row.documentSettings);
    assert.equal(saved.BAPTISMAL_CERTIFICATE.requirements.gkk_endorsement, true);
    assert.equal(saved.BAPTISMAL_CERTIFICATE.requirements.valid_id, false);
    assert.deepEqual(saved.ENDORSEMENT, historical().ENDORSEMENT);
    const requirements = await DocumentRequirementService.getRequirements('BAPTISMAL_CERTIFICATE', 2);
    assert.equal(requirements.requiredDocuments.some((r) => r.id === 'endorsement_letter'), enabled);
    assert.equal(requirements.requiredDocuments.some((r) => r.id === 'gkk_endorsement'), false);
    assert.equal(requirements.requiredDocuments.some((r) => r.id === 'valid_id'), false);
  }
  assert.deepEqual(locks, [2, 2, 2]);
  for (const key of ['eventSettings', 'officeHours', 'availableDocuments', 'paymentQrEnabled', 'paymentQrImage', 'venueCapacity', 'schedulingConfigVersion']) assert.deepEqual(row[key], initial[key]);
});

test('persistence rejects unknown new IDs without writes and cannot borrow another parish history', async (t) => {
  const { row, writes } = fixture(t); const before = structuredClone(row);
  await assert.rejects(new ParishService().editParish('2', { documentSettings: { BAPTISMAL_CERTIFICATE: { requirements: { unknown_new: true } } } }, 10, 'SECRETARY'), /Invalid requirement ID/);
  assert.equal(writes.length, 0); assert.deepEqual(row, before);
  row.documentSettings = '{}';
  await assert.rejects(new ParishService().editParish('2', { documentSettings: historical() }, 10, 'SECRETARY'), /Invalid requirement ID/);
  assert.equal(writes.length, 0);
});

test('Funeral disable and re-enable use existing versioned scheduling persistence with historical documents untouched', async (t) => {
  const { row, writes } = fixture(t); const before = structuredClone(row);
  const service = new ScheduleAvailabilityService();
  t.mock.method(service, 'getConfigurationWithClient', async () => structuredClone(row));
  const payload = (enabled, version = row.schedulingConfigVersion) => ({ expectedVersion: version,
    parishRules: WEEKDAYS.map((weekday) => ({ weekday, isAvailable: true })), serviceRules: [],
    eventSettings: { availableEvents: ['FUNERAL'], timeSlots: ['08:00 AM'], capacitySettings: { dailyLimit: 100, slotCapacity: 50 },
      FUNERAL: { requirements: { death_cert: enabled } } }, officeHours: {} });
  for (const enabled of [false, true]) {
    await service.replaceWeekdayRules('2', payload(enabled), 10);
    assert.equal(JSON.parse(row.eventSettings).FUNERAL.requirements.death_cert, enabled);
    assert.equal(row.documentSettings, before.documentSettings);
    assert.equal(Object.hasOwn(writes.at(-1), 'documentSettings'), false);
  }
  for (const key of ['availableDocuments', 'paymentQrEnabled', 'paymentQrImage', 'venueCapacity']) assert.deepEqual(row[key], before[key]);
  await assert.rejects(service.replaceWeekdayRules('2', payload(false, 4), 10), { code: 'SCHEDULING_CONFIG_STALE' });
  assert.equal(writes.length, 2);
});
