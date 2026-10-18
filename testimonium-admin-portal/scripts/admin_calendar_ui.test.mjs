import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Admin Calendar UI/UX Improvements Suite', async (t) => {
  const gridPath = path.join(srcDir, 'components/calendar/CalendarGrid.tsx');
  const weekPath = path.join(srcDir, 'components/calendar/CalendarWeekView.tsx');
  const chipPath = path.join(srcDir, 'components/calendar/CalendarEvent.tsx');

  const gridContent = fs.readFileSync(gridPath, 'utf8');
  const weekContent = fs.readFileSync(weekPath, 'utf8');
  const chipContent = fs.readFileSync(chipPath, 'utf8');

  await t.test('1. CalendarGrid Month View: table-fixed, equal 7 columns, and cell overflow containment', () => {
    // Must use table-fixed to prevent content-driven column stretching
    assert.match(gridContent, /table-fixed/, 'CalendarGrid table must use table-fixed layout');
    
    // Must set equal column widths across the 7 days
    assert.match(gridContent, /w-\[14\.2857%\]/, 'CalendarGrid headers and cells must use equal width (14.2857%)');
    
    // Responsive table width constraints
    assert.match(gridContent, /min-w-\[560px\]/, 'CalendarGrid table should have mobile minimum readable width');
    assert.match(gridContent, /sm:min-w-full/, 'CalendarGrid table must fit available width on tablet and desktop without scroll');

    // Cells must have max-w-0 and overflow-hidden to constrain children
    assert.match(gridContent, /max-w-0/, 'Calendar cells must include max-w-0 to prevent expansion');
    assert.match(gridContent, /overflow-hidden/, 'Calendar cells must include overflow-hidden');

    // Event container must have min-w-0 and overflow-hidden
    assert.match(gridContent, /space-y-0\.5 min-w-0 overflow-hidden/, 'Event container must be constrained with min-w-0 overflow-hidden');

    // +N more functionality preserved
    assert.match(gridContent, /\+\{dayEvents\.length - 3\} more/, 'Preserves +N more button');
    assert.match(gridContent, /onMoreClick/, 'Preserves onMoreClick handler');

    // Days of week and today indicator preserved
    assert.match(gridContent, /DAYS_OF_WEEK/, 'Preserves DAYS_OF_WEEK headers');
    assert.match(gridContent, /isToday/, 'Preserves isToday highlight');
  });

  await t.test('2. CalendarEventChip: single-line max, responsive ellipsis, and visible time', () => {
    // Time must be visible and separated with shrink-0
    assert.match(chipContent, /shrink-0 font-semibold/, 'Time must be preserved with shrink-0 font-semibold');
    assert.match(chipContent, /event\.time/, 'Time element must render');

    // Title must truncate on a single line with flex-1 min-w-0
    assert.match(chipContent, /truncate min-w-0 flex-1/, 'Title must have truncate min-w-0 flex-1 for single-line ellipsis');
    
    // Chip must be constrained to cell width
    assert.match(chipContent, /w-full min-w-0 max-w-full overflow-hidden/, 'Chip container must have w-full min-w-0 max-w-full overflow-hidden');

    // Priest and category color styling preserved
    assert.match(chipContent, /event\.priestColor/, 'Preserves priest custom color override');
    assert.match(chipContent, /getPriestColor/, 'Preserves priest palette fallback');
    assert.match(chipContent, /categoryStyles/, 'Preserves category styles fallback');

    // Keyboard accessibility & click interactions preserved
    assert.match(chipContent, /role="button"/, 'Accessible button role preserved');
    assert.match(chipContent, /tabIndex=\{0\}/, 'Keyboard focus tabIndex preserved');
    assert.match(chipContent, /onKeyDown/, 'Keyboard Enter and Space key handler preserved');
    assert.match(chipContent, /aria-label=/, 'Aria label with complete event details preserved');
  });

  await t.test('3. Tooltip integration: full information preserved without cell clipping', () => {
    // Tooltip must wrap the chip and provide full event details
    assert.match(chipContent, /<Tooltip content=\{eventTooltipText\}/, 'Tooltip component wraps event chip');
    assert.match(chipContent, /eventTooltipText = `\$\{event\.time/, 'Tooltip text includes full event time');
    assert.match(chipContent, /event\.title/, 'Tooltip text includes full event title');
    assert.match(chipContent, /break-words/, 'Tooltip handles long unbroken text with break-words');
  });

  await t.test('4. CalendarWeekView: responsive 7-day grid, no stretching from long titles', () => {
    // Grid layout with responsive width
    assert.match(weekContent, /grid grid-cols-7/, 'Week view uses 7-column grid');
    assert.match(weekContent, /min-w-\[560px\] sm:min-w-full w-full/, 'Week view uses responsive full-width layout without forced desktop scrolling');

    // Column containment
    assert.match(weekContent, /min-w-0 overflow-hidden/, 'Weekday columns must have min-w-0 overflow-hidden');

    // Preserved header and event list
    assert.match(weekContent, /Switch to Day View/, 'Header tooltip to day view preserved');
    assert.match(weekContent, /onSelectDay/, 'Select day interaction preserved');
    assert.match(weekContent, /onEventClick/, 'Event click interaction preserved');
    assert.match(weekContent, /CalendarEventChip/, 'CalendarEventChip used in Week view');
  });
});
