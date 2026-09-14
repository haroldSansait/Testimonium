import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isValidChatMessage,
  parseCaloyMessages,
  CALOY_STORAGE_KEYS,
} from "../src/features/chat/caloyStorage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const selectSource = fs.readFileSync(path.join(__dirname, "../src/components/ui/CustomSelect.tsx"), "utf-8");
const drawerSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/CaloyDrawer.tsx"), "utf-8");
const animatedMsgSource = fs.readFileSync(path.join(__dirname, "../src/features/chat/components/AnimatedAssistantMessage.tsx"), "utf-8");

test("Caloy Chatbot - Dropdown Compression and Selection Persistence Suite", async (t) => {
  await t.test("1. CustomSelect supports compression and custom selection labels", () => {
    // Contract: CustomSelectProps includes selectedLabel and maxHeight
    assert.match(selectSource, /selectedLabel\?: string;/, "CustomSelectProps must include optional selectedLabel");
    assert.match(selectSource, /maxHeight\?: string;/, "CustomSelectProps must include optional maxHeight");

    // Contract: Compact mode compresses list height below default 240px
    assert.match(selectSource, /maxHeight\s*\|\|\s*\(isCompact \? 'max-h-40' : 'max-h-52'\)/, "Options container must use compressed max height for compact mode");
    assert.match(selectSource, /isCompact \? 'min-h-\[28px\] px-2\.5 py-1 text-xs'/, "Options must use compressed row height in compact mode");

    // Contract: displayLabel resolves from selectedOption.label or fallback selectedLabel
    assert.match(selectSource, /const displayLabel = selectedOption\?\.label \|\| selectedLabel;/, "Must resolve displayLabel from selectedOption or selectedLabel prop");
  });

  await t.test("2. CaloyDrawer preserves and displays selected parish after choice", () => {
    // Inline parish selector renders when selectedClarificationValue is set even if not latest message
    assert.match(
      drawerSource,
      /msg\.clarificationType === 'PARISH' && revealingMessageId !== msg\.id && \(idx === messages\.length - 1 \|\| Boolean\(msg\.selectedClarificationValue/,
      "Parish clarification selector must remain visible when selectedClarificationValue is set"
    );

    // Shows updated label and binds value and selectedLabel
    assert.match(drawerSource, /isSelected \? 'Selected parish:' : 'Select your parish to continue:'/, "Must render confirmed label once selected");
    assert.match(drawerSource, /selectedLabel=\{selectedLabel\}/, "Must bind selectedLabel to CustomSelect");

    // Handler records selectedClarificationValue and selectedClarificationLabel
    assert.match(drawerSource, /selectedClarificationValue:\s*parishId/, "handleInlineParishSelect must store parishId on message");
    assert.match(drawerSource, /selectedClarificationLabel:\s*parishLabel/, "handleInlineParishSelect must store parishLabel on message");
  });

  await t.test("3. CaloyDrawer preserves and displays selected document type and schedule event", () => {
    // Document type persists
    assert.match(
      drawerSource,
      /msg\.clarificationType === 'DOCUMENT_TYPE' && revealingMessageId !== msg\.id && \(idx === messages\.length - 1 \|\| Boolean\(msg\.selectedClarificationValue/,
      "Document type clarification selector must remain visible when selected"
    );
    assert.match(drawerSource, /isSelected \? 'Selected document:' : 'Select document type to continue:'/, "Must render confirmed document label once selected");
    assert.match(drawerSource, /selectedClarificationValue:\s*docType/, "handleInlineDocTypeSelect must store docType on message");

    // Schedule event persists
    assert.match(
      drawerSource,
      /msg\.clarificationType === 'SCHEDULE_EVENT' && revealingMessageId !== msg\.id && \(idx === messages\.length - 1 \|\| Boolean\(msg\.selectedClarificationValue/,
      "Schedule event clarification selector must remain visible when selected"
    );
    assert.match(drawerSource, /isSelected \? 'Selected event\/service:' : 'Select an event or service:'/, "Must render confirmed event label once selected");
    assert.match(drawerSource, /selectedClarificationValue:\s*eventType/, "handleInlineEventTypeSelect must store eventType on message");
  });

  await t.test("4. AnimatedAssistantMessage supports selectedClarificationValue and selectedLabel", () => {
    assert.match(animatedMsgSource, /msg\.selectedClarificationValue \? 'Selected parish:' : 'Select your parish to continue:'/, "AnimatedAssistantMessage must render confirmed parish label");
    assert.match(animatedMsgSource, /selectedLabel=\{msg\.selectedClarificationLabel\}/, "AnimatedAssistantMessage must pass selectedClarificationLabel");
  });

  await t.test("5. ChatMessage schema and storage validation preserves selected clarification metadata", () => {
    const messageWithParishSelection = {
      id: "msg-clarify-1",
      sender: "caloy",
      text: "Which parish are you referring to?",
      timestamp: "2026-09-14T08:41:00.000Z",
      clarificationType: "PARISH",
      responseType: "CLARIFICATION",
      selectedClarificationValue: 2,
      selectedClarificationLabel: "St. Joseph Parish",
      sources: [],
    };

    assert.equal(isValidChatMessage(messageWithParishSelection), true, "Message with parish selection metadata must be valid");

    const messageWithDocSelection = {
      id: "msg-clarify-2",
      sender: "caloy",
      text: "Select document type to continue:",
      timestamp: "2026-09-14T08:42:00.000Z",
      clarificationType: "DOCUMENT_TYPE",
      responseType: "CLARIFICATION",
      selectedClarificationValue: "BAPTISMAL_CERTIFICATE",
      selectedClarificationLabel: "Baptismal Certificate",
      sources: [],
    };

    assert.equal(isValidChatMessage(messageWithDocSelection), true, "Message with doc selection metadata must be valid");

    const parsed = parseCaloyMessages(JSON.stringify([messageWithParishSelection, messageWithDocSelection]));
    assert.ok(parsed, "Serialized messages with selected clarification must successfully parse");
    assert.equal(parsed[0].selectedClarificationValue, 2);
    assert.equal(parsed[0].selectedClarificationLabel, "St. Joseph Parish");
    assert.equal(parsed[1].selectedClarificationValue, "BAPTISMAL_CERTIFICATE");
  });
});
