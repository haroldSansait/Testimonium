import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALOY_STORAGE_KEYS,
  clearCaloySessionStorage,
  getPendingQuestion,
  setPendingQuestion,
  clearPendingQuestion,
  isValidChatMessage,
  parseCaloyMessages,
} from "../src/features/chat/caloyStorage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const drawerSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/CaloyDrawer.tsx"), "utf-8");
const safeMarkdownSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/SafeMarkdown.tsx"), "utf-8");
const caloyStorageSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/caloyStorage.ts"), "utf-8");

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("CP6 Physical QA - Frontend Tests (Typing, SafeMarkdown, Clarification)", async (t) => {
  await t.test("1. Typing Indicator: unpurgeable animation styles and accessibility label", () => {
    assert.match(drawerSource, /@keyframes caloyDotPulse/, "Must include unpurgeable @keyframes caloyDotPulse");
    assert.match(drawerSource, /\.caloy-typing-dot/, "Must include .caloy-typing-dot CSS class");
    assert.match(drawerSource, /role="status"/, "Typing indicator must have role='status'");
    assert.match(drawerSource, /aria-label="Caloy is typing an answer"/, "Must have accessible typing label");
    assert.match(drawerSource, /Caloy is typing an answer/, "Must render sr-only text for screen readers");
  });

  await t.test("2. Typing State Machine: send locks input, sets isTyping, disables duplicate submissions", () => {
    // Send button disabled when isTyping or empty
    assert.match(drawerSource, /disabled=\{isTyping \|\| !inputValue\.trim\(\)\}/, "Send button must be disabled during typing");
    // Input disabled while isTyping
    assert.match(drawerSource, /disabled=\{isTyping\}/, "Input must be disabled while isTyping is true");
    // Duplicate send prevented if isTyping
    assert.match(drawerSource, /if \(!cleanInput \|\| isTyping\) return/, "Must reject duplicate send when isTyping is true");
    // isTyping is set to true immediately before await
    assert.match(drawerSource, /setIsTyping\(true\);\s*scrollToBottom\(true\);\s*try/s, "isTyping must be set synchronously before awaiting chat API");
    // isTyping reset in finally block
    assert.match(drawerSource, /finally\s*\{\s*setIsTyping\(false\)/s, "isTyping must be reset in finally block");
  });

  await t.test("3. SafeMarkdown: zero dangerouslySetInnerHTML, blocks raw HTML & javascript: execution", () => {
    assert.doesNotMatch(safeMarkdownSource, /dangerouslySetInnerHTML/, "SafeMarkdown MUST NOT use dangerouslySetInnerHTML");
    assert.doesNotMatch(safeMarkdownSource, /eval\(/, "SafeMarkdown MUST NOT use eval");
    assert.match(safeMarkdownSource, /https\?:\\\/\\\/\|mailto:/, "SafeMarkdown must strictly validate safe URLs (https/http/mailto)");
    assert.match(safeMarkdownSource, /list-disc/, "SafeMarkdown must support bullet lists");
    assert.match(safeMarkdownSource, /list-decimal/, "SafeMarkdown must support numbered lists");
    assert.match(safeMarkdownSource, /font-semibold/, "SafeMarkdown must render bold text using strong elements");
    assert.match(safeMarkdownSource, /code/, "SafeMarkdown must support inline code blocks");
  });

  await t.test("4. CaloyDrawer uses SafeMarkdown for assistant message rendering", () => {
    assert.match(drawerSource, /import \{ SafeMarkdown \} from '\.\/SafeMarkdown'/, "CaloyDrawer must import SafeMarkdown");
    assert.match(drawerSource, /<SafeMarkdown text=\{msg\.text\} \/>/, "CaloyDrawer must render assistant messages using SafeMarkdown");
    assert.match(drawerSource, /msg\.sender === 'user'\s*\?\s*\(.*?\)\s*:\s*\(\s*<SafeMarkdown text=\{msg\.text\} \/>\s*\)/s, "User messages plain, Caloy messages use SafeMarkdown");
  });

  await t.test("5. Contextual Clarification: inline parish selector and auto-resubmission flow", () => {
    // Renders inline parish dropdown when clarificationType is PARISH
    assert.match(drawerSource, /msg\.clarificationType === 'PARISH'/, "Must detect parish clarification message");
    assert.match(drawerSource, /handleInlineParishSelect/, "Must have handler for inline parish selection");
    assert.match(drawerSource, /getPendingQuestion\(\)/, "Must retrieve pending question on inline selection");
    assert.match(drawerSource, /executeQuery\(pending, parishId, false\)/, "Must auto-resubmit pending question with selected parish");
  });

  await t.test("6. Parish Context Chip & Unobtrusive Manual Switcher", () => {
    assert.match(drawerSource, /📍/, "Must display pin icon for selected parish chip");
    assert.match(drawerSource, /Change/, "Must provide Change action button");
    assert.match(drawerSource, /setShowManualParishSelect/, "Must allow toggling manual parish selector");
    assert.match(drawerSource, /handleSelectParish\(null\)/, "Must allow clearing parish filter to diocese-wide");
  });

  await t.test("7. Ephemeral Pending Question Storage & Session Cleanup", () => {
    const storage = new MemoryStorage();

    // Set pending question
    assert.equal(setPendingQuestion("How much is a baptismal certificate?", storage), true);
    assert.equal(getPendingQuestion(storage), "How much is a baptismal certificate?");

    // Clear pending question
    clearPendingQuestion(storage);
    assert.equal(getPendingQuestion(storage), null);

    // Session cleanup removes all Caloy keys including pending question
    setPendingQuestion("Another question", storage);
    storage.setItem(CALOY_STORAGE_KEYS.messages, JSON.stringify([]));
    storage.setItem(CALOY_STORAGE_KEYS.parishId, "3");
    storage.setItem(CALOY_STORAGE_KEYS.sessionId, "uuid-123");

    clearCaloySessionStorage(storage);
    assert.equal(getPendingQuestion(storage), null);
    assert.equal(storage.getItem(CALOY_STORAGE_KEYS.messages), null);
    assert.equal(storage.getItem(CALOY_STORAGE_KEYS.parishId), null);
    assert.equal(storage.getItem(CALOY_STORAGE_KEYS.sessionId), null);
  });

  await t.test("8. ChatMessage schema supports additive responseType and clarificationType", () => {
    const validMessage = {
      id: "msg-1",
      sender: "caloy",
      text: "Which parish?",
      timestamp: "2026-09-11T00:00:00.000Z",
      responseType: "CLARIFICATION",
      clarificationType: "PARISH",
      sources: [],
    };
    assert.equal(isValidChatMessage(validMessage), true);

    const socialMessage = {
      id: "msg-2",
      sender: "caloy",
      text: "Hi! How can I help?",
      timestamp: "2026-09-11T00:00:00.000Z",
      responseType: "SOCIAL",
      sources: [],
    };
    assert.equal(isValidChatMessage(socialMessage), true);
  });
});
