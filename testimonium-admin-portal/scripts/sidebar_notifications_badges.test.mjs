import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateNotificationBadgeCounts } from '../src/utils/notificationBadgeCounts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

// =========================================================================
// 1. NOTIFICATION BADGE COUNTING & FILTERING LOGIC
// =========================================================================

test('Document Request indicator counts only unread new-document-request notifications', () => {
  const notifications = [
    {
      id: '1',
      title: 'New Document Request',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '101',
      isRead: false,
    },
    {
      id: '2',
      title: 'new document request',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '102',
      isRead: false,
    },
    {
      id: '3',
      title: 'New Document Request',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '103',
      isRead: true, // Already read: must not count
    },
  ];

  const counts = calculateNotificationBadgeCounts(notifications);
  assert.equal(counts.documentRequestsCount, 2, 'Must count exactly 2 unread new document requests');
  assert.equal(counts.scheduleRequestsCount, 0, 'Schedule requests must be 0');
  assert.equal(counts.unreadCount, 2, 'Total unread notifications must be 2');
});

test('Schedule Request indicator counts only unread new-appointment-request notifications', () => {
  const notifications = [
    {
      id: '1',
      title: 'New Appointment Request',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '201',
      isRead: false,
    },
    {
      id: '2',
      title: 'new appointment request ',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '202',
      isRead: false,
    },
    {
      id: '3',
      title: 'New Appointment Request',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '203',
      isRead: true, // Read
    },
  ];

  const counts = calculateNotificationBadgeCounts(notifications);
  assert.equal(counts.scheduleRequestsCount, 2, 'Must count exactly 2 unread new appointment requests');
  assert.equal(counts.documentRequestsCount, 0, 'Document requests must be 0');
  assert.equal(counts.unreadCount, 2);
});

test('Unrelated notifications do not inflate request badges', () => {
  const notifications = [
    {
      id: '1',
      title: 'Payment Verification Required',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '101',
      isRead: false,
    },
    {
      id: '2',
      title: 'Document Returned for Correction',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '102',
      isRead: false,
    },
    {
      id: '3',
      title: 'Priest Assignment Update',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '201',
      isRead: false,
    },
    {
      id: '4',
      title: 'Reschedule Proposal Accepted',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '202',
      isRead: false,
    },
    {
      id: '5',
      title: 'System Maintenance Notice',
      referenceType: 'GENERAL',
      referenceId: null,
      isRead: false,
    },
  ];

  const counts = calculateNotificationBadgeCounts(notifications);
  assert.equal(counts.documentRequestsCount, 0, 'No unrelated notification should count toward document requests');
  assert.equal(counts.scheduleRequestsCount, 0, 'No unrelated notification should count toward schedule requests');
  assert.equal(counts.unreadCount, 5, 'Total unread count reflects all 5 unread notifications');
});

test('Duplicate notifications referencing the same request are deduplicated', () => {
  const notifications = [
    {
      id: '1',
      title: 'New Document Request',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '999',
      isRead: false,
    },
    {
      id: '2',
      title: 'New Document Request',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: '999', // Same request
      isRead: false,
    },
    {
      id: '3',
      title: 'New Appointment Request',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '888',
      isRead: false,
    },
    {
      id: '4',
      title: 'New Appointment Request',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: '888', // Same request
      isRead: false,
    },
  ];

  const counts = calculateNotificationBadgeCounts(notifications);
  assert.equal(counts.documentRequestsCount, 1, 'Duplicate document notifications must count once');
  assert.equal(counts.scheduleRequestsCount, 1, 'Duplicate schedule notifications must count once');
});

