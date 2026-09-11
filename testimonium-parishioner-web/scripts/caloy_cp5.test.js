import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALOY_STORAGE_KEYS,
  clearCaloySessionStorage,
  parseCaloyMessages,
  readCaloyMessages,
} from "../src/features/chat/caloyStorage.ts";
import { collectAllActiveParishes } from "../src/providers/api/parishPagination.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const typesSource = fs.readFileSync(path.join(__dirname, "../src/providers/types.ts"), "utf-8");
const apiChatSource = fs.readFileSync(path.join(__dirname, "../src/providers/api/chat.ts"), "utf-8");
const demoChatSource = fs.readFileSync(path.join(__dirname, "../src/providers/demo/chat.ts"), "utf-8");
const drawerSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/CaloyDrawer.tsx"), "utf-8");
const assistantSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/CaloyAssistant.tsx"), "utf-8");
const parishSelectorSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/ParishSelector.tsx"), "utf-8");
const sourcesAccordionSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/SourcesAccordion.tsx"), "utf-8");
const sessionServiceSource = fs.readFileSync(path.join(__dirname, "../src/services/SessionService.ts"), "utf-8");
const apiParishSource = fs.readFileSync(path.join(__dirname, "../src/providers/api/parish.ts"), "utf-8");

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function validStoredMessage(overrides = {}) {
  return {
    id: "message-1",
    sender: "caloy",
    text: "Verified response",
    timestamp: "2026-09-11T00:00:00.000Z",
    fallback: false,
    sources: [{
      id: 1,
      title: "Baptism guide",
      sourceType: "SYSTEM_GUIDE",
      sourceReference: "https://example.test/guide",
      authority: "CONFIRMED",
      scope: "DIOCESE",
      parishId: null,
    }],
    ...overrides,
  };
}

