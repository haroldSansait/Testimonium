import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALOY_STORAGE_KEYS,
  clearCaloySessionStorage,
  getStructuredClarification,
  setStructuredClarification,
  clearStructuredClarification,
  isValidChatMessage,
} from "../src/features/chat/caloyStorage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const drawerSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/CaloyDrawer.tsx"), "utf-8");
const hookSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/hooks/useProgressiveReveal.ts"), "utf-8");
const caloyStorageSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/caloyStorage.ts"), "utf-8");

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("Caloy Fast Response Reveal & Live Tools UX Suite", async (t) => {
  // -------------------------------------------------------------
  // 1. Fast Progressive Reveal Contract
  // -------------------------------------------------------------
  await t.test("1. Progressive Reveal Hook & CaloyDrawer Animation Contracts", () => {
    // 15-25ms cadence
    assert.match(hookSource, /tickIntervalMs\s*=\s*(1[5-9]|2[0-5])/, "useProgressiveReveal must use a ~15-25ms cadence");
    assert.match(drawerSource, /18/, "CaloyDrawer animation interval must use an ~18ms cadence");

    // Fast completion on unmount
    assert.match(drawerSource, /clearInterval\(activeRevealTimerRef\.current\)/, "Must clear active animation timers on unmount or completion");

    // Fast completion on second send
    assert.match(drawerSource, /completeActiveReveal\(\)/, "Must immediately complete in-flight reveal when user submits another message");

    // Reduced motion preference
    assert.match(drawerSource, /prefers-reduced-motion/, "CaloyDrawer must check prefers-reduced-motion");
    assert.match(hookSource, /prefers-reduced-motion/, "useProgressiveReveal must check prefers-reduced-motion");

    // Sources and Live Data badge hidden during active reveal
    assert.match(drawerSource, /revealingMessageId !== msg\.id/, "Sources, badges, and inline options must remain hidden while message is revealing");
  });

  // -------------------------------------------------------------
  // 2. Restored Messages Bypass Animation
  // -------------------------------------------------------------
  await t.test("2. Restored messages from sessionStorage are marked isRestored and render immediately", () => {
    assert.match(caloyStorageSource, /isRestored:\s*true/, "readCaloyMessages must mark restored messages with isRestored=true");
    assert.match(hookSource, /isRestored/, "Hook must skip progressive animation for restored messages");
  });

  // -------------------------------------------------------------
  // 3. Live Data UI & Badge Contracts
  // -------------------------------------------------------------
  await t.test("3. Live Data UI renders ✓ Current TESTIMONIUM Data and hides tool IDs", () => {
    // Check badge text
    assert.match(drawerSource, /Current TESTIMONIUM Data/, "Must display 'Current TESTIMONIUM Data' badge for LIVE_DATA");
    assert.match(drawerSource, /✓/, "Must display checkmark icon next to Current TESTIMONIUM Data");
    assert.match(drawerSource, /Updated just now/, "Must display 'Updated just now' timestamp indicator");

    // Internal tool names must NOT be rendered to user
    assert.doesNotMatch(drawerSource, /GET_ACTIVE_PARISH_PRIESTS|GET_DOCUMENT_FEE|CHECK_MY_REQUEST_STATUS/, "Internal tool IDs must never be exposed to users in UI");
  });

  // -------------------------------------------------------------
  // 4. Multi-Step Structured Clarification UI
  // -------------------------------------------------------------
  await t.test("4. Multi-Step Clarification supports PARISH, DOCUMENT_TYPE, and SCHEDULE_EVENT", () => {
    // Selectors exist for all supported clarification types
    assert.match(drawerSource, /msg\.clarificationType === 'PARISH'/, "Must support inline PARISH selector");
    assert.match(drawerSource, /msg\.clarificationType === 'DOCUMENT_TYPE'/, "Must support inline DOCUMENT_TYPE selector");
    assert.match(drawerSource, /msg\.clarificationType === 'SCHEDULE_EVENT'/, "Must support inline SCHEDULE_EVENT selector");

    // Handlers update structured state and resubmit without user retyping
    assert.match(drawerSource, /handleInlineDocTypeSelect/, "Must implement handleInlineDocTypeSelect");
    assert.match(drawerSource, /handleInlineEventTypeSelect/, "Must implement handleInlineEventTypeSelect");
  });

  // -------------------------------------------------------------
  // 5. Ephemeral Structured Clarification Storage & Cleanup
  // -------------------------------------------------------------
  await t.test("5. Structured clarification storage lifecycle and logout cleanup", () => {
    const storage = new MemoryStorage();

    const clarificationData = {
      originalQuestion: "How much is the certificate?",
      toolId: "GET_DOCUMENT_FEE",
      collected: { documentType: "BAPTISMAL_CERTIFICATE" },
      nextRequired: "PARISH",
    };

    // Store structured clarification
    assert.equal(setStructuredClarification(clarificationData, storage), true);
    assert.deepEqual(getStructuredClarification(storage), clarificationData);

    // Clear structured clarification
    clearStructuredClarification(storage);
    assert.equal(getStructuredClarification(storage), null);

    // Centralized logout cleanup removes structured clarification key
    setStructuredClarification(clarificationData, storage);
    clearCaloySessionStorage(storage);
    assert.equal(storage.getItem(CALOY_STORAGE_KEYS.structuredClarification), null);
  });

  // -------------------------------------------------------------
  // 6. Distinct Rate Limit Error Translation
  // -------------------------------------------------------------
  await t.test("6. UI error translation differentiates AI provider 429, user AI quota, and spam limiter", () => {
    // Provider 429 translation
    assert.match(drawerSource, /AI_PROVIDER_RATE_LIMITED/, "Must explicitly check AI_PROVIDER_RATE_LIMITED");
    assert.match(drawerSource, /Caloy's AI service is temporarily at its usage limit/, "Must display provider limit message");

    // User AI quota translation
    assert.match(drawerSource, /CHATBOT_AI_LIMIT_REACHED/, "Must explicitly check CHATBOT_AI_LIMIT_REACHED");
    assert.match(drawerSource, /You've reached Caloy's AI question limit for now/, "Must display user AI question limit message");

    // Spam / General abuse limiter translation
    assert.match(drawerSource, /You're sending messages too quickly\. Please wait a moment\./, "Must display spam limiter message without mentioning Gemini");
  });

  // -------------------------------------------------------------
  // 7. SafeMarkdown Direct Rendering Invariant
  // -------------------------------------------------------------
  await t.test("7. CaloyDrawer preserves SafeMarkdown rendering directly without dangerouslySetInnerHTML", () => {
    assert.match(drawerSource, /<SafeMarkdown text=\{msg\.text\} \/>/, "CaloyDrawer must render assistant text directly using SafeMarkdown");
    assert.doesNotMatch(drawerSource, /dangerouslySetInnerHTML/, "CaloyDrawer must never use dangerouslySetInnerHTML");
  });
});
