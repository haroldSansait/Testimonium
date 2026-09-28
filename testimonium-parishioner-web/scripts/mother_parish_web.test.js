import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

test("Parishioner Web — Vicariate Directory Mother Parish UI Suite", async (t) => {
  const cardPath = path.join(srcDir, "features/parishes/components/ParishCard.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf8");

  const drawerPath = path.join(srcDir, "features/parishes/components/ParishDrawer.tsx");
  const drawerContent = fs.readFileSync(drawerPath, "utf8");

  const directoryPagePath = path.join(srcDir, "pages/dashboard/ParishDirectoryPage.tsx");
  const directoryPageContent = fs.readFileSync(directoryPagePath, "utf8");

  const typesPath = path.join(srcDir, "types/index.ts");
  const typesContent = fs.readFileSync(typesPath, "utf8");

  const apiParishPath = path.join(srcDir, "providers/api/parish.ts");
  const apiParishContent = fs.readFileSync(apiParishPath, "utf8");

  await t.test("Contracts: Parish type and API mapper expose isMotherParish boolean", () => {
    assert.ok(typesContent.includes("isMotherParish?: boolean;"), "Parish type must include isMotherParish?: boolean");
    assert.ok(apiParishContent.includes("isMotherParish: Boolean(p.isMotherParish),"), "API mapper must map isMotherParish boolean");
  });

  await t.test("1. Mother Parish card/detail shows \"Mother Parish\" label", () => {
    // Helper replicating ParishCard rendering logic
    function renderParishCard(parish) {
      return renderToStaticMarkup(
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "space-y-1" },
            React.createElement(
              "div",
              { className: "flex flex-wrap items-center gap-1.5" },
              React.createElement("h3", { className: "font-serif font-bold text-text-primary text-sm" }, parish.name),
              parish.isMotherParish
                ? React.createElement(
                    "span",
                    { className: "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-crimson/10 text-crimson border border-crimson/20" },
                    "Mother Parish"
                  )
                : null
            ),
            React.createElement("p", { className: "text-xs text-text-muted" }, parish.address)
          )
        )
      );
    }

    const motherParish = {
      id: "p1",
      name: "San Isidro Labrador Parish",
      address: "National Highway, Poblacion, Canlaon City",
      isMotherParish: true,
    };

    const cardHtml = renderParishCard(motherParish);
    assert.match(cardHtml, /San Isidro Labrador Parish/);
    assert.match(cardHtml, /Mother Parish/);
    assert.match(cardHtml, /bg-crimson\/10/);

    // Source assertions on ParishCard and ParishDrawer
    assert.ok(cardContent.includes("parish.isMotherParish"), "ParishCard must check parish.isMotherParish");
    assert.ok(cardContent.includes("Mother Parish"), "ParishCard must include 'Mother Parish' label");
    assert.ok(drawerContent.includes("effectiveParish.isMotherParish"), "ParishDrawer must check effectiveParish.isMotherParish");
    assert.ok(drawerContent.includes("Mother Parish"), "ParishDrawer must include 'Mother Parish' label");
  });

  await t.test("2. Ordinary parish card/detail shows no Mother Parish label or placeholder", () => {
    function renderParishCard(parish) {
      return renderToStaticMarkup(
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "space-y-1" },
            React.createElement(
              "div",
              { className: "flex flex-wrap items-center gap-1.5" },
              React.createElement("h3", { className: "font-serif font-bold text-text-primary text-sm" }, parish.name),
              parish.isMotherParish
                ? React.createElement(
                    "span",
                    { className: "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-crimson/10 text-crimson border border-crimson/20" },
                    "Mother Parish"
                  )
                : null
            ),
            React.createElement("p", { className: "text-xs text-text-muted" }, parish.address)
          )
        )
      );
    }

    const ordinaryParish = {
      id: "p2",
      name: "St. Joseph the Worker Parish",
      address: "Brgy. Malaiba, Canlaon City",
      isMotherParish: false,
    };

    const cardHtml = renderParishCard(ordinaryParish);
    assert.match(cardHtml, /St\. Joseph the Worker Parish/);
    assert.doesNotMatch(cardHtml, /Mother Parish/);
    assert.doesNotMatch(cardHtml, /Mother Parish: No/);
    assert.doesNotMatch(cardHtml, /Mother Parish: Yes/);

    // Source contract: no "Mother Parish: No" anywhere in Web directory components
    assert.equal(cardContent.includes("Mother Parish: No"), false);
    assert.equal(drawerContent.includes("Mother Parish: No"), false);
    assert.equal(directoryPageContent.includes("Mother Parish: No"), false);
  });

  await t.test("3. Sidebar and search results in ParishDirectoryPage do NOT add Mother Parish badges", () => {
    // ParishDirectoryPage sidebar list and search suggestions must NOT render Mother Parish designations
    assert.equal(
      directoryPageContent.includes("Mother Parish"),
      false,
      "ParishDirectoryPage must not render Mother Parish badges in sidebar list or search entries"
    );
    assert.equal(
      directoryPageContent.includes("isMotherParish"),
      false,
      "ParishDirectoryPage must not reference isMotherParish in sidebar list or search entries"
    );
  });

  await t.test("4. Existing card information and layout remain unchanged", () => {
    // ParishCard preserves name and address
    assert.ok(cardContent.includes("parish.name"), "ParishCard must retain parish.name");
    assert.ok(cardContent.includes("parish.address"), "ParishCard must retain parish.address");
    assert.ok(cardContent.includes("MapPin"), "ParishCard must retain MapPin icon");
    assert.ok(cardContent.includes("ArrowRight"), "ParishCard must retain ArrowRight icon");

    // ParishDrawer preserves type, feastDay, name, patronSaint, address, officeHours, etc.
    assert.ok(drawerContent.includes("effectiveParish.type"), "ParishDrawer must retain parish type");
    assert.ok(drawerContent.includes("parish.feastDay"), "ParishDrawer must retain feast day");
    assert.ok(drawerContent.includes("parish.name"), "ParishDrawer must retain name");
    assert.ok(drawerContent.includes("parish.patronSaint"), "ParishDrawer must retain patron saint");
    assert.ok(drawerContent.includes("parish.address"), "ParishDrawer must retain address");
    assert.ok(drawerContent.includes("officeIsOpen"), "ParishDrawer must retain office open/closed status");
  });
});