test('Counts update after marking notifications as read', () => {
  const before = [
    { id: '1', title: 'New Document Request', referenceType: 'DOCUMENT_REQUEST', referenceId: '101', isRead: false },
    { id: '2', title: 'New Appointment Request', referenceType: 'SCHEDULE_REQUEST', referenceId: '201', isRead: false },
  ];
  const countsBefore = calculateNotificationBadgeCounts(before);
  assert.equal(countsBefore.documentRequestsCount, 1);
  assert.equal(countsBefore.scheduleRequestsCount, 1);
  assert.equal(countsBefore.unreadCount, 2);

  // Mark all read
  const afterAll = before.map(n => ({ ...n, isRead: true }));
  const countsAfterAll = calculateNotificationBadgeCounts(afterAll);
  assert.equal(countsAfterAll.documentRequestsCount, 0);
  assert.equal(countsAfterAll.scheduleRequestsCount, 0);
  assert.equal(countsAfterAll.unreadCount, 0);

  // Mark one read
  const afterOne = before.map(n => n.id === '1' ? { ...n, isRead: true } : n);
  const countsAfterOne = calculateNotificationBadgeCounts(afterOne);
  assert.equal(countsAfterOne.documentRequestsCount, 0);
  assert.equal(countsAfterOne.scheduleRequestsCount, 1);
  assert.equal(countsAfterOne.unreadCount, 1);
});

test('Formatting: 99+ display logic', () => {
  const formatBadge = (count) => (count > 99 ? '99+' : String(count));
  assert.equal(formatBadge(0), '0');
  assert.equal(formatBadge(1), '1');
  assert.equal(formatBadge(6), '6');
  assert.equal(formatBadge(12), '12');
  assert.equal(formatBadge(99), '99');
  assert.equal(formatBadge(100), '99+');
  assert.equal(formatBadge(500), '99+');
});

// =========================================================================
// 2. STATIC CONTRACT VERIFICATION: SIDEBAR & NAVBAR
// =========================================================================

test('Sidebar source contract: smooth left position interpolation and centered collapsed icons', () => {
  const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Interpolated left position
  assert.ok(
    content.includes("left: isExpanded ? '14px' : '20px'"),
    'Must interpolate icon left position between 20px (centered in 56px NavLink) and 14px (expanded)'
  );

  // Stable icon wrapper with transition
  assert.ok(
    content.includes('transition-[left,color] duration-300 ease-in-out'),
    'Must smoothly transition icon position without teleporting justify-start/center'
  );

  // Nav label smooth fade and slide
  assert.ok(
    content.includes("isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'"),
    'Nav label must smoothly fade and slide in'
  );

  // Sidebar width transition
  assert.ok(
    content.includes("width: isExpanded ? '280px' : '76px'"),
    'Sidebar width must transition between 76px and 280px'
  );
  assert.ok(
    content.includes('transition-[width] duration-300 ease-in-out'),
    'Sidebar must use 300ms transition on width'
  );
});

test('Sidebar source contract: Pin/Unpin control relocated to top header using Lucide icons', () => {
  const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Lucide icons imported
  assert.ok(content.includes('Pin,'), 'Must import Pin from lucide-react');
  assert.ok(content.includes('PinOff,'), 'Must import PinOff from lucide-react');

  // No emojis in pin control
  assert.ok(!content.includes('📌'), 'Must not contain pin emojis');

  // Header has Pin / PinOff button
  assert.ok(
    content.includes('{isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}'),
    'Header must render Pin when unpinned and PinOff when pinned'
  );

  // LocalStorage persistence
  assert.ok(
    content.includes("localStorage.getItem('testimonium_sidebar_pinned')"),
    'Must read testimonium_sidebar_pinned from localStorage'
  );
  assert.ok(
    content.includes("localStorage.setItem('testimonium_sidebar_pinned'"),
    'Must persist testimonium_sidebar_pinned to localStorage'
  );

  // Bottom pin control removed
  assert.ok(
    !content.includes('ChevronLeft') && !content.includes('ChevronRight'),
    'Old bottom pin toggle with ChevronLeft/Right must be removed'
  );
});

test('Sidebar source contract: Pointer vs keyboard focus handling', () => {
  const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Pointerdown and keydown event listeners
  assert.ok(
    content.includes("window.addEventListener('pointerdown', handlePointerDown"),
    'Must track pointerdown to distinguish pointer from keyboard focus'
  );
  assert.ok(
    content.includes("window.addEventListener('keydown', handleKeyDown"),
    'Must track keyboard Tab/Arrow navigation'
  );

  // Mouse leave blur activeElement if pointer interacting
  assert.ok(
    content.includes('(document.activeElement as HTMLElement)?.blur()'),
    'Must blur active element on mouse leave to prevent stuck expansion'
  );

  // Route change auto-collapse check
  assert.ok(
    content.includes("asideRef.current && !asideRef.current.matches(':hover')"),
    'Must check :hover state on route change to auto-collapse unpinned sidebar'
  );
});

