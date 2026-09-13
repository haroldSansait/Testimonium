import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo, Text, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import {
  normalizeConversationContext,
  normalizeSelectedParishId,
  normalizeStructuredClarification,
  sendCaloyQuery,
} from "@/features/caloy/api/caloyApi";
import {
  clearAllCaloyStorage,
  clearCaloyStorage,
  generateSessionId,
  getCaloyStorageKey,
  isValidUuid,
  loadCaloyState,
  saveCaloyState,
} from "@/features/caloy/caloyStorage";
import { CaloyClarification } from "@/features/caloy/components/CaloyClarification";
import { CaloyLiveBadge } from "@/features/caloy/components/CaloyLiveBadge";
import { CaloyMarkdown } from "@/features/caloy/components/CaloyMarkdown";
import { CaloyMessageBubble } from "@/features/caloy/components/CaloyMessageBubble";
import { CaloyVerifiedSources } from "@/features/caloy/components/CaloyVerifiedSources";
import type { CaloyMessage, CaloySource } from "@/features/caloy/types";
import { apiClient } from "@/services/api/client";
import { AppError } from "@/services/api/errors";

const VALID_UUID_1 = "12345678-1234-4234-8234-123456789abc";
const VALID_UUID_2 = "87654321-4321-4321-9321-cba987654321";

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe("Caloy Mobile - UUID & Session Identifier", () => {
  it("generates a valid RFC 4122 UUID matching the backend regex", () => {
    const id = generateSessionId();
    expect(isValidUuid(id)).toBe(true);
  });

  it("identifies valid vs invalid session identifiers", () => {
    expect(isValidUuid(VALID_UUID_1)).toBe(true);
    expect(isValidUuid("mob_1726202400000_abc123")).toBe(false);
    expect(isValidUuid("session_123")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid("[object Object]")).toBe(false);
  });
});

