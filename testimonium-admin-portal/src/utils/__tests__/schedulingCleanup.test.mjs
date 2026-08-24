import { getManilaTodayDateString, isBeforeManilaToday } from '../date.js';
import { getPriestColor } from '../priestColors.js';

function runTests() {
  console.log('--- Running Admin Scheduling UI Cleanup Tests ---');

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
  // Simulate a time where UTC date is 2026-08-23 20:00:00Z but Manila is 2026-08-24 04:00:00+08:00
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

  console.log('All Unit Tests Passed Successfully!');
}

runTests();
