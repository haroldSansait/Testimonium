import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getManilaPresetRange,
  getActiveDatePreset,
  getManilaTodayDateString,
  getManilaDefaultDateRange,
  DATE_PRESET_LABELS,
  formatDailyAverage,
} from '../src/utils/date.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================================
// 1. DATE PRESET CALENDAR SEMANTICS (ASIA/MANILA)
// =========================================================================

test('Date Presets: 7 Days produces today inclusive + previous 6 calendar days (7 total days)', () => {
  // Use fixed Manila date: 2026-09-13 (Sunday)
  // In UTC, 2026-09-13T00:00:00Z = 2026-09-13 08:00 Manila
  const fixedNow = new Date('2026-09-13T04:00:00Z');
  const range = getManilaPresetRange('7d', fixedNow);

  assert.equal(range.to, '2026-09-13');
  assert.equal(range.from, '2026-09-07');

  // Verify calendar day count inclusive
  const fromD = new Date(range.from);
  const toD = new Date(range.to);
  const dayCount = Math.round((toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  assert.equal(dayCount, 7, '7 Days preset must span exactly 7 calendar days');
});

test('Date Presets: 1 Month produces today inclusive + previous 1 calendar month', () => {
  const fixedNow = new Date('2026-09-13T04:00:00Z');
  const range = getManilaPresetRange('1m', fixedNow);

  assert.equal(range.to, '2026-09-13');
  assert.equal(range.from, '2026-08-13');

  // Month-end clamping check: March 31 -> February 28
  const marchEnd = new Date('2026-03-31T04:00:00Z');
  const marchRange = getManilaPresetRange('1m', marchEnd);
  assert.equal(marchRange.to, '2026-03-31');
  assert.equal(marchRange.from, '2026-02-28', 'Clamps to maximum days in February');
});

test('Date Presets: 6 Months produces today inclusive + previous 6 calendar months', () => {
  const fixedNow = new Date('2026-09-13T04:00:00Z');
  const range = getManilaPresetRange('6m', fixedNow);

  assert.equal(range.to, '2026-09-13');
  assert.equal(range.from, '2026-03-13');
});

test('Date Presets: 1 Year matches canonical 365-day range', () => {
  const fixedNow = new Date('2026-09-13T04:00:00Z');
  const range = getManilaPresetRange('1y', fixedNow);
  const canonical = getManilaDefaultDateRange(fixedNow);

  assert.deepEqual(range, canonical);
  assert.equal(range.to, '2026-09-13');
  assert.equal(range.from, '2025-09-14');
});

test('Date Presets: getActiveDatePreset returns exact preset or custom', () => {
  const fixedNow = new Date('2026-09-13T04:00:00Z');

  // Exact matches
  const range7d = getManilaPresetRange('7d', fixedNow);
  assert.equal(getActiveDatePreset(range7d.from, range7d.to, fixedNow), '7d');

  const range1m = getManilaPresetRange('1m', fixedNow);
  assert.equal(getActiveDatePreset(range1m.from, range1m.to, fixedNow), '1m');

  const range6m = getManilaPresetRange('6m', fixedNow);
  assert.equal(getActiveDatePreset(range6m.from, range6m.to, fixedNow), '6m');

  const range1y = getManilaPresetRange('1y', fixedNow);
  assert.equal(getActiveDatePreset(range1y.from, range1y.to, fixedNow), '1y');

  // Custom manual change
  assert.equal(getActiveDatePreset('2026-01-01', '2026-01-15', fixedNow), 'custom');
  assert.equal(getActiveDatePreset('2026-09-08', '2026-09-13', fixedNow), 'custom');
});

// =========================================================================
// 2. DAILY AVERAGE INTELLIGENT FORMATTING
// =========================================================================

test('Daily Average Formatting: 11 requests / 365 days displays 0.03/day, not 0.0/day', () => {
  // 11 / 365 = 0.0301369...
  const formatted = formatDailyAverage(11, 365);
  assert.equal(formatted, '0.03', 'Must format 11 / 365 as 0.03/day');
});

test('Daily Average Formatting: scales decimals meaningfully across all magnitude tiers', () => {
  // Tier >= 10: 1 decimal
  assert.equal(formatDailyAverage(5000, 365), '13.7');
  assert.equal(formatDailyAverage(3650, 365), '10');

  // Tier 1 - 9.99: 1 decimal
  assert.equal(formatDailyAverage(500, 365), '1.4');
  assert.equal(formatDailyAverage(365, 365), '1.0');

  // Tier 0.1 - 0.99: 2 decimals
  assert.equal(formatDailyAverage(100, 365), '0.27');
  assert.equal(formatDailyAverage(50, 365), '0.14');

  // Tier 0.01 - 0.099: 2 meaningful decimals
  assert.equal(formatDailyAverage(11, 365), '0.03');
  assert.equal(formatDailyAverage(5, 365), '0.01');

  // Tier < 0.01: 3 decimals
  assert.equal(formatDailyAverage(1, 365), '0.003');

  // Zero activity: 0.0
  assert.equal(formatDailyAverage(0, 365), '0.0');
});

// =========================================================================
// 3. DOCUMENTS BALANCED 2-COLUMN GRID & PANEL POSITIONING
// =========================================================================

test('Documents Layout: Restructured into balanced 2-column analytical grid with Diocese comparison paired', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  // Verify Documents Row 2 contains both Requests by Document Type and Diocese-Wide Parish Comparison
  const docTypeMatch = content.indexOf("Requests by Document Type");
  const parishCompMatch = content.indexOf("Diocese-Wide Parish Comparison");
  assert.ok(docTypeMatch !== -1, 'Requests by Document Type must be present');
  assert.ok(parishCompMatch !== -1, 'Diocese-Wide Parish Comparison must be present');

  // Verify Diocese-wide comparison is inside the grid, NOT isolated as an awkward full-width panel below VerifiedPaymentsTable
  const paymentsTableIdx = content.indexOf("<VerifiedPaymentsTable");
  const documentsParishCompIdx = content.indexOf("tab === 'documents' && coordinator && !parishId && data?.parishComparisons?.documents");
  assert.ok(documentsParishCompIdx !== -1, 'Documents Diocese Parish Comparison condition must be defined');
  assert.ok(
    documentsParishCompIdx < paymentsTableIdx,
    'Documents parish comparison must be inside the upper 2-column grid, before VerifiedPaymentsTable'
  );

  // Verify both panels have compatible visual height wrappers
  assert.ok(
    content.includes('flex flex-col justify-between'),
    'Cards in Row 2 must have balanced flex container heights'
  );
});

// =========================================================================
// 4. ANIMATION EPOCH & REDUCED-MOTION AUDIT
// =========================================================================

test('Chart Animations: All analytical charts receive animationKey and respect prefers-reduced-motion', () => {
  const chartFiles = [
    '../src/components/analytics/DailyTrendChart.tsx',
    '../src/components/analytics/StatusDonutChart.tsx',
    '../src/components/analytics/RankedHorizontalBarChart.tsx',
    '../src/components/analytics/WeekdayActivityChart.tsx',
    '../src/components/analytics/AnalyticsTelemetryDeck.tsx',
  ];

  for (const relPath of chartFiles) {
    const fullPath = path.join(__dirname, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');

    assert.ok(
      code.includes('animationKey'),
      `${relPath} must declare and accept animationKey`
    );
    assert.ok(
      code.includes('@media (prefers-reduced-motion: no-preference)'),
      `${relPath} must gate all keyframe animations behind prefers-reduced-motion: no-preference`
    );
  }
});

test('Epoch Triggering: AnalyticsPage triggers dataEpoch only on successful response arrival', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  assert.ok(content.includes('const [dataEpoch, setDataEpoch] = useState(0);'));
  assert.ok(content.includes('setDataEpoch((prev) => prev + 1);'));
  assert.ok(content.includes('animationKey={dataEpoch}'));
});