describe("Caloy Mobile - Storage & UID Isolation (v2)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it("namespaces storage key strictly by authenticated Firebase UID and returns null for anonymous", () => {
    expect(getCaloyStorageKey("user_abc123")).toBe("testimonium_caloy_context_v2:user_abc123");
    expect(getCaloyStorageKey("user_xyz789")).toBe("testimonium_caloy_context_v2:user_xyz789");
    expect(getCaloyStorageKey(null)).toBeNull();
    expect(getCaloyStorageKey(undefined)).toBeNull();
    expect(getCaloyStorageKey("   ")).toBeNull();
  });

  it("persists and restores safe session context correctly for a specific UID with valid UUID", async () => {
    await saveCaloyState("uid_1", {
      sessionId: VALID_UUID_1,
      selectedParishId: 4,
      selectedParishName: "St. Joseph Parish",
      conversationContext: { lastIntent: "GET_DOCUMENT_FEE" },
    });

    const loaded = await loadCaloyState("uid_1");
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(2);
    expect(loaded?.sessionId).toBe(VALID_UUID_1);
    expect(loaded?.selectedParishId).toBe(4);
    expect(loaded?.selectedParishName).toBe("St. Joseph Parish");
    expect(loaded?.conversationContext).toEqual({ lastIntent: "GET_DOCUMENT_FEE" });

    // Assert raw AsyncStorage payload contains NO messages array
    const rawStored = await AsyncStorage.getItem("testimonium_caloy_context_v2:uid_1");
    expect(rawStored).not.toBeNull();
    const parsedRaw = JSON.parse(rawStored!);
    expect(parsedRaw.messages).toBeUndefined();
    expect(parsedRaw.version).toBe(2);
  });

  it("discards malformed or non-UUID stored sessionId on restore", async () => {
    // Write corrupted legacy state with mob_ prefix
    await AsyncStorage.setItem(
      "testimonium_caloy_context_v2:uid_malformed",
      JSON.stringify({
        version: 2,
        sessionId: "mob_1726202400000_abc123",
        selectedParishId: null,
      })
    );

    const loaded = await loadCaloyState("uid_malformed");
    expect(loaded).toBeNull();

    // Key should have been cleaned up
    const remaining = await AsyncStorage.getItem("testimonium_caloy_context_v2:uid_malformed");
    expect(remaining).toBeNull();
  });

  it("discards malformed stored selectedParishId (e.g. 0 or string) on restore", async () => {
    await AsyncStorage.setItem(
      "testimonium_caloy_context_v2:uid_bad_parish",
      JSON.stringify({
        version: 2,
        sessionId: VALID_UUID_1,
        selectedParishId: 0,
      })
    );

    const loaded = await loadCaloyState("uid_bad_parish");
    expect(loaded).toBeNull();
  });

  it("sanitizes sessionId when saving, replacing non-UUID with freshly generated valid UUID", async () => {
    await saveCaloyState("uid_fix", {
      sessionId: "corrupt_non_uuid",
      selectedParishId: null,
    });

    const loaded = await loadCaloyState("uid_fix");
    expect(loaded).not.toBeNull();
    expect(isValidUuid(loaded?.sessionId)).toBe(true);
    expect(loaded?.sessionId).not.toBe("corrupt_non_uuid");
  });

  it("refuses to persist state for null or anonymous UID", async () => {
    await saveCaloyState(null, { sessionId: VALID_UUID_1 });
    await saveCaloyState("", { sessionId: VALID_UUID_2 });

    const allKeys = await AsyncStorage.getAllKeys();
    expect(allKeys).toHaveLength(0);
  });

  it("enforces strict isolation between different authenticated UIDs", async () => {
    await saveCaloyState("uid_userA", {
      sessionId: VALID_UUID_1,
      selectedParishId: 1,
    });

    await saveCaloyState("uid_userB", {
      sessionId: VALID_UUID_2,
      selectedParishId: 2,
    });

    const userAState = await loadCaloyState("uid_userA");
    const userBState = await loadCaloyState("uid_userB");

    expect(userAState?.sessionId).toBe(VALID_UUID_1);
    expect(userAState?.selectedParishId).toBe(1);
    expect(userBState?.sessionId).toBe(VALID_UUID_2);
    expect(userBState?.selectedParishId).toBe(2);
  });

  it("clears storage for a specific UID without affecting other users", async () => {
    await saveCaloyState("uid_stay", {
      sessionId: VALID_UUID_1,
    });
    await saveCaloyState("uid_delete", {
      sessionId: VALID_UUID_2,
    });

    await clearCaloyStorage("uid_delete");

    expect(await loadCaloyState("uid_delete")).toBeNull();
    const retained = await loadCaloyState("uid_stay");
    expect(retained?.sessionId).toBe(VALID_UUID_1);
  });

  it("clearAllCaloyStorage removes all keys across all caloy versions", async () => {
    await saveCaloyState("uid_1", { sessionId: VALID_UUID_1 });
    await saveCaloyState("uid_2", { sessionId: VALID_UUID_2 });
    await AsyncStorage.setItem("testimonium_caloy_context_v1:legacy_user", JSON.stringify({ legacy: true }));
    await AsyncStorage.setItem("unrelated_key", "important_data");

    await clearAllCaloyStorage();

    expect(await loadCaloyState("uid_1")).toBeNull();
    expect(await loadCaloyState("uid_2")).toBeNull();
    expect(await AsyncStorage.getItem("testimonium_caloy_context_v1:legacy_user")).toBeNull();
    expect(await AsyncStorage.getItem("unrelated_key")).toBe("important_data");
  });
});

