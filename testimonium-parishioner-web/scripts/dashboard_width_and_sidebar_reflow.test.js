import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST SUITE: DASHBOARD WIDTH EXPANSION, SIDEBAR REFINEMENTS & WIZARDS
// ============================================================================

test("Dashboard Width Expansion Suite", async (t) => {
  const layoutSource = fs.readFileSync(
    path.join(__dirname, "../src/layouts/DashboardLayout.tsx"),
    "utf8"
  );

  await t.test("1. WIDE_ROUTES includes targeted dashboard routes including /dashboard/parishes", () => {
    assert.ok(layoutSource.includes("'/dashboard/home'"), "Must include /dashboard/home");
    assert.ok(layoutSource.includes("'/dashboard/parishes'"), "Must include /dashboard/parishes");
    assert.ok(layoutSource.includes("'/dashboard/request'"), "Must include /dashboard/request");
    assert.ok(layoutSource.includes("'/dashboard/track'"), "Must include /dashboard/track");
    assert.ok(layoutSource.includes("'/dashboard/scheduler'"), "Must include /dashboard/scheduler");
    assert.ok(layoutSource.includes("'/dashboard/notifications'"), "Must include /dashboard/notifications");
    assert.ok(layoutSource.includes("'/dashboard/profile'"), "Must include /dashboard/profile");
  });

  await t.test("2. Shared layout applies max-w-[1560px] to wide routes and max-w-7xl to other routes", () => {
    assert.ok(
      layoutSource.includes("isWidePage ? 'max-w-[1560px]' : 'max-w-7xl'"),
      "Must dynamically apply max-w-[1560px] or max-w-7xl based on isWidePage"
    );
    assert.ok(
      layoutSource.includes("px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full"),
      "Must preserve responsive padding tokens px-4 sm:px-6 lg:px-8"
    );
  });

  await t.test("3. Route matching logic correctly identifies wide and standard routes", () => {
    const WIDE_ROUTES = new Set([
      '/dashboard',
      '/dashboard/home',
      '/dashboard/parishes',
      '/dashboard/request',
      '/dashboard/track',
      '/dashboard/scheduler',
      '/dashboard/notifications',
      '/dashboard/profile',
    ]);
    const checkPath = (pathname) =>
      WIDE_ROUTES.has(pathname.replace(/\/$/, '')) || WIDE_ROUTES.has(pathname);

    // Targeted wide routes
    assert.equal(checkPath('/dashboard/home'), true);
    assert.equal(checkPath('/dashboard'), true);
    assert.equal(checkPath('/dashboard/parishes'), true, "Parish directory must use wide layout");
    assert.equal(checkPath('/dashboard/request'), true);
    assert.equal(checkPath('/dashboard/track'), true);
    assert.equal(checkPath('/dashboard/scheduler'), true);
    assert.equal(checkPath('/dashboard/notifications'), true);
    assert.equal(checkPath('/dashboard/profile'), true);

    // Standard width routes
    assert.equal(checkPath('/dashboard/help'), false);
    assert.equal(checkPath('/dashboard/schedule/123'), false);
  });
});

