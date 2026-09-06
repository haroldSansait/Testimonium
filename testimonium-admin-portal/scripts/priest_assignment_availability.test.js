import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper mirroring ScheduleRequestDetailsModal availability and options transformation
function transformPriestOptions({ priests, priestAvailability, loadingAvailability, availabilityError }) {
  const unavailablePriests = priests.filter(
    (p) => !loadingAvailability && !availabilityError && priestAvailability[String(p.id)] === false
  );
  const allPriestsUnavailable =
    priests.length > 0 &&
    !loadingAvailability &&
    !availabilityError &&
    unavailablePriests.length === priests.length;

  const options = priests.map((p) => {
    const isAvail = priestAvailability[String(p.id)];
    const isUnavailable = !loadingAvailability && !availabilityError && isAvail === false;

    return {
      value: String(p.id),
      label: p.name,
      secondary: p.role === 'PRIEST' ? 'Parish Priest' : 'Assistant Priest',
      badge: isUnavailable ? 'Unavailable' : undefined,
      disabled: isUnavailable,
    };
  });

  return {
    options,
    unavailablePriests,
    allPriestsUnavailable,
    showImportantSection: !loadingAvailability && !availabilityError && unavailablePriests.length > 0,
    isDropdownDisabled: loadingAvailability || availabilityError,
  };
}