describe("Caloy Mobile - Normalization Boundaries & Backend Contract", () => {
  describe("normalizeSelectedParishId", () => {
    it("maps All Parishes / null / undefined / 0 / strings to null", () => {
      expect(normalizeSelectedParishId(null)).toBeNull();
      expect(normalizeSelectedParishId(undefined)).toBeNull();
      expect(normalizeSelectedParishId(0)).toBeNull();
      expect(normalizeSelectedParishId(-1)).toBeNull();
      expect(normalizeSelectedParishId("all")).toBeNull();
      expect(normalizeSelectedParishId("ALL")).toBeNull();
      expect(normalizeSelectedParishId("diocese")).toBeNull();
      expect(normalizeSelectedParishId(NaN)).toBeNull();
    });

    it("accepts valid positive integer parish IDs", () => {
      expect(normalizeSelectedParishId(1)).toBe(1);
      expect(normalizeSelectedParishId(42)).toBe(42);
      expect(normalizeSelectedParishId("5")).toBe(5);
    });
  });

  describe("normalizeStructuredClarification", () => {
    it("strips client-only fields and keeps only backend-approved fields", () => {
      const clientClarification = {
        id: "client_temp_1",
        toolId: "lookupRequirements",
        originalIntent: "GET_DOC_REQUIREMENTS",
        originalQuestion: "What do I need for baptism?",
        clarificationType: "PARISH",
        clarificationOptions: [{ label: "Parish 1", value: "1" }],
        selectedValue: "1",
        isButtonSelection: true,
        collected: { docType: "BAPTISM" },
        missing: "parishId",
        nextRequired: "parishId",
      };

      const normalized = normalizeStructuredClarification(clientClarification);
      expect(normalized).toEqual({
        toolId: "lookupRequirements",
        originalIntent: "GET_DOC_REQUIREMENTS",
        originalQuestion: "What do I need for baptism?",
        collected: { docType: "BAPTISM" },
        missing: "parishId",
        nextRequired: "parishId",
      });

      // Verify client-only fields are stripped
      expect(normalized?.id).toBeUndefined();
      expect(normalized?.clarificationType).toBeUndefined();
      expect(normalized?.clarificationOptions).toBeUndefined();
      expect(normalized?.selectedValue).toBeUndefined();
      expect(normalized?.isButtonSelection).toBeUndefined();
    });

    it("returns null for non-object, empty, or undefined input", () => {
      expect(normalizeStructuredClarification(null)).toBeNull();
      expect(normalizeStructuredClarification(undefined)).toBeNull();
      expect(normalizeStructuredClarification({})).toBeNull();
      expect(normalizeStructuredClarification("string")).toBeNull();
    });
  });

  describe("normalizeConversationContext", () => {
    it("keeps only backend-allowed conversationContext fields", () => {
      const input = {
        lastIntent: "DOC_INQUIRY",
        lastParishId: 3,
        lastParishName: "San Carlos",
        lastDocumentType: "BAPTISMAL_CERTIFICATE",
        lastScheduleEvent: null,
        lastDatePhrase: null,
        lastResponseType: "LIVE_DATA",
        extraClientData: "should_be_stripped",
        temporaryUIState: 123,
      };

      const normalized = normalizeConversationContext(input);
      expect(normalized).toEqual({
        lastIntent: "DOC_INQUIRY",
        lastParishId: 3,
        lastParishName: "San Carlos",
        lastDocumentType: "BAPTISMAL_CERTIFICATE",
        lastScheduleEvent: null,
        lastDatePhrase: null,
        lastResponseType: "LIVE_DATA",
      });
      expect(normalized?.extraClientData).toBeUndefined();
      expect(normalized?.temporaryUIState).toBeUndefined();
    });

    it("rejects non-positive lastParishId in conversationContext", () => {
      const input = {
        lastIntent: "TEST",
        lastParishId: 0,
      };
      const normalized = normalizeConversationContext(input);
      expect(normalized?.lastParishId).toBeUndefined();
      expect(normalized?.lastIntent).toBe("TEST");
    });
  });
});