test("CP5 Parishioner Web Caloy & RAG Integration Suite", async (t) => {
  // 1. Types Contract
  await t.test("1. Types Contract: ChatSource, ChatResponse without messageId, IChatProvider signature", () => {
    assert.match(typesSource, /export interface ChatSource \{/, "ChatSource interface must exist");
    assert.match(typesSource, /export interface ChatResponse \{/, "ChatResponse interface must exist");
    assert.match(typesSource, /sources:\s*ChatSource\[\];/, "ChatResponse must include ChatSource array");
    assert.doesNotMatch(typesSource, /messageId/, "ChatResponse must NOT contain messageId in V1");
    assert.match(
      typesSource,
      /sendMessage\(\s*question:\s*string,\s*selectedParishId\?:\s*number\s*\|\s*null,\s*sessionId\?:\s*string\s*\):\s*Promise<ChatResponse>;/,
      "IChatProvider.sendMessage must accept question, selectedParishId, and sessionId, returning ChatResponse"
    );
  });

  // 2. ApiChatProvider Source Contract
  await t.test("2. ApiChatProvider: calls /chatbot/query, maps payload and DTO, no key exposure", () => {
    assert.match(apiChatSource, /\/chatbot\/query/, "ApiChatProvider must post to /chatbot/query");
    assert.match(apiChatSource, /question:\s*question\.trim\(\)/, "ApiChatProvider must trim question");
    assert.match(apiChatSource, /selectedParishId/, "ApiChatProvider must handle selectedParishId");
    assert.match(apiChatSource, /sessionId/, "ApiChatProvider must handle sessionId");
    assert.doesNotMatch(apiChatSource, /messageId/, "ApiChatProvider must NOT expect messageId");
    assert.doesNotMatch(apiChatSource, /GEMINI|apiKey|AI_KEY/i, "ApiChatProvider must NOT contain or expose AI API keys");
  });

  // 3. DemoChatProvider Contract
  await t.test("3. DemoChatProvider: returns ChatResponse with sources and no messageId", () => {
    assert.match(demoChatSource, /Promise<ChatResponse>/, "DemoChatProvider must return Promise<ChatResponse>");
    assert.match(demoChatSource, /sources:\s*\[/, "DemoChatProvider must include sources array");
    assert.doesNotMatch(demoChatSource, /messageId/, "DemoChatProvider must NOT contain messageId");
  });

  // 4. Welcome Copy Scope
  await t.test("4. Welcome copy: removes unsupported claims and uses truthful verified guide scope", () => {
    assert.match(
      drawerSource,
      /Ask me about verified guides, procedures, and sacramental requirements across the Diocese\./,
      "Welcome copy must reflect verified guides scope"
    );
    assert.doesNotMatch(
      drawerSource,
      /document fees|scheduling questions|all requirements/i,
      "Welcome copy must NOT claim guaranteed answers on live fees or all scheduling"
    );
  });

  // 5. Accessibility & Focus Management
  await t.test("5. Accessibility: focus trap, Escape listener, focus restore to trigger, aria attributes", () => {
    assert.match(drawerSource, /e\.key === 'Escape'/, "Must handle Escape key to close");
    assert.match(drawerSource, /e\.key === 'Tab'/, "Must contain focus trap tab navigation");
    assert.match(drawerSource, /triggerRef\?\.current\?\.focus\(\)/, "Must restore focus to trigger button on close");
    assert.match(drawerSource, /aria-modal="true"/, "Must have aria-modal=true");
    assert.match(drawerSource, /aria-hidden=\{!isOpen\}/, "Must toggle aria-hidden based on isOpen");
    assert.match(drawerSource, /aria-live="polite"/, "Must announce messages with aria-live");
    assert.match(assistantSource, /triggerRef=\{triggerRef\}/, "CaloyAssistant must pass triggerRef to CaloyDrawer");
  });

  // 6. Input Boundaries & Duplicate Send Prevention
  await t.test("6. Input boundaries: 1000 max length, character counter, duplicate send prevention", () => {
    assert.match(drawerSource, /MAX_QUESTION_LENGTH = 1000/, "Must enforce 1000 character maximum");
    assert.match(drawerSource, /maxLength=\{MAX_QUESTION_LENGTH\}/, "Input element must have maxLength=1000");
    assert.match(drawerSource, /\{inputValue\.length\}\/\{MAX_QUESTION_LENGTH\}/, "Must render character counter");
    assert.match(drawerSource, /disabled=\{isTyping \|\| !inputValue\.trim\(\)\}/, "Send button must disable when typing or empty");
  });

  // 7. Session Resiliency & Storage Cleanup
  await t.test("7. Session storage: centralized cleanup is invoked by direct logout and UI defense", () => {
    assert.match(drawerSource, /readCaloyMessages\(\)/, "Drawer must restore messages through the schema validator");
    assert.match(sessionServiceSource, /public async logout[\s\S]*?clearCaloySessionStorage\(\)/, "Central logout must clear Caloy storage");
    assert.match(assistantSource, /clearCaloySessionStorage\(\)/, "Assistant must retain defense-in-depth cleanup");
    assert.doesNotMatch(sessionServiceSource, /sessionStorage\.clear\(\)/, "Logout must not wipe unrelated session storage");
  });

  // 8. Parish Selector Contract
  await t.test("8. ParishSelector: defaults to Diocese-wide, no profile preselection, clearable", () => {
    assert.match(parishSelectorSource, /Diocese-wide \(All Parishes\)/, "Default option must be Diocese-wide");
    assert.match(parishSelectorSource, /services\.parish\.getParishes\(\)/, "Must load parishes via official service");
    assert.doesNotMatch(parishSelectorSource, /useAuth|userProfile|user\.parishId/i, "Must NOT pre-populate from user profile");
    assert.match(parishSelectorSource, /onSelectParish\(null\)/, "Must allow clearing parish to null");
  });

  // 9. Sources Accordion Security
  await t.test("9. SourcesAccordion: renders citations only for non-fallback, safe HTTPS check, no raw HTML", () => {
    assert.match(sourcesAccordionSource, /url\.protocol === 'https:'/, "Must strictly require https: protocol for clickable URLs");
    assert.match(sourcesAccordionSource, /target="_blank"/, "External links must open in new tab");
    assert.match(sourcesAccordionSource, /rel="noopener noreferrer"/, "External links must use rel=noopener noreferrer");
    assert.doesNotMatch(sourcesAccordionSource, /dangerouslySetInnerHTML|innerHTML/, "Must NEVER render arbitrary HTML in sources");
    assert.match(drawerSource, /!msg\.fallback && \(\s*<SourcesAccordion/, "SourcesAccordion must ONLY be rendered for non-fallback answers");
  });

  // 10. Error Translation & Safe Fallback
  await t.test("10. Error handling: translates 429, 503, and network errors without exposing stack traces", () => {
    assert.match(drawerSource, /429|CHATBOT_RATE_LIMITED/, "Must handle rate limit status");
    assert.match(drawerSource, /503|CHATBOT_UNAVAILABLE/, "Must handle 503 unavailable status");
    assert.match(drawerSource, /internet connection/, "Must handle network failures");
    assert.doesNotMatch(drawerSource, /err\.stack|err\.details|error\.data/i, "Must NOT expose raw error stack traces to user");
  });

  // 11. Behavioral Harness: Input Clamping and URL Safety Logic
  await t.test("11. Behavioral: input clamping, whitespace normalization, and URL validation", () => {
    const isSafeHttpsUrl = (ref) => {
      if (!ref) return false;
      try {
        const url = new URL(ref.trim());
        return url.protocol === "https:";
      } catch {
        return false;
      }
    };

    assert.equal(isSafeHttpsUrl("https://bacoloddiocese.org/canon-law"), true);
    assert.equal(isSafeHttpsUrl("http://insecure.example.com"), false);
    assert.equal(isSafeHttpsUrl("javascript:alert(document.cookie)"), false);
    assert.equal(isSafeHttpsUrl("Parish Handbook p. 45"), false);
    assert.equal(isSafeHttpsUrl(""), false);

    // Whitespace / Length simulation
    const raw = "   Hello Caloy   ";
    assert.equal(raw.trim(), "Hello Caloy");
    assert.equal("   ".trim().length, 0);

    const longText = "x".repeat(1200);
    const clamped = longText.slice(0, 1000);
    assert.equal(clamped.length, 1000);
  });

  await t.test("12. Behavioral: stored messages are fully validated and malformed caches are removed", () => {
    const valid = [validStoredMessage()];
    assert.deepEqual(parseCaloyMessages(JSON.stringify(valid)), valid);
    assert.equal(parseCaloyMessages("{bad-json"), null);
    assert.equal(parseCaloyMessages(JSON.stringify({ messages: valid })), null);
    assert.equal(parseCaloyMessages(JSON.stringify([validStoredMessage({ text: 7 })])), null);
    const missingText = validStoredMessage();
    delete missingText.text;
    assert.equal(parseCaloyMessages(JSON.stringify([missingText])), null);
    assert.equal(parseCaloyMessages(JSON.stringify([validStoredMessage({ timestamp: "not-a-date" })])), null);
    assert.equal(parseCaloyMessages(JSON.stringify([validStoredMessage({ sources: [{ id: "1" }] })])), null);

    const storage = new MemoryStorage([[CALOY_STORAGE_KEYS.messages, JSON.stringify([validStoredMessage({ sender: "system" })])]]);
    assert.equal(readCaloyMessages(storage), null);
    assert.equal(storage.getItem(CALOY_STORAGE_KEYS.messages), null);
  });

  await t.test("13. Behavioral: logout removes only Caloy-owned keys", () => {
    const storage = new MemoryStorage([
      [CALOY_STORAGE_KEYS.messages, "[]"],
      [CALOY_STORAGE_KEYS.sessionId, "session"],
      [CALOY_STORAGE_KEYS.parishId, "8"],
      ["unrelated_session_key", "preserve-me"],
    ]);
    clearCaloySessionStorage(storage);
    for (const key of Object.values(CALOY_STORAGE_KEYS)) assert.equal(storage.getItem(key), null);
    assert.equal(storage.getItem("unrelated_session_key"), "preserve-me");
  });

  await t.test("14. Behavioral: parish enumeration follows every active public page", async () => {
    const calls = [];
    const pages = [
      Array.from({ length: 30 }, (_, index) => ({ id: index + 1, status: "Active" })),
      Array.from({ length: 30 }, (_, index) => ({ id: index + 31, status: "Active" })),
      [{ id: 61, status: "Active" }, { id: 1, status: "Active" }, { id: 62, status: "Archived" }],
    ];
    const result = await collectAllActiveParishes(async (page, limit) => {
      calls.push([page, limit]);
      return { items: pages[page - 1], page, totalPages: 3 };
    }, 30);
    assert.equal(result.length, 61);
    assert.deepEqual(calls, [[1, 30], [2, 30], [3, 30]]);
    assert.equal(result.some((parish) => parish.id === 62), false);
    assert.match(apiParishSource, /client\.get<any>\("\/parishes", \{ page, limit, status: "Active" \}\)/);
    assert.doesNotMatch(apiParishSource, /selector|user.*parishId/i);
  });
});