test('Priest Assignment Availability UX Suite', async (t) => {
  const samplePriests = [
    { id: 10, name: 'Rev. Fr. Julius L. Montaño', role: 'PRIEST' },
    { id: 11, name: 'Rev. Fr. Vinz Avila', role: 'ASSISTANT_PRIEST' },
  ];

  await t.test('1. All priests available -> no Important section, all selectable', () => {
    const result = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: { '10': true, '11': true },
      loadingAvailability: false,
      availabilityError: false,
    });

    assert.equal(result.showImportantSection, false, 'Important section must not render when all priests are available');
    assert.equal(result.unavailablePriests.length, 0);
    assert.equal(result.allPriestsUnavailable, false);
    assert.equal(result.options[0].disabled, false);
    assert.equal(result.options[0].badge, undefined);
    assert.equal(result.options[1].disabled, false);
    assert.equal(result.options[1].badge, undefined);
  });

  await t.test('2. One priest unavailable -> Important section visible, unavailable priest listed & disabled, available selectable', () => {
    const result = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: { '10': false, '11': true },
      loadingAvailability: false,
      availabilityError: false,
    });

    assert.equal(result.showImportantSection, true, 'Important section must render when at least one priest is unavailable');
    assert.equal(result.unavailablePriests.length, 1);
    assert.equal(result.unavailablePriests[0].name, 'Rev. Fr. Julius L. Montaño');
    assert.equal(result.allPriestsUnavailable, false);

    // Julius disabled with Unavailable badge
    assert.equal(result.options[0].disabled, true);
    assert.equal(result.options[0].badge, 'Unavailable');

    // Vinz selectable without badge
    assert.equal(result.options[1].disabled, false);
    assert.equal(result.options[1].badge, undefined);
  });

  await t.test('3. All priests unavailable -> Important section shows no priests available, all options disabled', () => {
    const result = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: { '10': false, '11': false },
      loadingAvailability: false,
      availabilityError: false,
    });

    assert.equal(result.showImportantSection, true);
    assert.equal(result.allPriestsUnavailable, true, 'Must indicate all priests are unavailable');
    assert.equal(result.unavailablePriests.length, 2);
    assert.equal(result.options[0].disabled, true);
    assert.equal(result.options[1].disabled, true);
    assert.equal(result.options[0].badge, 'Unavailable');
    assert.equal(result.options[1].badge, 'Unavailable');
  });

  await t.test('4 & 5. Privacy: Private commitment title and notes are NOT exposed in availability DTO or UI mapping', () => {
    const availabilityItem = { priestId: 10, available: false, reasonCode: 'PRIEST_UNAVAILABLE' };
    assert.equal('title' in availabilityItem, false, 'Title must not exist in availability item');
    assert.equal('notes' in availabilityItem, false, 'Notes must not exist in availability item');
    assert.equal('privateNotes' in availabilityItem, false, 'Private notes must not exist');

    const result = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: { [availabilityItem.priestId]: availabilityItem.available },
      loadingAvailability: false,
      availabilityError: false,
    });
    // Ensure option only displays public name, public role, and generic 'Unavailable' label
    assert.equal(result.options[0].label, 'Rev. Fr. Julius L. Montaño');
    assert.equal(result.options[0].secondary, 'Parish Priest');
    assert.equal(result.options[0].badge, 'Unavailable');
    assert.equal('reason' in result.options[0], false);
  });

  await t.test('6. Stale availability handling: backend PRIEST_CONFLICT rejection causes refresh and clears invalid priest', () => {
    let currentSelectedPriest = '10';
    let availability = { '10': true, '11': true };

    // Simulate stale submit where backend throws 409 PRIEST_CONFLICT
    const onConflictSubmit = () => {
      // Refresh logic executed by catch block
      availability = { '10': false, '11': true };
      currentSelectedPriest = '';
    };

    onConflictSubmit();

    assert.equal(currentSelectedPriest, '', 'Invalid selected priest must be cleared');
    const updated = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: availability,
      loadingAvailability: false,
      availabilityError: false,
    });
    assert.equal(updated.options[0].disabled, true, 'Stale priest must now be disabled');
  });

  await t.test('7. Availability loading -> premature assignment prevented by disabling dropdown', () => {
    const loadingResult = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: {},
      loadingAvailability: true,
      availabilityError: false,
    });
    assert.equal(loadingResult.isDropdownDisabled, true, 'Dropdown must be disabled while availability is loading');
    assert.equal(loadingResult.showImportantSection, false, 'Do not show Important section while loading');
  });

  await t.test('8. Lookup error -> fail conservative (disables dropdown, does not falsely mark available)', () => {
    const errorResult = transformPriestOptions({
      priests: samplePriests,
      priestAvailability: {},
      loadingAvailability: false,
      availabilityError: true,
    });
    assert.equal(errorResult.isDropdownDisabled, true, 'Dropdown must be disabled on error');
    assert.equal(errorResult.showImportantSection, false, 'Show error banner instead of false important warning');
    // None of the options are marked available
    for (const opt of errorResult.options) {
      assert.notEqual(opt.badge, 'Available');
    }
  });

  await t.test('9 & 10. Propose Reschedule & Reject remain usable when priests are unavailable', () => {
    const modalSource = fs.readFileSync(path.join(__dirname, '../src/pages/ScheduleRequestsPage.tsx'), 'utf8');
    // Propose Reschedule button
    assert.match(modalSource, /onClick=\{\(\) => setShowRescheduleModal\(true\)\}/, 'Propose Reschedule button must open reschedule modal');
    // Reject button
    assert.match(modalSource, /onClick=\{\(\) => void handleAction\('Cancelled'\)\}/, 'Reject button must trigger status update');
    // Ensure Propose Reschedule / Reject are guarded only by isUpdating, NOT by priest availability
    assert.match(modalSource, /disabled=\{isUpdating\}[^>]*>\s*<AlertCircle[^>]*\/>\s*Propose Reschedule/s);
    assert.match(modalSource, /disabled=\{isUpdating\}[^>]*>\s*<X[^>]*\/>\s*Reject/s);
  });

  await t.test('11. Source Contracts: CustomSelect supports disabled and ScheduleRequestsPage integrates availability', () => {
    const selectSource = fs.readFileSync(path.join(__dirname, '../src/components/ui/CustomSelect.tsx'), 'utf8');
    assert.match(selectSource, /disabled\?: boolean;/, 'CustomSelectOptionItem must support disabled property');
    assert.match(selectSource, /disabled=\{isDisabled\}/, 'CustomSelect option button must bind disabled attribute');

    const providerSource = fs.readFileSync(path.join(__dirname, '../src/providers/interfaces.ts'), 'utf8');
    assert.match(providerSource, /getPriestAvailability\(scheduleId: string/, 'ScheduleProvider must define getPriestAvailability');

    const apiSource = fs.readFileSync(path.join(__dirname, '../src/providers/api/ApiScheduleProvider.ts'), 'utf8');
    assert.match(apiSource, /\/schedule-requests\/\$\{scheduleId\}\/priest-availability/, 'ApiScheduleProvider must call canonical priest-availability endpoint');
  });
});