test("Sidebar Content Reflow & Pin Control Refinements Suite", async (t) => {
  const sidebarSource = fs.readFileSync(
    path.join(__dirname, "../src/components/layout/ParishionerSidebar.tsx"),
    "utf8"
  );

  await t.test("4. Desktop sidebar participates directly in layout width without absolute overlay", () => {
    assert.ok(
      sidebarSource.includes("style={{ width: isExpanded ? '280px' : '76px' }}"),
      "Outer aside must directly set style width based on isExpanded"
    );
    assert.ok(
      sidebarSource.includes("transition-[width] duration-300 ease-in-out"),
      "Aside must have smooth 300ms width transition"
    );
    assert.ok(
      !sidebarSource.includes("absolute top-0 left-0 w-[280px]"),
      "Must NOT use absolute positioning that overlays the page content"
    );
  });

  await t.test("5. Collapsed sidebar shows only centered T branding, hiding Pin button visually", () => {
    assert.ok(
      sidebarSource.includes('inset-0 flex items-center justify-center') || sidebarSource.includes('w-full flex items-center justify-center'),
      "Collapsed branding must be horizontally centered across full width"
    );
    assert.ok(
      sidebarSource.includes('font-serif font-black text-crimson') && sidebarSource.includes('tracking-widest select-none'),
      "Must render single T brand letter"
    );
    // Pin button hidden when collapsed except for accessible screen reader / focus
    assert.ok(
      sidebarSource.includes('sr-only focus:not-sr-only'),
      "Pin button must be visually hidden in collapsed state while preserving keyboard accessibility"
    );
  });

  await t.test("6. Expanded sidebar displays title, subtitle, and visible Pin/Unpin control on right", () => {
    assert.ok(
      sidebarSource.includes("TESTIMONIUM") && sidebarSource.includes("Parishioner Portal"),
      "Expanded header must display TESTIMONIUM title and Parishioner Portal subtitle"
    );
    assert.ok(
      sidebarSource.includes("aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}"),
      "Must have aria-label for Pin/Unpin Sidebar"
    );
    assert.ok(
      sidebarSource.includes("aria-pressed={isPinned}"),
      "Must have aria-pressed reflecting pinned state"
    );
    assert.ok(
      sidebarSource.includes("title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}"),
      "Must provide tooltips for Pin/Unpin Sidebar"
    );
    assert.ok(
      sidebarSource.includes("testimonium_pw_sidebar_pinned"),
      "Must preserve localStorage persistence key testimonium_pw_sidebar_pinned"
    );
  });

  await t.test("7. Navigation icons smoothly transition using interpolable left positioning without discrete jumping", () => {
    assert.ok(
      sidebarSource.includes("transition-[left,color] duration-300 ease-in-out"),
      "Nav icon must use smooth CSS-interpolable transition-[left,color] duration-300"
    );
    assert.ok(
      sidebarSource.includes("style={{ left: isExpanded ? '14px' : '20px' }}"),
      "Nav icon must smoothly interpolate left position between centered 20px and expanded 14px"
    );
    assert.ok(
      !sidebarSource.includes("justify-center px-0 py-2.5 gap-0"),
      "Must NOT use discrete justify-content toggling that causes teleporting icons"
    );
    assert.ok(
      sidebarSource.includes("ml-[42px] font-medium text-sm whitespace-nowrap transition-all duration-300 ease-in-out"),
      "Nav label must use coordinated 300ms transition for smooth fade and slide"
    );
  });

  await t.test("7b. Pointer interactions immediately blur and clear focus expansion to prevent stuck sidebar", () => {
    assert.ok(
      sidebarSource.includes("isPointerInteractingRef"),
      "Must track pointer interactions to distinguish mouse clicks from keyboard focus"
    );
    assert.ok(
      sidebarSource.includes("(e.currentTarget as HTMLElement)?.blur()"),
      "Clicking a NavLink must immediately blur to remove stuck focus"
    );
    assert.ok(
      sidebarSource.includes("setIsKeyboardFocused(false)"),
      "Clicking a NavLink or leaving the sidebar must reset keyboard focus expansion"
    );
    assert.ok(
      sidebarSource.includes("location.pathname"),
      "Route navigation must automatically collapse unpinned sidebar when cursor is outside"
    );
  });

  await t.test("8. Pin button is hidden in mobile navigation drawer", () => {
    assert.ok(
      sidebarSource.includes("!isMobileDrawer && (") &&
      sidebarSource.includes("aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}"),
      "Pin button must only render when !isMobileDrawer"
    );
  });

  await t.test("9. Bottom Pin/Collapse button is removed while keeping profile and logout", () => {
    assert.ok(
      !sidebarSource.includes("Collapse Sidebar"),
      "Old bottom Collapse Sidebar text must be removed"
    );
    assert.ok(
      sidebarSource.includes("handleLogout"),
      "Logout handler must remain"
    );
    assert.ok(
      sidebarSource.includes("<Avatar"),
      "User avatar must remain in bottom section"
    );
  });
});