describe("Caloy Mobile - API Client & Auth Boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends question with All-Parishes context as selectedParishId: null", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      answer: "Welcome to TESTIMONIUM. We serve the entire diocese.",
      fallback: false,
      responseType: "SOCIAL",
      sessionId: VALID_UUID_1,
      sources: [],
    });

    await sendCaloyQuery({
      question: "Hello caloy",
      sessionId: VALID_UUID_1,
      selectedParishId: null,
    });

    expect(apiClient.request).toHaveBeenCalledTimes(1);
    const callArg = (apiClient.request as jest.Mock).mock.calls[0][0];

    expect(callArg.path).toBe("/chatbot/query");
    expect(callArg.method).toBe("POST");
    expect(callArg.auth).toBe(true);
    expect(callArg.timeout).toBe(32_000);
    expect(callArg.body.question).toBe("Hello caloy");
    expect(callArg.body.sessionId).toBe(VALID_UUID_1);
    expect(callArg.body.selectedParishId).toBeNull();
    expect(callArg.body.userId).toBeUndefined();
  });

  it("sends question with specific real parish as positive integer", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      answer: "The fee for Marriage Banns is ₱200.00.",
      fallback: false,
      responseType: "LIVE_DATA",
      sessionId: VALID_UUID_1,
      sources: [],
    });

    const res = await sendCaloyQuery({
      question: "Magkano ang Marriage Banns?",
      sessionId: VALID_UUID_1,
      selectedParishId: 2,
    });

    expect(apiClient.request).toHaveBeenCalledTimes(1);
    const callArg = (apiClient.request as jest.Mock).mock.calls[0][0];

    expect(callArg.body.question).toBe("Magkano ang Marriage Banns?");
    expect(callArg.body.sessionId).toBe(VALID_UUID_1);
    expect(callArg.body.selectedParishId).toBe(2);
    expect(res.answer).toBe("The fee for Marriage Banns is ₱200.00.");
  });

  it("omits stale structuredClarification on fresh normal questions", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      answer: "Here are the parishes in the diocese.",
      fallback: false,
      responseType: "LIVE_DATA",
      sessionId: VALID_UUID_1,
      sources: [],
    });

    await sendCaloyQuery({
      question: "What are the parishes here",
      sessionId: VALID_UUID_1,
      selectedParishId: null,
      structuredClarification: null,
    });

    const callArg = (apiClient.request as jest.Mock).mock.calls[0][0];
    expect(callArg.body.structuredClarification).toBeUndefined();
  });

  it("maps 400 validation failure to clean user-facing copy without leaking internal errors", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "VALIDATION",
        status: 400,
        message: "Validation failed.",
        validationErrors: [{ field: "sessionId", message: "Session ID must be a valid UUID" }],
      })
    );

    await expect(
      sendCaloyQuery({
        question: "Hello caloy",
        sessionId: VALID_UUID_1,
      })
    ).rejects.toThrow("Caloy couldn't send that question. Please try again.");
  });

  it("maps 401 session expiration to sign in instruction", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "AUTH",
        status: 401,
        message: "Your session has expired. Please sign in again.",
      })
    );

    await expect(
      sendCaloyQuery({
        question: "Hello",
        sessionId: VALID_UUID_1,
      })
    ).rejects.toThrow("Your session has expired. Please sign in again to continue chatting with Caloy.");
  });

  it("handles CHATBOT_AI_LIMIT_REACHED distinguishing short-window vs daily limit", async () => {
    // Short-window
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "RATE_LIMIT",
        code: "CHATBOT_AI_LIMIT_REACHED",
        message: "You've reached Caloy's AI question limit for now. Please try again in a few minutes.",
      })
    );

    await expect(sendCaloyQuery({ question: "Hello", sessionId: VALID_UUID_1 })).rejects.toThrow(
      "You have reached your question limit for now. Please try again in a few minutes"
    );

    // Daily
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "RATE_LIMIT",
        code: "CHATBOT_AI_LIMIT_REACHED",
        message: "You've reached Caloy's daily AI question limit. Please try again tomorrow.",
      })
    );

    await expect(sendCaloyQuery({ question: "Hello", sessionId: VALID_UUID_1 })).rejects.toThrow(
      "You have reached your daily substantive question limit for Caloy. Please try again tomorrow"
    );
  });

  it("handles RATE_LIMITED with cooldown instruction", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "RATE_LIMIT",
        code: "RATE_LIMITED",
        message: "Too fast",
      })
    );

    await expect(sendCaloyQuery({ question: "Hello", sessionId: VALID_UUID_1 })).rejects.toThrow(
      "Caloy is receiving many requests. Please wait a moment"
    );
  });

  it("handles CHATBOT_UNAVAILABLE or 503 with friendly unavailable copy", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "SERVER",
        status: 503,
        code: "CHATBOT_UNAVAILABLE",
        message: "Caloy is currently unavailable.",
      })
    );

    await expect(sendCaloyQuery({ question: "Hello", sessionId: VALID_UUID_1 })).rejects.toThrow(
      "Caloy is temporarily unavailable. Please try again later or contact your parish office."
    );
  });

  it("handles network connection failures cleanly", async () => {
    (apiClient.request as jest.Mock).mockRejectedValueOnce(
      new AppError({
        kind: "NETWORK",
        code: "NETWORK_ERROR",
        message: "Network unreachable",
      })
    );

    await expect(sendCaloyQuery({ question: "Hello", sessionId: VALID_UUID_1 })).rejects.toThrow(
      "Unable to connect to Caloy. Please check your internet connection."
    );
  });
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("Caloy Mobile - UI Components", () => {
  it("renders CaloyLiveBadge with Current TESTIMONIUM Data label", async () => {
    const { findByText } = await render(<CaloyLiveBadge />);
    expect(await findByText("Current TESTIMONIUM Data")).toBeTruthy();
  });

  it("renders CaloyVerifiedSources as collapsible accordion and reveals sources on click", async () => {
    const mockSources: CaloySource[] = [
      {
        id: 1,
        title: "Diocesan Sacramental Guidelines 2024",
        authority: "Chancery Office",
        sourceReference: "Doc-Ref-42",
      },
    ];

    const { findByText, queryByText } = await render(
      <CaloyVerifiedSources sources={mockSources} />
    );

    // Header visible
    const header = await findByText("Verified Sources (1)");
    expect(header).toBeTruthy();
    // Sources content hidden initially
    expect(queryByText("Diocesan Sacramental Guidelines 2024")).toBeNull();

    // Toggle open
    fireEvent.press(header);
    expect(await findByText("Diocesan Sacramental Guidelines 2024")).toBeTruthy();
    expect(await findByText("Authority: Chancery Office")).toBeTruthy();
    expect(await findByText("Ref: Doc-Ref-42")).toBeTruthy();
  });

  it("renders CaloyClarification chips and fires onSelectOption when clicked", async () => {
    const onSelect = jest.fn();
    const { findByText } = await render(
      <CaloyClarification
        clarification={{
          clarificationType: "PARISH",
          clarificationOptions: [
            { label: "St. Joseph Parish", value: "st_joseph" },
            { label: "San Carlos Borromeo Cathedral", value: "cathedral" },
          ],
        }}
        onSelectOption={onSelect}
      />
    );

    expect(await findByText("Select a parish:")).toBeTruthy();
    const chip = await findByText("St. Joseph Parish");
    expect(chip).toBeTruthy();
    expect(await findByText("San Carlos Borromeo Cathedral")).toBeTruthy();

    fireEvent.press(chip);
    expect(onSelect).toHaveBeenCalledWith({
      label: "St. Joseph Parish",
      value: "st_joseph",
    });
  });

  it("renders backend options for SCHEDULE_EVENT without client-side static lists and submits canonical value", async () => {
    const onSelect = jest.fn();
    const backendOptions = [
      { label: "Wake Mass", value: "WAKE_MASS" },
      { label: "Marriage (Special)", value: "MARRIAGE_SPECIAL" },
    ];

    const { findByText, queryByText } = await render(
      <CaloyClarification
        clarification={{
          clarificationType: "SCHEDULE_EVENT",
          clarificationOptions: backendOptions,
        }}
        onSelectOption={onSelect}
      />
    );

    // Verify header label is "Select an event or service:"
    expect(await findByText("Select an event or service:")).toBeTruthy();

    // Verify backend options are rendered
    const wakeMassChip = await findByText("Wake Mass");
    expect(wakeMassChip).toBeTruthy();
    expect(await findByText("Marriage (Special)")).toBeTruthy();

    // Verify disabled/unsupported options are NOT rendered
    expect(queryByText("Wedding")).toBeNull();
    expect(queryByText("Mass Intention")).toBeNull();

    // Click chip and verify canonical value is submitted
    fireEvent.press(wakeMassChip);
    expect(onSelect).toHaveBeenCalledWith({
      label: "Wake Mass",
      value: "WAKE_MASS",
    });
  });

  it("renders CaloyMarkdown correctly with bold, italics, and lists", async () => {
    const markdown = "Here is **bold text** and `code`:\n- Item 1\n- Item 2";
    const { findByText } = await render(<CaloyMarkdown content={markdown} />);

    expect(await findByText("bold text")).toBeTruthy();
    expect(await findByText("code")).toBeTruthy();
    expect(await findByText("Item 1")).toBeTruthy();
    expect(await findByText("Item 2")).toBeTruthy();
  });

  it("renders user bubble vs assistant bubble distinctively", async () => {
    const userMsg: CaloyMessage = {
      id: "u1",
      sender: "user",
      text: "What are the requirements for Baptism?",
      timestamp: 1700000000,
    };

    const assistantMsg: CaloyMessage = {
      id: "c1",
      sender: "caloy",
      text: "The requirements for Baptism are birth certificate and parish permission.",
      timestamp: 1700000010,
      responseType: "LIVE_DATA",
      liveData: { label: "Current TESTIMONIUM Data" },
    };

    const { findByText } = await render(
      <>
        <CaloyMessageBubble message={userMsg} />
        <CaloyMessageBubble message={assistantMsg} />
      </>
    );

    expect(await findByText("What are the requirements for Baptism?")).toBeTruthy();
    expect(
      await findByText("The requirements for Baptism are birth certificate and parish permission.")
    ).toBeTruthy();
    expect(await findByText("Caloy")).toBeTruthy();
    expect(await findByText("Current TESTIMONIUM Data")).toBeTruthy();
  });

  it("confirms reveal completion does not update parent state during child render and fires exactly once", async () => {
    jest.useFakeTimers();
    try {
      const completionSpy = jest.fn();

      function ParentComponent() {
        const [status, setStatus] = React.useState("revealing");

        return (
          <View>
            <Text testID="parent-status">{status}</Text>
            <CaloyMessageBubble
              message={{
                id: "msg_reveal_test",
                sender: "caloy",
                text: "Parish registration requirements.",
                timestamp: Date.now(),
                isRevealing: true,
              }}
              onRevealComplete={(id) => {
                completionSpy(id);
                setStatus("done");
              }}
            />
          </View>
        );
      }

      const screen = await render(<ParentComponent />);

      // On initial render, parent has not been updated during child render
      expect(await screen.findByText("revealing")).toBeTruthy();
      expect(completionSpy).not.toHaveBeenCalled();

      // Fast forward interval to complete character reveal
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Post-commit effect safely updated parent state without render-phase side effects
      expect(await screen.findByText("done")).toBeTruthy();
      expect(completionSpy).toHaveBeenCalledTimes(1);
      expect(completionSpy).toHaveBeenCalledWith("msg_reveal_test");

      // Further timer advances do NOT fire again
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(completionSpy).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("fires reveal completion post-commit exactly once when reduceMotion is enabled without render-phase side effects", async () => {
    const isReduceMotionSpy = jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    try {
      const completionSpy = jest.fn();

      function ParentWithReduceMotion() {
        const [parentStatus, setParentStatus] = React.useState("initial");

        return (
          <View>
            <Text testID="parent-status">{parentStatus}</Text>
            <CaloyMessageBubble
              message={{
                id: "msg_reduce_motion",
                sender: "caloy",
                text: "Reduced motion message.",
                timestamp: Date.now(),
                isRevealing: true,
              }}
              onRevealComplete={(id) => {
                completionSpy(id);
                setParentStatus("finished");
              }}
            />
          </View>
        );
      }

      const screen = await render(<ParentWithReduceMotion />);

      // Wait for AccessibilityInfo promise resolution and post-commit effect
      await act(async () => {
        await Promise.resolve();
      });

      expect(await screen.findByText("finished")).toBeTruthy();
      expect(completionSpy).toHaveBeenCalledTimes(1);
      expect(completionSpy).toHaveBeenCalledWith("msg_reduce_motion");
    } finally {
      isReduceMotionSpy.mockRestore();
    }
  });
});
