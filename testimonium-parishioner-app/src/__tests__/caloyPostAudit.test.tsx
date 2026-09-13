import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { normalizeCaloyResponse, sendCaloyQuery } from "@/features/caloy/api/caloyApi";
import {
  getCaloyStorageKey,
  loadCaloyState,
  saveCaloyState,
} from "@/features/caloy/caloyStorage";
import { CaloyMessageBubble } from "@/features/caloy/components/CaloyMessageBubble";
import { useChatSession } from "@/features/caloy/hooks/useChatSession";
import type { CaloyMessage, CaloyQueryResponse } from "@/features/caloy/types";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api/client";

// Mock dependencies
jest.mock("@/services/api/client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

jest.mock("@/providers/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("Caloy Mobile Post-Audit Corrections Suite (H-04, M-02, M-03, M-04, M-05, M-06)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (apiClient.request as jest.Mock).mockReset();
    (useAuth as jest.Mock).mockReset();
  });

  // =========================================================================
  const UUID_ALPHA = "11111111-1111-4111-8111-111111111111";

  // 1. PRIVACY & STORAGE MINIMAL SAFE STATE (M-04)
  // =========================================================================
  it("M-04: Full message history is NEVER stored in AsyncStorage (Privacy Guard)", async () => {
    // Save state through saveCaloyState
    await saveCaloyState("user_alpha", {
      sessionId: UUID_ALPHA,
      selectedParishId: 5,
      selectedParishName: "San Roque Parish",
      conversationContext: { lastIntent: "CHECK_MY_REQUEST_STATUS" },
    });

    const storageKey = getCaloyStorageKey("user_alpha")!;
    const rawStored = await AsyncStorage.getItem(storageKey);
    expect(rawStored).not.toBeNull();

    const parsed = JSON.parse(rawStored!);
    // Absolute privacy assertion: no messages array in storage
    expect(parsed.messages).toBeUndefined();
    expect(parsed.version).toBe(2);
    expect(parsed.sessionId).toBe(UUID_ALPHA);
    expect(parsed.selectedParishId).toBe(5);
    expect(parsed.selectedParishName).toBe("San Roque Parish");
  });

  // =========================================================================
  // 2. VERSIONED STORAGE RUNTIME VALIDATION (M-03)
  // =========================================================================
  it("M-03: Rejects malformed JSON, legacy v1 schemas, and corrupted records without crashing", async () => {
    // Legacy v1 schema (version missing or 1)
    await AsyncStorage.setItem(
      "testimonium_caloy_context_v2:user_corrupt1",
      JSON.stringify({
        version: 1,
        messages: [{ id: "m1", text: "Legacy message" }],
      })
    );

    const loadedLegacy = await loadCaloyState("user_corrupt1");
    expect(loadedLegacy).toBeNull();

    // Corrupted non-object / array payload
    await AsyncStorage.setItem("testimonium_caloy_context_v2:user_corrupt2", "[1, 2, 3]");
    const loadedArray = await loadCaloyState("user_corrupt2");
    expect(loadedArray).toBeNull();

    // Invalid sessionId type
    await AsyncStorage.setItem(
      "testimonium_caloy_context_v2:user_corrupt3",
      JSON.stringify({ version: 2, sessionId: 12345 })
    );
    const loadedInvalidId = await loadCaloyState("user_corrupt3");
    expect(loadedInvalidId).toBeNull();

    // Contains forbidden messages array
    await AsyncStorage.setItem(
      "testimonium_caloy_context_v2:user_corrupt4",
      JSON.stringify({
        version: 2,
        sessionId: "sess_ok",
        messages: [{ text: "leaked message" }],
      })
    );
    const loadedForbiddenMsg = await loadCaloyState("user_corrupt4");
    expect(loadedForbiddenMsg).toBeNull();
  });

  // =========================================================================
  // 3. REAL BACKEND CLARIFICATION DTO NORMALIZATION (M-02)
  // =========================================================================
  it("M-02: Normalizes real backend response DTO with top-level clarificationType and clarificationOptions", () => {
    // Real backend LiveToolRouter DTO response shape
    const backendResponse: CaloyQueryResponse = {
      answer: "Which document are you referring to?",
      fallback: false,
      fallbackReason: null,
      responseType: "CLARIFICATION",
      category: "CLARIFICATION",
      sessionId: "session_clarify",
      sources: [],
      clarificationType: "DOCUMENT_TYPE",
      clarificationOptions: [
        { label: "Baptismal Certificate", value: "BAPTISMAL_CERTIFICATE" },
        { label: "Marriage Banns", value: "MARRIAGE_BANNS" },
      ],
      structuredClarification: {
        originalQuestion: "requirements",
        originalIntent: "GET_DOCUMENT_REQUIREMENTS",
        toolId: "GET_DOCUMENT_REQUIREMENTS",
        collected: {},
        missing: "documentType",
        nextRequired: "documentType",
      },
    };

    const normalized = normalizeCaloyResponse(backendResponse);
    expect(normalized.structuredClarification?.clarificationType).toBe("DOCUMENT_TYPE");
    expect(normalized.structuredClarification?.clarificationOptions).toHaveLength(2);
    expect(normalized.structuredClarification?.clarificationOptions?.[0].label).toBe(
      "Baptismal Certificate"
    );
  });

  it("M-02: Renders clarification chips for real DTO shape in CaloyMessageBubble", async () => {
    const onSelect = jest.fn();

    // Backend message after DTO normalization
    const normalizedBubbleMessage: CaloyMessage = {
      id: "bubble_clarify",
      sender: "caloy",
      text: "Which parish are you inquiring about?",
      timestamp: Date.now(),
      responseType: "CLARIFICATION",
      isRevealing: false,
      structuredClarification: {
        clarificationType: "PARISH",
        clarificationOptions: [
          { label: "St. Joseph Parish", value: "1" },
          { label: "San Roque Parish", value: "2" },
        ],
      },
    };

    const { findByText } = await render(
      <CaloyMessageBubble
        message={normalizedBubbleMessage}
        onSelectClarificationOption={onSelect}
      />
    );

    expect(await findByText("Which parish are you inquiring about?")).toBeTruthy();
    expect(await findByText("Select a parish:")).toBeTruthy();

    const chip1 = await findByText("St. Joseph Parish");
    const chip2 = await findByText("San Roque Parish");
    expect(chip1).toBeTruthy();
    expect(chip2).toBeTruthy();

    fireEvent.press(chip1);
    expect(onSelect).toHaveBeenCalledWith({ label: "St. Joseph Parish", value: "1" });
  });

  // =========================================================================
  // 4. ACCOUNT A -> B TRANSITION & UID ISOLATION (H-04)
  // =========================================================================
  it("H-04: Direct transition from Account A to Account B immediately resets state and blocks leakage", async () => {
    const SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    // 1. Account A state in storage
    await saveCaloyState("user_A", {
      sessionId: SESSION_A,
      selectedParishId: 10,
      selectedParishName: "Parish A",
      conversationContext: { accountSecret: "secret_A" },
    });

    // 2. Account B state in storage
    await saveCaloyState("user_B", {
      sessionId: SESSION_B,
      selectedParishId: 20,
      selectedParishName: "Parish B",
      conversationContext: { accountSecret: "secret_B" },
    });

    // Start with User A
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user_A" } });
    const { result, rerender } = await renderHook(() => useChatSession());

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    expect(result.current.sessionId).toBe(SESSION_A);
    expect(result.current.selectedParishName).toBe("Parish A");

    // Transition directly to User B
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user_B" } });
    rerender({});

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
      expect(result.current.sessionId).toBe(SESSION_B);
    });

    expect(result.current.selectedParishName).toBe("Parish B");

    // Verify storage of User B was NOT overwritten with User A's data
    const userBStorage = await loadCaloyState("user_B");
    expect(userBStorage?.sessionId).toBe(SESSION_B);
    expect(userBStorage?.conversationContext).toEqual({ accountSecret: "secret_B" });
  });

  it("H-04: Null UID (logout or initial boot) cannot load or persist private Caloy state", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    const { result } = await renderHook(() => useChatSession());

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    expect(result.current.selectedParishId).toBeNull();
    expect(result.current.conversationContext).toBeNull();

    // Verify no AsyncStorage keys were created for anonymous/null
    const allKeys = await AsyncStorage.getAllKeys();
    const caloyKeys = allKeys.filter((k) => k.includes("caloy"));
    expect(caloyKeys).toHaveLength(0);
  });

  // =========================================================================
  // 5. SYNCHRONOUS IN-FLIGHT GUARD & CONCURRENCY (M-05)
  // =========================================================================
  it("M-05: Rapid double-tap send is synchronously guarded to prevent concurrent requests", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user_fast" } });

    let resolveRequest: (val: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });

    (apiClient.request as jest.Mock).mockImplementation(() => slowPromise);

    const { result } = await renderHook(() => useChatSession());

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    // Rapid double invocation synchronously guarded and cleanly resolved inside async act
    await act(async () => {
      const p1 = result.current.sendMessage("First tap");
      const p2 = result.current.sendMessage("Immediate double tap");

      // apiClient should only have been called ONCE due to synchronous inFlightRef guard
      expect(apiClient.request).toHaveBeenCalledTimes(1);

      resolveRequest!({
        answer: "First response",
        fallback: false,
        responseType: "SOCIAL",
        sessionId: "sess_fast",
        sources: [],
      });

      await Promise.all([p1, p2]);
    });

    await waitFor(() => {
      expect(result.current.isTyping).toBe(false);
    });
  });

  it("M-05: In-flight request is aborted on screen unmount or session/UID reset", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user_abort" } });

    let capturedSignal: AbortSignal | undefined;
    (apiClient.request as jest.Mock).mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise((_, reject) => {
        const onAbort = () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (signal?.aborted) {
          onAbort();
        } else {
          signal?.addEventListener("abort", onAbort, { once: true });
        }
      });
    });

    const { result } = await renderHook(() => useChatSession());

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    act(() => {
      void result.current.sendMessage("Check abort signal");
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Session reset / clearChat synchronously aborts active controller
    await act(async () => {
      await result.current.clearChat();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  // =========================================================================
  // 6. CLIENT TIMEOUT & PIPELINE COHERENCE (M-06)
  // =========================================================================
  it("M-06: Caloy requests strictly use 32-second client deadline aligned with backend", async () => {
    (apiClient.request as jest.Mock).mockResolvedValueOnce({
      answer: "Response",
      fallback: false,
      responseType: "SOCIAL",
      sessionId: "sess_t",
      sources: [],
    });

    await sendCaloyQuery({ question: "Timeout check" });

    const callArg = (apiClient.request as jest.Mock).mock.calls[0][0];
    expect(callArg.timeout).toBe(32_000);
    expect(callArg.timeout).toBeGreaterThan(25_000); // Backend deadline is 25_000ms
  });
});
