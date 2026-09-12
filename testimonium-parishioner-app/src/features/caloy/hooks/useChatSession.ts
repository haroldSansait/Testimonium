import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { sendCaloyQuery } from "../api/caloyApi";
import { clearCaloyStorage, loadCaloyState, saveCaloyState } from "../caloyStorage";
import type {
  CaloyClarificationData,
  CaloyClarificationOption,
  CaloyMessage,
} from "../types";

const STATIC_WELCOME_MESSAGE: CaloyMessage = {
  id: "welcome_initial",
  sender: "caloy",
  text: "Hello! I am Caloy, your TESTIMONIUM virtual assistant. How can I help you today with parish information, documents, or schedules?",
  timestamp: Date.now(),
  responseType: "SOCIAL",
  isRevealing: false,
};

function generateSessionId(): string {
  return `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatSession() {
  const { user } = useAuth();
  const currentUid = user?.uid ?? null;

  const [messages, setMessages] = useState<CaloyMessage[]>([STATIC_WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const [selectedParishId, setSelectedParishId] = useState<number | null>(null);
  const [selectedParishName, setSelectedParishName] = useState<string | null>(null);
  const [conversationContext, setConversationContext] = useState<Record<string, unknown> | null>(null);
  const [structuredClarification, setStructuredClarification] = useState<CaloyClarificationData | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isRestored, setIsRestored] = useState<boolean>(false);
  const [restoredUid, setRestoredUid] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUidRef = useRef<string | null>(currentUid);
  const restoredUidRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const requestGenerationRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Synchronous UID transition and restore effect
  useEffect(() => {
    // Immediate synchronous reset on UID change to prevent Account A's state from flashing for B
    if (activeUidRef.current !== currentUid) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
      requestGenerationRef.current += 1;

      setMessages([STATIC_WELCOME_MESSAGE]);
      setSessionId(generateSessionId());
      setSelectedParishId(null);
      setSelectedParishName(null);
      setConversationContext(null);
      setStructuredClarification(null);
      setIsTyping(false);
      setIsRestored(false);
      setRestoredUid(null);
      restoredUidRef.current = null;
    }

    activeUidRef.current = currentUid;
    let isCancelled = false;

    async function restore() {
      // If unauthenticated or anonymous, do NOT load private Caloy persistence
      if (!currentUid) {
        setMessages([STATIC_WELCOME_MESSAGE]);
        setSessionId(generateSessionId());
        setSelectedParishId(null);
        setSelectedParishName(null);
        setConversationContext(null);
        setStructuredClarification(null);
        setRestoredUid(null);
        restoredUidRef.current = null;
        setIsRestored(true);
        return;
      }

      setIsRestored(false);
      const saved = await loadCaloyState(currentUid);
      if (isCancelled || activeUidRef.current !== currentUid) return;

      if (saved) {
        setSessionId(saved.sessionId || generateSessionId());
        setSelectedParishId(saved.selectedParishId ?? null);
        setSelectedParishName(saved.selectedParishName ?? null);
        setConversationContext(saved.conversationContext ?? null);
        setStructuredClarification(saved.structuredClarification ?? null);
      } else {
        setSessionId(generateSessionId());
        setSelectedParishId(null);
        setSelectedParishName(null);
        setConversationContext(null);
        setStructuredClarification(null);
      }

      // Memory-only message history for fresh session (Privacy M-04)
      setMessages([STATIC_WELCOME_MESSAGE]);
      setRestoredUid(currentUid);
      restoredUidRef.current = currentUid;
      setIsRestored(true);
    }

    void restore();

    return () => {
      isCancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [currentUid]);

  // Persist session context when context or parish changes (NO messages persisted, M-04)
  useEffect(() => {
    // Strict isolation check: persistence allowed only when restoredUid matches currentUid
    if (!isRestored || !currentUid) return;
    if (restoredUidRef.current !== currentUid || activeUidRef.current !== currentUid) return;

    const stateToSave = {
      sessionId,
      selectedParishId,
      selectedParishName,
      conversationContext,
      structuredClarification,
    };

    void saveCaloyState(currentUid, stateToSave);
  }, [sessionId, selectedParishId, selectedParishName, conversationContext, structuredClarification, isRestored, currentUid, restoredUid]);

  const handleRevealComplete = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isRevealing: false } : m))
    );
  }, []);

  const sendMessage = useCallback(
    async (text: string, customClarification?: CaloyClarificationData | null) => {
      const trimmed = text.trim();
      // Immediate synchronous in-flight guard (M-05)
      if (!trimmed || inFlightRef.current || isTyping) return;

      inFlightRef.current = true;
      setIsTyping(true);

      const reqGen = ++requestGenerationRef.current;
      const reqUid = activeUidRef.current;

      // Maintain one authoritative request AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessageId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const userMessage: CaloyMessage = {
        id: userMessageId,
        sender: "user",
        text: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await sendCaloyQuery(
          {
            question: trimmed,
            sessionId,
            selectedParishId,
            structuredClarification: customClarification !== undefined ? customClarification : structuredClarification,
            conversationContext,
          },
          controller.signal
        );

        // Discard stale responses if UID changed, request aborted, or newer generation supersedes
        if (
          activeUidRef.current !== reqUid ||
          activeUidRef.current !== currentUid ||
          requestGenerationRef.current !== reqGen ||
          controller.signal.aborted
        ) {
          return;
        }

        const caloyMessageId = `caloy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const caloyMessage: CaloyMessage = {
          id: caloyMessageId,
          sender: "caloy",
          text: response.answer,
          timestamp: Date.now(),
          responseType: response.responseType,
          sources: response.sources,
          liveData: response.liveData,
          structuredClarification: response.structuredClarification,
          isRevealing: true,
        };

        if (response.sessionId) {
          setSessionId(response.sessionId);
        }

        if (response.conversationContext) {
          setConversationContext(response.conversationContext);
        }

        setStructuredClarification(response.structuredClarification || null);
        setMessages((prev) => [...prev, caloyMessage]);
      } catch (err: unknown) {
        // Discard error state updates if cancelled or stale
        if (
          activeUidRef.current !== reqUid ||
          activeUidRef.current !== currentUid ||
          requestGenerationRef.current !== reqGen ||
          controller.signal.aborted
        ) {
          return;
        }

        const errorMessage =
          err && typeof err === "object" && "message" in err
            ? String((err as any).message)
            : "I am having trouble answering right now. Please try again in a moment.";

        const errorBubble: CaloyMessage = {
          id: `caloy_err_${Date.now()}`,
          sender: "caloy",
          text: errorMessage,
          timestamp: Date.now(),
          responseType: "FALLBACK",
          isError: true,
          isRevealing: false,
        };

        setMessages((prev) => [...prev, errorBubble]);
      } finally {
        if (requestGenerationRef.current === reqGen) {
          inFlightRef.current = false;
          abortControllerRef.current = null;
          if (isMountedRef.current && !controller.signal.aborted) {
            setIsTyping(false);
          }
        }
      }
    },
    [isTyping, sessionId, selectedParishId, structuredClarification, conversationContext, currentUid]
  );

  const selectClarificationOption = useCallback(
    (option: CaloyClarificationOption) => {
      if (!structuredClarification) return;

      const missingParam = structuredClarification.missing || structuredClarification.nextRequired || "choice";
      const updatedCollected = {
        ...(structuredClarification.collected || {}),
        [missingParam]: option.value,
        ...(missingParam === "eventType" ? { scheduleEvent: option.value } : {}),
      };

      const updatedClarification: CaloyClarificationData = {
        ...structuredClarification,
        isButtonSelection: true,
        selectedValue: option.value,
        collected: updatedCollected,
        nextRequired: undefined,
      };

      void sendMessage(option.label, updatedClarification);
    },
    [structuredClarification, sendMessage]
  );

  const clearChat = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    inFlightRef.current = false;
    requestGenerationRef.current += 1;

    if (currentUid) {
      await clearCaloyStorage(currentUid);
    }

    setMessages([
      {
        ...STATIC_WELCOME_MESSAGE,
        timestamp: Date.now(),
      },
    ]);
    setSessionId(generateSessionId());
    setConversationContext(null);
    setStructuredClarification(null);
  }, [currentUid]);

  const setParishContext = useCallback((parishId: number | null, parishName: string | null) => {
    setSelectedParishId(parishId);
    setSelectedParishName(parishName);
  }, []);

  return {
    messages,
    sessionId,
    selectedParishId,
    selectedParishName,
    conversationContext,
    structuredClarification,
    isTyping,
    isRestored,
    sendMessage,
    selectClarificationOption,
    clearChat,
    setParishContext,
    handleRevealComplete,
  };
}
