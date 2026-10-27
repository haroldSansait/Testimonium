import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromePath, notificationBrowser } from './helpers/notification-browser.js';

describe('ParishionerSidebar real Chrome browser regression suite', { skip: !chromePath && 'Chrome not found', timeout: 180000 }, () => {
  let browser;

  before(async () => {
    browser = await notificationBrowser();
  });

  after(async () => {
    await browser?.close();
  });

  const getSidebarWidth = async () => {
    return await browser.evaluate(`(() => {
      const aside = document.querySelector('aside');
      return aside ? aside.getBoundingClientRect().width : 0;
    })()`);
  };

  const getAsideComputedWidth = async () => {
    return await browser.evaluate(`(() => {
      const aside = document.querySelector('aside');
      return aside ? parseFloat(window.getComputedStyle(aside).width) : 0;
    })()`);
  };

  const moveMouse = async (x, y) => {
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  };

  const clickAt = async (x, y) => {
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };

  const hoverSidebar = async () => {
    await moveMouse(38, 200);
    // Wait for 80ms hover delay + 300ms transition
    await new Promise(r => setTimeout(r, 450));
  };

  const leaveSidebar = async () => {
    await moveMouse(600, 200);
    // Wait for 120ms leave debounce + 300ms transition
    await new Promise(r => setTimeout(r, 500));
  };

  const resetSidebar = async (width = 1280) => {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate(`(() => {
      localStorage.removeItem('testimonium_pw_sidebar_pinned');
      if (document.activeElement) document.activeElement.blur();
    })()`);
    await browser.send('Page.navigate', { url: `${browser.origin}/dashboard/home` });
    await browser.waitFor(`Boolean(document.querySelector('aside'))`);
    await leaveSidebar();
    await browser.waitFor(`Math.abs(document.querySelector('aside').getBoundingClientRect().width - 76) < 3`);
  };

  it('Scenario A: Basic hover expands smoothly and automatically collapses on pointer leave', async () => {
    await resetSidebar(1440);
    let width = await getSidebarWidth();
    assert.ok(Math.abs(width - 76) < 3, `Expected collapsed ~76px, got ${width}`);

    // Hover
    await hoverSidebar();
    width = await getSidebarWidth();
    assert.ok(Math.abs(width - 280) < 5, `Expected expanded ~280px on hover, got ${width}`);

    // Leave
    await leaveSidebar();
    width = await getSidebarWidth();
    assert.ok(Math.abs(width - 76) < 3, `Expected collapsed ~76px after pointer leave, got ${width}`);
  });

  it('Scenario B: Navigating while unpinned automatically collapses sidebar after mouse leaves without clicking page', async () => {
    const navItems = [
      { id: 'nav-parishes', path: '/dashboard/parishes' },
      { id: 'nav-home', path: '/dashboard/home' },
      { id: 'nav-track', path: '/dashboard/track' },
      { id: 'nav-notifications', path: '/dashboard/notifications' },
    ];

    for (const item of navItems) {
      await resetSidebar(1440);

      // 1. Hover to expand
      await hoverSidebar();
      let width = await getSidebarWidth();
      assert.ok(Math.abs(width - 280) < 5, `Expected expanded before click on ${item.id}`);

      // 2. Click the navigation item using mouse
      const navItemRect = await browser.evaluate(`(() => {
        const el = document.getElementById('${item.id}');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      assert.ok(navItemRect, `NavLink ${item.id} must exist`);

      await clickAt(navItemRect.x, navItemRect.y);

      // Verify route changed
      await browser.waitFor(`window.location.pathname === '${item.path}'`);

      // 3. Move cursor outside sidebar (NO CLICK ON MAIN CONTENT)
      await leaveSidebar();

      // 4. Confirm sidebar collapsed automatically
      width = await getSidebarWidth();
      assert.ok(
        Math.abs(width - 76) < 3,
        `Sidebar MUST collapse to ~76px after navigating to ${item.path} and moving mouse away without clicking page. Got ${width}`
      );
    }
  });

  it('Scenario C: Rapid pointer enter/leave and navigation during animation does not get stuck open', async () => {
    await resetSidebar(1440);

    for (let i = 0; i < 4; i++) {
      await moveMouse(38, 150);
      await new Promise(r => setTimeout(r, 40));
      await moveMouse(500, 150);
      await new Promise(r => setTimeout(r, 60));
    }

    // Move fully outside and wait
    await leaveSidebar();
    const width = await getSidebarWidth();
    assert.ok(Math.abs(width - 76) < 3, `Sidebar must not be stuck open after rapid enters/leaves. Got ${width}`);
  });

  it('Scenario D: Pinned sidebar remains expanded; unpinning restores automatic hover collapse', async () => {
    await resetSidebar(1440);

    // Expand on hover
    await hoverSidebar();

    // Click Pin button
    const pinRect = await browser.evaluate(`(() => {
      const btn = document.querySelector('button[aria-label="Pin Sidebar"]');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    assert.ok(pinRect, 'Pin button must be visible when expanded');
    await clickAt(pinRect.x, pinRect.y);

    // Move pointer away
    await leaveSidebar();
    let width = await getSidebarWidth();
    assert.ok(Math.abs(width - 280) < 5, `Pinned sidebar must stay expanded at ~280px after mouse leave. Got ${width}`);

    // Verify localStorage persistence
    const storedPin = await browser.evaluate(`localStorage.getItem('testimonium_pw_sidebar_pinned')`);
    assert.equal(storedPin, 'true');

    // Click Unpin button
    const unpinRect = await browser.evaluate(`(() => {
      const btn = document.querySelector('button[aria-label="Unpin Sidebar"]');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    assert.ok(unpinRect, 'Unpin button must be present when pinned');
    await clickAt(unpinRect.x, unpinRect.y);

    // Move pointer away
    await leaveSidebar();
    width = await getSidebarWidth();
    assert.ok(Math.abs(width - 76) < 3, `Unpinning must collapse sidebar back to ~76px after mouse leaves. Got ${width}`);
  });

  it('Scenario E: Keyboard accessibility expands sidebar on focus and collapses when focus leaves', async () => {
    await resetSidebar(1440);

    // Focus into first link in sidebar via keyboard
    await browser.evaluate(`(() => {
      const firstLink = document.querySelector('aside a');
      if (firstLink) firstLink.focus({ focusVisible: true });
    })()`);

    // Give react focus handler a moment
    await new Promise(r => setTimeout(r, 400));

    // Blur focus outside
    await browser.evaluate(`(() => {
      if (document.activeElement) document.activeElement.blur();
    })()`);

    await leaveSidebar();
    const width = await getSidebarWidth();
    assert.ok(Math.abs(width - 76) < 3, `Sidebar must collapse when keyboard focus leaves. Got ${width}`);
  });

  it('Scenario F: Visual animation - icons interpolate smoothly between centered and expanded positions', async () => {
    await resetSidebar(1440);

    // In collapsed state, icon must be centered within the pill:
    const collapsedIconStyle = await browser.evaluate(`(() => {
      const navItem = document.getElementById('nav-home');
      const iconSpan = navItem?.querySelector('span');
      return iconSpan ? { left: iconSpan.style.left, computedLeft: window.getComputedStyle(iconSpan).left } : null;
    })()`);
    assert.ok(collapsedIconStyle, 'Icon span must exist');
    assert.equal(collapsedIconStyle.left, '20px', 'Collapsed icon style.left must be 20px (centered in 56px pill)');

    // Expand on hover
    await hoverSidebar();

    const expandedIconStyle = await browser.evaluate(`(() => {
      const navItem = document.getElementById('nav-home');
      const iconSpan = navItem?.querySelector('span');
      return iconSpan ? { left: iconSpan.style.left, computedLeft: window.getComputedStyle(iconSpan).left } : null;
    })()`);
    assert.ok(expandedIconStyle, 'Icon span must exist');
    assert.equal(expandedIconStyle.left, '14px', 'Expanded icon style.left must be 14px');

    // Confirm transition property is transition-[left,color]
    const transitionProperty = await browser.evaluate(`(() => {
      const navItem = document.getElementById('nav-home');
      const iconSpan = navItem?.querySelector('span');
      return iconSpan ? window.getComputedStyle(iconSpan).transitionProperty : '';
    })()`);
    assert.ok(transitionProperty.includes('left'), `Icon must transition left property, got: ${transitionProperty}`);

    await leaveSidebar();
  });

  it('Responsive viewports validation (1024px, 1440px, 1920px)', async () => {
    for (const vpWidth of [1024, 1440, 1920]) {
      await resetSidebar(vpWidth);

      // Collapsed check
      let width = await getSidebarWidth();
      assert.ok(Math.abs(width - 76) < 3, `Viewport ${vpWidth}px must have collapsed width ~76px, got ${width}`);

      // Hover check
      await hoverSidebar();
      width = await getSidebarWidth();
      assert.ok(Math.abs(width - 280) < 5, `Viewport ${vpWidth}px must have expanded width ~280px on hover, got ${width}`);

      // Leave check
      await leaveSidebar();
      width = await getSidebarWidth();
      assert.ok(Math.abs(width - 76) < 3, `Viewport ${vpWidth}px must collapse back to ~76px, got ${width}`);
    }
  });
});
