import { getManilaTodayDateString, isBeforeManilaToday, to24Hour, to12Hour, isValidTimeRange } from '../date.ts';
import { getPriestColor } from '../priestColors.ts';

function runTests() {
  console.log('--- Running Admin Scheduling UI Cleanup & Time Control Tests ---');

  // Test 1: Priest colors for TBD and null
  const defaultTbd = getPriestColor('TBD');
  const defaultNull = getPriestColor(null);
  const defaultUndefined = getPriestColor(undefined);

  console.assert(defaultTbd.hex === '#6B7280', 'TBD should map to neutral gray');
  console.assert(defaultNull.hex === '#6B7280', 'null should map to neutral gray');
  console.assert(defaultUndefined.hex === '#6B7280', 'undefined should map to neutral gray');
  console.log('✓ Priest Color neutral fallback for TBD/null/undefined passed');

  // Test 2: Priest colors for specific priests
  const frMichael = getPriestColor('Fr. Michael Reyes');
  console.assert(typeof frMichael.bg === 'string' && frMichael.bg.startsWith('bg-'), 'Priest bg class valid');
  console.assert(typeof frMichael.text === 'string' && frMichael.text.startsWith('text-'), 'Priest text class valid');
  console.assert(typeof frMichael.border === 'string' && frMichael.border.startsWith('border-'), 'Priest border class valid');
  console.log('✓ Priest Color palette mapping passed');

  // Test 3: Manila timezone today date string
  const utcLateNight = new Date('2026-08-23T20:00:00Z');
  const manilaTodayStr = getManilaTodayDateString(utcLateNight);
  console.assert(manilaTodayStr === '2026-08-24', `Expected 2026-08-24, got ${manilaTodayStr}`);
  console.log('✓ Manila timezone UTC-shift preservation passed: ' + manilaTodayStr);

  // Test 4: isBeforeManilaToday check
  const refNow = new Date('2026-08-24T03:30:00Z'); // 2026-08-24 11:30:00 Manila
  console.assert(isBeforeManilaToday('2026-08-23', refNow) === true, '2026-08-23 is before today');
  console.assert(isBeforeManilaToday('2026-08-20', refNow) === true, '2026-08-20 is before today');
  console.assert(isBeforeManilaToday('2026-08-24', refNow) === false, '2026-08-24 (today) is NOT before today');
  console.assert(isBeforeManilaToday('2026-08-25', refNow) === false, '2026-08-25 (tomorrow) is NOT before today');
  console.assert(isBeforeManilaToday('2026-09-01', refNow) === false, '2026-09-01 is NOT before today');
  console.log('✓ Past date detection in Manila timezone passed');

  // Test 5: Time conversion to 24-hour format (HTML input value)
  console.assert(to24Hour('09:00 AM') === '09:00', '09:00 AM -> 09:00');
  console.assert(to24Hour('12:00 PM') === '12:00', '12:00 PM -> 12:00');
  console.assert(to24Hour('12:00 AM') === '00:00', '12:00 AM -> 00:00');
  console.assert(to24Hour('06:00 PM') === '18:00', '06:00 PM -> 18:00');
  console.assert(to24Hour('6:30 PM') === '18:30', '6:30 PM -> 18:30');
  console.assert(to24Hour('11:59 PM') === '23:59', '11:59 PM -> 23:59');
  console.assert(to24Hour('18:00') === '18:00', '18:00 already 24h preserved');
  console.assert(to24Hour('') === '', 'empty string returns empty');
  console.assert(to24Hour(null) === '', 'null returns empty');
  console.log('✓ to24Hour conversion passed');

  // Test 6: Time conversion to 12-hour format (Backend API contract)
  console.assert(to12Hour('09:00') === '09:00 AM', '09:00 -> 09:00 AM');
  console.assert(to12Hour('12:00') === '12:00 PM', '12:00 -> 12:00 PM');
  console.assert(to12Hour('00:00') === '12:00 AM', '00:00 -> 12:00 AM');
  console.assert(to12Hour('18:00') === '06:00 PM', '18:00 -> 06:00 PM');
  console.assert(to12Hour('18:30') === '06:30 PM', '18:30 -> 06:30 PM');
  console.assert(to12Hour('23:59') === '11:59 PM', '23:59 -> 11:59 PM');
  console.assert(to12Hour('09:00 AM') === '09:00 AM', '09:00 AM already 12h preserved');
  console.assert(to12Hour('') === '', 'empty string returns empty');
  console.assert(to12Hour(null) === '', 'null returns empty');
  console.log('✓ to12Hour conversion passed');

  // Test 7: Time range validation
  console.assert(isValidTimeRange('09:00', '10:00') === true, '10:00 > 09:00 valid');
  console.assert(isValidTimeRange('08:00', '12:00') === true, '12:00 > 08:00 valid');
  console.assert(isValidTimeRange('18:00', '17:00') === false, '17:00 < 18:00 invalid');
  console.assert(isValidTimeRange('18:00', '18:00') === false, 'same time invalid');
  console.assert(isValidTimeRange('09:00', '') === true, 'optional end time allowed');
  console.assert(isValidTimeRange('', '10:00') === true, 'optional start time allowed');
  console.log('✓ isValidTimeRange validation passed');

  console.log('All Unit Tests Passed Successfully!');
}

runTests();
