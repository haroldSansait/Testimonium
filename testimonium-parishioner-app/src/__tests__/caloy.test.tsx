import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render } from "@testing-library/react-native";
import { sendCaloyQuery } from "@/features/caloy/api/caloyApi";
import {
  clearAllCaloyStorage,
  clearCaloyStorage,
  getCaloyStorageKey,
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

jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

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

  it("persists and restores safe session context correctly for a specific UID (Privacy M-04: no messages in storage)", async () => {
    await saveCaloyState("uid_1", {
      sessionId: "session_123",
      selectedParishId: 4,
      selectedParishName: "St. Joseph Parish",
      conversationContext: { lastIntent: "GET_DOCUMENT_FEE" },
    });

    const loaded = await loadCaloyState("uid_1");
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(2);
    expect(loaded?.sessionId).toBe("session_123");
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

  it("refuses to persist state for null or anonymous UID", async () => {
    await saveCaloyState(null, { sessionId: "session_anon" });
    await saveCaloyState("", { sessionId: "session_empty" });

    const allKeys = await AsyncStorage.getAllKeys();
    expect(allKeys).toHaveLength(0);
  });

  it("enforces strict isolation between different authenticated UIDs", async () => {
    await saveCaloyState("uid_userA", {
      sessionId: "session_A",
      selectedParishId: 1,
    });

    await saveCaloyState("uid_userB", {
      sessionId: "session_B",
      selectedParishId: 2,
    });

    const userAState = await loadCaloyState("uid_userA");
    const userBState = await loadCaloyState("uid_userB");

    expect(userAState?.sessionId).toBe("session_A");
    expect(userAState?.selectedParishId).toBe(1);
    expect(userBState?.sessionId).toBe("session_B");
    expect(userBState?.selectedParishId).toBe(2);
  });

  it("clears storage for a specific UID without affecting other users", async () => {
    await saveCaloyState("uid_stay", {
      sessionId: "session_stay",
    });
    await saveCaloyState("uid_delete", {
      sessionId: "session_del",
    });

    await clearCaloyStorage("uid_delete");

    expect(await loadCaloyState("uid_delete")).toBeNull();
    const retained = await loadCaloyState("uid_stay");
    expect(retained?.sessionId).toBe("session_stay");
  });

  it("clearAllCaloyStorage removes all keys across all caloy versions", async () => {
    await saveCaloyState("uid_1", { sessionId: "s1" });
    await saveCaloyState("uid_2", { sessionId: "s2" });
    await AsyncStorage.setItem("testimonium_caloy_context_v1:legacy_user", JSON.stringify({ legacy: true }));
    await AsyncStorage.setItem("unrelated_key", "important_data");

    await clearAllCaloyStorage();

    expect(await loadCaloyState("uid_1")).toBeNull();
    expect(await loadCaloyState("uid_2")).toBeNull();
    expect(await AsyncStorage.getItem("testimonium_caloy_context_v1:legacy_user")).toBeNull();
    expect(await AsyncStorage.getItem("unrelated_key")).toBe("important_data");
  });
});

describe("Caloy Mobile - API Client & Auth Boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends query to /chatbot/query with auth: true and NO userId in payload", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      answer: "The fee for Marriage Banns is ₱200.00.",
      fallback: false,
      responseType: "LIVE_DATA",
      sessionId: "session_abc",
      sources: [],
    });

    const res = await sendCaloyQuery({
      question: "Magkano ang Marriage Banns?",
      sessionId: "session_abc",
      selectedParishId: 2,
    });

    expect(apiClient.request).toHaveBeenCalledTimes(1);
    const callArg = (apiClient.request as jest.Mock).mock.calls[0][0];

    expect(callArg.path).toBe("/chatbot/query");
    expect(callArg.method).toBe("POST");
    expect(callArg.auth).toBe(true);
    expect(callArg.timeout).toBe(32_000);
    expect(callArg.body.question).toBe("Magkano ang Marriage Banns?");
    expect(callArg.body.sessionId).toBe("session_abc");
    expect(callArg.body.selectedParishId).toBe(2);
    // Verify userId is NEVER in the body (backend extracts from verified Firebase token)
    expect(callArg.body.userId).toBeUndefined();
    expect(res.answer).toBe("The fee for Marriage Banns is ₱200.00.");
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

    await expect(sendCaloyQuery({ question: "Hello" })).rejects.toThrow(
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

    await expect(sendCaloyQuery({ question: "Hello" })).rejects.toThrow(
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

    await expect(sendCaloyQuery({ question: "Hello" })).rejects.toThrow(
      "Caloy is receiving many requests. Please wait a moment"
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

    await expect(sendCaloyQuery({ question: "Hello" })).rejects.toThrow(
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
});