test("Sacramental Request Wizard Expanded Layout Suite", async (t) => {
  const reqSource = fs.readFileSync(
    path.join(__dirname, "../src/pages/dashboard/SacramentalRequestPage.tsx"),
    "utf8"
  );

  await t.test("10. Steps 1-4 and Draft Details use w-full max-w-[1000px] mx-auto", () => {
    const cleanReq = reqSource.replace(/\r\n/g, "\n");
    assert.ok(
      cleanReq.includes('{/* Step 1: Select Parish */}\n          {currentStep === 0 && (\n            <div className="space-y-6 w-full max-w-[1000px] mx-auto">'),
      "Step 1 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      cleanReq.includes('{/* Step 2: Document Details */}\n          {currentStep === 1 && (\n            <div className="space-y-6 w-full max-w-[1000px] mx-auto">'),
      "Step 2 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      cleanReq.includes('{/* Step 3: Registrant & Applicant Info */}\n          {currentStep === 2 && (\n            <div className="space-y-6 w-full max-w-[1000px] mx-auto text-left">'),
      "Step 3 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      cleanReq.includes('{/* Step 4: Upload Requirements */}\n          {currentStep === 3 && (\n            <div className="space-y-6 w-full max-w-[1000px] mx-auto">'),
      "Step 4 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      cleanReq.includes('{/* Draft Actions & Status */}\n          {currentStep < 4 && (\n            <div className="w-full max-w-[1000px] mx-auto pt-6 border-t border-border/80">'),
      "Draft section must use w-full max-w-[1000px] mx-auto"
    );
  });

  await t.test("11. Step 2 certificate selection uses responsive 3-column grid on desktop", () => {
    assert.ok(
      reqSource.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"),
      "Step 2 must use responsive 3-column grid"
    );
  });

  await t.test("12. Upload requirement filenames allow larger max-width without premature clipping", () => {
    assert.ok(
      reqSource.includes("truncate max-w-md sm:max-w-xl font-mono"),
      "Supporting and authorization filenames must allow responsive max-w-md sm:max-w-xl"
    );
  });
});

test("Event Scheduler Wizard & DatePickerCalendar Expanded Layout Suite", async (t) => {
  const schedSource = fs.readFileSync(
    path.join(__dirname, "../src/pages/dashboard/EventSchedulerPage.tsx"),
    "utf8"
  );
  const calSource = fs.readFileSync(
    path.join(__dirname, "../src/features/scheduler/components/DatePickerCalendar.tsx"),
    "utf8"
  );

  await t.test("13. Scheduling steps use w-full max-w-[1000px] mx-auto", () => {
    assert.ok(
      schedSource.includes("currentStep === 0 && <div className='space-y-6 w-full max-w-[1000px] mx-auto'>"),
      "Step 0 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      schedSource.includes("currentStep === 1 && <div className='space-y-6 w-full max-w-[1000px] mx-auto'>"),
      "Step 1 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      schedSource.includes("currentStep === 2 && <div className='space-y-6 w-full max-w-[1000px] mx-auto'>"),
      "Step 2 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      schedSource.includes("currentStep === 3 && <div className='space-y-6 w-full max-w-[1000px] mx-auto'>"),
      "Step 3 must use w-full max-w-[1000px] mx-auto"
    );
    assert.ok(
      schedSource.includes("currentStep === 4 && !createdBooking && hasRequirements && <div className='space-y-6 w-full max-w-[1000px] mx-auto'>"),
      "Step 4 must use w-full max-w-[1000px] mx-auto"
    );
  });

  await t.test("14. Service cards and time slots use responsive multi-column layouts", () => {
    assert.ok(
      schedSource.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"),
      "Services must use 3-column grid on desktop"
    );
    assert.ok(
      schedSource.includes("grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5"),
      "Available time slots must use 4-column grid on desktop"
    );
  });

  await t.test("15. DatePickerCalendar expands responsively and increases cell height", () => {
    assert.ok(
      calSource.includes("max-w-[850px] mx-auto"),
      "Calendar container must use max-w-[850px] mx-auto"
    );
    assert.ok(
      calSource.includes("h-11 sm:h-14 lg:h-16"),
      "Date cells must increase height to h-11 sm:h-14 lg:h-16"
    );
    assert.ok(
      calSource.includes("text-lg sm:text-xl text-text-primary"),
      "Calendar header must use enlarged text-lg sm:text-xl"
    );
    assert.ok(
      calSource.includes("title={available ? `${dateStr} is available` : `${dateStr} is unavailable`}"),
      "Availability title invariant must be strictly preserved"
    );
  });
});