test('Sidebar source contract: Unsaved changes confirmation preserved', () => {
  const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  assert.ok(content.includes('confirmNavigation'), 'Must retain confirmNavigation helper');
  assert.ok(content.includes('hasUnsavedMapChanges'), 'Must check hasUnsavedMapChanges');
  assert.ok(content.includes('hasUnsavedSettingsChanges'), 'Must check hasUnsavedSettingsChanges');
  assert.ok(content.includes('<ConfirmNavigationModal'), 'Must render ConfirmNavigationModal');
});

test('Sidebar source contract: Request badges and permission-filtering', () => {
  const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Uses useNotificationCounts
  assert.ok(content.includes('useNotificationCounts'), 'Must use useNotificationCounts hook');

  // Permission checks for badges
  assert.ok(
    content.includes('PERMISSIONS.VIEW_DOCUMENT_REQUESTS'),
    'Must check VIEW_DOCUMENT_REQUESTS for document badge'
  );
  assert.ok(
    content.includes('PERMISSIONS.VIEW_SCHEDULE_REQUESTS'),
    'Must check VIEW_SCHEDULE_REQUESTS for schedule badge'
  );

  // Collapsed badge near icon
  assert.ok(
    content.includes("style={{ left: '28px' }}"),
    'Collapsed badge must be positioned near icon without shifting icon'
  );

  // Expanded badge
  assert.ok(
    content.includes('ml-auto mr-3'),
    'Expanded badge must be right-aligned'
  );

  // Dusty-rose badge styling
  assert.ok(
    content.includes('bg-[#E6B5BE]'),
    'Badges must use muted dusty rose #E6B5BE background'
  );
  assert.ok(
    content.includes('text-[#5B1220]'),
    'Badges must use dark burgundy #5B1220 text'
  );
});

test('Navbar source contract: Numeric unread badge in TESTIMONIUM burgundy #7B1C2A', () => {
  const navbarPath = path.join(srcDir, 'components/layout/Navbar.tsx');
  const content = fs.readFileSync(navbarPath, 'utf8');

  // Uses useNotificationCounts
  assert.ok(content.includes('useNotificationCounts()'), 'Navbar must use useNotificationCounts hook');

  // Burgundy background
  assert.ok(
    content.includes('bg-[#7B1C2A]'),
    'Navbar badge must use official TESTIMONIUM burgundy #7B1C2A'
  );

  // Numeric count display
  assert.ok(
    content.includes("unreadCount > 99 ? '99+' : unreadCount"),
    'Navbar badge must display numeric count or 99+'
  );

  // Accessible label
  assert.ok(
    content.includes("unreadCount > 0 ? `Notifications, ${unreadCount > 99 ? '99+' : unreadCount} unread` : 'Notifications, none unread'"),
    'Navbar button must have accessible label reflecting unread count'
  );

  // Red dot removed
  assert.ok(
    !content.includes('w-2 h-2 bg-red-500 rounded-full'),
    'Old red dot must be replaced by numeric badge'
  );
});

test('AdminLayout & mobile drawer contract', () => {
  const layoutPath = path.join(srcDir, 'layouts/AdminLayout.tsx');
  const content = fs.readFileSync(layoutPath, 'utf8');

  // Single authoritative background polling
  assert.ok(
    content.includes('useNotificationCounts({ enableAutoRefresh: true })'),
    'AdminLayout must host single authoritative auto-refresh polling'
  );

  // Mobile drawer Sidebar props
  assert.ok(
    content.includes('<Sidebar isMobileDrawer onCloseMobileDrawer={() => setMobileNavigationOpen(false)} />'),
    'Mobile drawer must pass isMobileDrawer and onCloseMobileDrawer'
  );
});
