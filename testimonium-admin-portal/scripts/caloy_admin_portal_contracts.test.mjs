import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { caloyAdminContractFixtures } from '../../test-support/caloyAdminContractFixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Caloy Admin Portal Contract & Governance Invariant Suite', async (t) => {
  await t.test('1. Role Permissions: DIOCESE_COORDINATOR exclusively possesses Caloy permissions', async () => {
    const rolePermissionsPath = path.join(srcDir, 'permissions/rolePermissions.ts');
    const content = fs.readFileSync(rolePermissionsPath, 'utf8');

    // Check DIOCESE_COORDINATOR has Caloy permissions
    assert.ok(content.includes('PERMISSIONS.VIEW_CALOY'));
    assert.ok(content.includes('PERMISSIONS.MANAGE_CALOY_SETTINGS'));
    assert.ok(content.includes('PERMISSIONS.VIEW_CALOY_LOGS'));
    assert.ok(content.includes('PERMISSIONS.MANAGE_CALOY_LOGS'));
    assert.ok(content.includes('PERMISSIONS.MANAGE_KNOWLEDGE_BASE'));

    // Check helper guards exported
    assert.ok(content.includes('export function canViewCaloy'));
    assert.ok(content.includes('export function canManageCaloySettings'));
    assert.ok(content.includes('export function canViewCaloyLogs'));
    assert.ok(content.includes('export function canManageCaloyLogs'));

    // Verify SECRETARY and PRIEST do not receive Caloy permissions
    const secretaryBlock = content.match(/SECRETARY:\s*\[([\s\S]*?)\],/)?.[1] || '';
    assert.ok(!secretaryBlock.includes('VIEW_CALOY'), 'SECRETARY must not have VIEW_CALOY');
    assert.ok(!secretaryBlock.includes('MANAGE_CALOY'), 'SECRETARY must not have MANAGE_CALOY');

    const priestBlock = content.match(/PRIEST:\s*\[([\s\S]*?)\],/)?.[1] || '';
    assert.ok(!priestBlock.includes('VIEW_CALOY'), 'PRIEST must not have VIEW_CALOY');
    assert.ok(!priestBlock.includes('MANAGE_CALOY'), 'PRIEST must not have MANAGE_CALOY');
  });

  await t.test('2. Sidebar Navigation: Caloy replaces standalone Knowledge Base; general Analytics preserved', async () => {
    const sidebarPath = path.join(srcDir, 'components/layout/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    // Contains Caloy nav item
    assert.ok(content.includes("to: '/caloy'"));
    assert.ok(content.includes("label: 'Caloy'"));
    assert.ok(content.includes('permission: PERMISSIONS.VIEW_CALOY'));

    // Standalone Knowledge Base is removed from top-level NAV_ITEMS
    assert.ok(!content.includes("to: '/knowledge-base',\n    label: 'Knowledge Base'"), 'Standalone Knowledge Base should not exist in NAV_ITEMS');

    // General Analytics and Activity Log must remain intact
    assert.ok(content.includes("to: '/analytics'"));
    assert.ok(content.includes("to: '/activity-log'"));
  });

  await t.test('3. AppRouter: Caloy Control Center routes mounted and legacy Knowledge Base redirects preserved', async () => {
    const routerPath = path.join(srcDir, 'routes/AppRouter.tsx');
    const content = fs.readFileSync(routerPath, 'utf8');

    // Centralized Caloy route group
    assert.ok(content.includes('path="/caloy"'));
    assert.ok(content.includes('path="analytics"'));
    assert.ok(content.includes('path="knowledge-base"'));
    assert.ok(content.includes('path="knowledge-base/:id"'));
    assert.ok(content.includes('path="settings"'));
    assert.ok(content.includes('path="logs"'));

    // Legacy Redirects
    assert.ok(content.includes('path="/knowledge-base" element={<Navigate to="/caloy/knowledge-base" replace />}'));
    assert.ok(content.includes('path="/knowledge-base/:id"'));
    assert.ok(content.includes('LegacyKnowledgeDetailRedirect'));
  });

  await t.test('4. Knowledge Detail Navigation: back button and breadcrumb point to /caloy/knowledge-base', async () => {
    const detailPath = path.join(srcDir, 'pages/KnowledgeSourceDetailPage.tsx');
    const content = fs.readFileSync(detailPath, 'utf8');

    assert.ok(content.includes("navigate('/caloy/knowledge-base')"));
    assert.ok(content.includes("navigate('/caloy')"));
  });

  await t.test('5. Conversation Review is completely removed (no models, routes, or viewers)', async () => {
    const routerPath = path.join(srcDir, 'routes/AppRouter.tsx');
    const content = fs.readFileSync(routerPath, 'utf8');

    assert.ok(!content.toLowerCase().includes('conversation-review'));
    assert.ok(!content.toLowerCase().includes('conversationreview'));
  });

  await t.test('6. Shared serialized Admin fixtures render through the real Caloy page components', async () => {
    const root = path.resolve(__dirname, '..');
    const vite = await createServer({
      root,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    });

    try {
      const [overviewModule, analyticsModule, settingsModule, logsModule, knowledgeModule, authModule] = await Promise.all([
        vite.ssrLoadModule('/src/pages/caloy/CaloyOverviewPage.tsx'),
        vite.ssrLoadModule('/src/pages/caloy/CaloyAnalyticsPage.tsx'),
        vite.ssrLoadModule('/src/pages/caloy/CaloySettingsPage.tsx'),
        vite.ssrLoadModule('/src/pages/caloy/CaloyLogsPage.tsx'),
        vite.ssrLoadModule('/src/pages/KnowledgeBasePage.tsx'),
        vite.ssrLoadModule('/src/context/AuthContext.tsx'),
      ]);

      const authValue = {
        currentUser: null,
        applicationUser: null,
        role: 'DIOCESE_COORDINATOR',
        loading: false,
        sessionState: 'ACTIVE',
        isWarningModalOpen: false,
        secondsRemaining: 900,
        staySignedIn: async () => {},
        signIn: async () => {},
        logout: async () => {},
        refreshUser: async () => {},
      };
      const renderPage = (Component, props) => renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            authModule.AuthContext.Provider,
            { value: authValue },
            React.createElement(Component, props),
          ),
        ),
      );

      const overviewHtml = renderPage(overviewModule.CaloyOverviewPage, { initialData: caloyAdminContractFixtures.overview });
      const analyticsHtml = renderPage(analyticsModule.CaloyAnalyticsPage, { initialData: caloyAdminContractFixtures.analytics });
      const settingsHtml = renderPage(settingsModule.CaloySettingsPage, { initialData: caloyAdminContractFixtures.settings });
      const logsHtml = renderPage(logsModule.CaloyLogsPage, { initialData: caloyAdminContractFixtures.logs });
      const knowledgeHtml = renderPage(knowledgeModule.KnowledgeBasePage, {
        initialKnowledgeStats: caloyAdminContractFixtures.knowledgeStats,
        initialSources: [],
      });

      assert.match(overviewHtml, /Active &amp; Available/);
      assert.match(analyticsHtml, /GLOBAL_DATE_AND_MODEL_FILTERED|global date\/model-filtered/i);
      assert.match(settingsHtml, /gemini-3\.5-flash-lite/);
      assert.match(logsHtml, /St\. Joseph Parish/);
      assert.match(knowledgeHtml, /82\.0%/);

      assert.equal(logsModule.shouldAcceptPurgePreview(
        { ...caloyAdminContractFixtures.purgePreview, daysOlderThan: 90 },
        90,
        1,
        2,
      ), false, 'an out-of-order preview response must be ignored');
      assert.equal(logsModule.isPurgePreviewReady(caloyAdminContractFixtures.purgePreview, 90), false);
      assert.equal(logsModule.isPurgePreviewReady(caloyAdminContractFixtures.purgePreview, 180), true);
    } finally {
      await vite.close();
    }
  });
});
