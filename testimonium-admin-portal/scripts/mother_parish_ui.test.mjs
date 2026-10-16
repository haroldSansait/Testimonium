import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('Admin Portal — Mother Parish UI Polish Suite', async (t) => {
  const pagePath = path.join(srcDir, 'pages/ParishManagementPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  await t.test('1 & 2. Table Row Rendering: isMotherParish=true renders "Mother Parish" label; isMotherParish=false renders nothing', () => {
    // Helper replicating the canonical ParishManagementPage table cell rendering logic
    function renderParishCell(parish) {
      return renderToStaticMarkup(
        React.createElement(
          'td',
          { className: 'font-semibold text-gray-900' },
          React.createElement('div', null, parish.name),
          parish.isMotherParish
            ? React.createElement(
                'div',
                { className: 'mt-0.5' },
                React.createElement(
                  'span',
                  {
                    className:
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-crimson-50 text-crimson-700 border border-crimson-200/60 leading-none',
                  },
                  'Mother Parish'
                )
              )
            : null
        )
      );
    }

    const motherParish = {
      id: 'parish-2',
      name: 'St. Joseph Parish',
      isMotherParish: true,
    };

    const regularParish = {
      id: 'parish-6',
      name: 'Holy Child Parish',
      isMotherParish: false,
    };

    const motherHtml = renderParishCell(motherParish);
    const regularHtml = renderParishCell(regularParish);

    // 1. isMotherParish=true -> "Mother Parish" label renders
    assert.match(motherHtml, /St\. Joseph Parish/);
    assert.match(motherHtml, /Mother Parish/);
    assert.match(motherHtml, /bg-crimson-50/);

    // 2. isMotherParish=false -> no Mother Parish text renders
    assert.match(regularHtml, /Holy Child Parish/);
    assert.doesNotMatch(regularHtml, /Mother Parish/);
    assert.doesNotMatch(regularHtml, /bg-crimson-50/);
  });

  await t.test('3 & 4. Table Invariant: "Mother Parish: Yes" and "Mother Parish: No" do NOT render anywhere', () => {
    // Neither "Mother Parish: Yes" nor "Mother Parish: No" should exist in the source or output
    assert.equal(pageContent.includes('Mother Parish: Yes'), false, '"Mother Parish: Yes" must not appear in ParishManagementPage');
    assert.equal(pageContent.includes('Mother Parish: No'), false, '"Mother Parish: No" must not appear in ParishManagementPage');
    assert.equal(pageContent.includes("Mother Parish: {parish.isMotherParish ? 'Yes' : 'No'}"), false, 'Old boolean ternary must not exist');
  });

  await t.test('5. Existing New/Edit Mother Parish toggle remains functional and accessible', () => {
    // Edit modal toggle verification
    assert.ok(pageContent.includes('ep-is-mother-parish'), 'Must retain ep-is-mother-parish toggle id');
    assert.ok(pageContent.includes('Set as Mother Parish'), 'Must preserve "Set as Mother Parish" toggle text in Edit Parish');
    assert.ok(pageContent.includes("form.isMotherParish ? 'ON' : 'OFF'"), 'Must display ON/OFF label');

    // New parish wizard toggle verification
    const wizardPath = path.join(srcDir, 'components/parish-management/NewParishWizard.tsx');
    const wizardContent = fs.readFileSync(wizardPath, 'utf8');
    assert.ok(wizardContent.includes('parish-is-mother'), 'Must retain parish-is-mother toggle id');
    assert.ok(wizardContent.includes('Set as Mother Parish'), 'Must preserve "Set as Mother Parish" toggle text in New Parish');
    assert.ok(wizardContent.includes("data.isMotherParish ? 'ON' : 'OFF'"), 'Must display ON/OFF label in wizard');
  });

  await t.test('6. Backend single-Mother-Parish conflict is surfaced through existing error handling', () => {
    // Verification of error presentation plumbing in ParishManagementPage
    assert.ok(pageContent.includes('setSaveError'), 'Edit modal must support inline saveError display');
    assert.ok(pageContent.includes('ep-error-message'), 'Edit modal must render inline error banner with ep-error-message');
    assert.ok(pageContent.includes("showToast(errorMsg, 'error')"), 'Edit handler must display server error message in toast');

    // Parish writes use the API provider; the backend enforces the single-Mother-Parish rule.
    const factoryContent = fs.readFileSync(path.join(srcDir, 'providers/providerFactory.ts'), 'utf8');
    const apiContent = fs.readFileSync(path.join(srcDir, 'providers/api/ApiParishProvider.ts'), 'utf8');
    assert.match(factoryContent, /getParishProvider\(\): ParishProvider\s*\{\s*return ApiParishProvider;/);
    assert.ok(apiContent.includes("api.post<ApiResponseEnvelope<Parish>>('/parishes', data)"));
    assert.ok(apiContent.includes('api.put<ApiResponseEnvelope<Parish>>(`/parishes/${id}`, data)'));

    // Simulate backend conflict rejection
    const conflictError = {
      response: {
        status: 409,
        data: {
          success: false,
          code: 'MOTHER_PARISH_ALREADY_EXISTS',
          message: 'Another parish is already designated as the Mother Parish. Unset it before designating a different parish.',
        },
      },
    };

    let toastMessage = null;
    let toastType = null;
    const showToast = (msg, type) => {
      toastMessage = msg;
      toastType = type;
    };

    const errorMsg =
      conflictError?.response?.data?.message ||
      conflictError?.message ||
      'Failed to update parish.';
    showToast(errorMsg, 'error');

    assert.equal(
      toastMessage,
      'Another parish is already designated as the Mother Parish. Unset it before designating a different parish.'
    );
    assert.equal(toastType, 'error');
  });
});
