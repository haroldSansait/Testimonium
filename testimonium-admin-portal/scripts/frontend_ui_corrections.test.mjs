import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatOcrAmount } from '../src/utils/ocrAmountFormat.ts';
import { computeDropdownPosition } from '../src/utils/dropdownPosition.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function readSource(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('formatOcrAmount removes erroneous Amount text and duplicate peso/PHP prefixes', () => {
  assert.equal(formatOcrAmount('₱Amount 600.00'), '₱600.00');
  assert.equal(formatOcrAmount('Amount 600.00'), '₱600.00');
  assert.equal(formatOcrAmount('Amount: 600.00'), '₱600.00');
  assert.equal(formatOcrAmount('Amount: PHP 1,250.50'), '₱1,250.50');
  assert.equal(formatOcrAmount('₱₱ 600.00'), '₱600.00');
  assert.equal(formatOcrAmount('P 600.00'), '₱600.00');
  assert.equal(formatOcrAmount('₱600.00'), '₱600.00');
  assert.equal(formatOcrAmount(600), '₱600');
  assert.equal(formatOcrAmount(600.5), '₱600.5');
  assert.equal(formatOcrAmount(null), null);
  assert.equal(formatOcrAmount(undefined), null);
  assert.equal(formatOcrAmount('   '), null);
});

test('computeDropdownPosition keeps Feast Date Day dropdown inside modal and viewport without horizontal overflow', () => {
  // Narrow Day trigger near right edge of modal inside a 1024px viewport
  const result = computeDropdownPosition({
    triggerRect: { top: 300, bottom: 338, left: 740, right: 808, width: 68, height: 38 },
    containerRect: { top: 80, bottom: 700, left: 260, right: 820, width: 560, height: 620 },
    viewportWidth: 1024,
    viewportHeight: 768,
    minWidth: 200,
  });

  assert.ok(result.top !== undefined, 'opens downward when space below is sufficient');
  assert.equal(result.bottom, undefined);
  assert.ok(result.width >= 200, 'preserves readable dropdown width when space exists');
  assert.ok(result.left >= 260, 'does not overflow left boundary of modal');
  assert.ok(result.left + result.width <= 820, 'does not overflow right boundary of modal');
  assert.ok(result.left + result.width <= 1024 - 8, 'stays within viewport right padding');
});

test('computeDropdownPosition flips upward near bottom and clamps cleanly on narrow mobile screens', () => {
  const result = computeDropdownPosition({
    triggerRect: { top: 610, bottom: 648, left: 16, right: 90, width: 74, height: 38 },
    containerRect: null,
    viewportWidth: 360,
    viewportHeight: 680,
    minWidth: 220,
  });

  assert.ok(result.bottom !== undefined, 'flips upward when near bottom of viewport');
  assert.equal(result.top, undefined);
  assert.ok(result.left >= 8);
  assert.ok(result.left + result.width <= 360 - 8);
  assert.ok(result.maxHeight >= 150);
});

test('DocumentRequestsPage uses formatOcrAmount while preserving the Amount label', () => {
  const src = readSource('src/pages/DocumentRequestsPage.tsx');
  assert.match(src, /import \{ formatOcrAmount \} from '@\/utils\/ocrAmountFormat'/);
  assert.match(src, /displayedOcrAmount\s*=\s*formatOcrAmount\(ocr\?\.amount\)|displayedOcrAmount\s*=\s*formatOcrAmount\(ocr\.amount\)/);
  assert.match(src, /<span className="text-\[10px\] text-gray-400 block uppercase">Amount<\/span>/);
  assert.match(src, /\{displayedOcrAmount\}/);
});

test('Admin Map Configuration removes Preview Card feature while preserving previewParish settings panel', () => {
  const previewPath = path.join(rootDir, 'src/components/map-configuration/PreviewDialog.tsx');
  assert.equal(fs.existsSync(previewPath), false, 'PreviewDialog.tsx must be deleted');

  const toolbarSrc = readSource('src/components/map-configuration/SaveToolbar.tsx');
  assert.doesNotMatch(toolbarSrc, /Preview Card/);
  assert.doesNotMatch(toolbarSrc, /onPreviewClick/);

  const pageSrc = readSource('src/pages/MapConfigurationPage.tsx');
  assert.doesNotMatch(pageSrc, /PreviewDialog/);
  assert.doesNotMatch(pageSrc, /isPreviewOpen/);
  assert.match(pageSrc, /const previewParish = selectedParish \?/);
  assert.match(pageSrc, /parish=\{previewParish\}/);
});

test('CustomSelect renders via document.body portal with computeDropdownPosition', () => {
  const src = readSource('src/components/ui/CustomSelect.tsx');
  assert.match(src, /createPortal/);
  assert.match(src, /computeDropdownPosition/);
});

test('NewParishWizard checks all existing parishes and disables Mother Parish toggle when one exists or is checking', () => {
  const src = readSource('src/components/parish-management/NewParishWizard.tsx');
  assert.match(src, /ParishManagementService\.getParishes\(\{\s*status:\s*'all'\s*\}\)/);
  assert.match(src, /motherParishAvailability/);
  assert.match(src, /A Mother Parish is already designated\./);
  assert.match(src, /disabled=\{isMotherParishDisabled\}/);
  assert.match(src, /checked=\{isMotherParishDisabled \? false : data\.isMotherParish\}/);
  // Responsive outer grid and min-w-0 on narrow date selects
  assert.match(src, /grid-cols-1 sm:grid-cols-2/);
  assert.match(src, /className="min-w-0"/);
});
