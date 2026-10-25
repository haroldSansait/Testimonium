import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CaloyPersistedState } from "./types";

const STORAGE_KEY_PREFIX_V2 = "testimonium_caloy_context_v2:";
const STORAGE_KEY_PREFIX_V1 = "testimonium_caloy_context_v1:";

/**
 * Returns the namespaced storage key for the authenticated Firebase UID.
 * Returns null if the UID is absent or anonymous; private Caloy state MUST NOT
 * persist for anonymous/unauthenticated users.
 */
export function getCaloyStorageKey(uid: string | null | undefined): string | null {
  if (!uid || typeof uid !== "string" || !uid.trim()) {
    return null;
  }
  return `${STORAGE_KEY_PREFIX_V2}${uid.trim()}`;
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that an unknown value is a well-formed RFC 4122 UUID.
 */
export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Generates an RFC 4122 v4 UUID without native module dependencies.
 */
export function generateSessionId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID === "function") {
      try {
        return globalThis.crypto.randomUUID();
      } catch {
        // Fallback to byte-level or pseudo-random generation
      }
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      try {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      } catch {
        // Fallback to pseudo-random generation
      }
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates the parsed storage object against the version 2 minimal safe schema.
 * Rejects malformed objects, unexpected types, or legacy v1 structures.
 */
function isValidPersistedState(data: unknown): data is CaloyPersistedState {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Schema version must be exactly 2
  if (obj.version !== 2) {
    return false;
  }

  // Session ID must be a valid RFC 4122 UUID matching backend schema
  if (!isValidUuid(obj.sessionId)) {
    return false;
  }

  // selectedParishId must be null or positive integer
  if (
    obj.selectedParishId !== null &&
    (typeof obj.selectedParishId !== "number" ||
      !Number.isInteger(obj.selectedParishId) ||
      obj.selectedParishId <= 0)
  ) {
    return false;
  }

  // selectedParishName must be null or string
  if (obj.selectedParishName !== null && typeof obj.selectedParishName !== "string") {
    return false;
  }

  // conversationContext must be null or plain object
  if (obj.conversationContext !== null && (typeof obj.conversationContext !== "object" || Array.isArray(obj.conversationContext))) {
    return false;
  }

  // structuredClarification must be null or plain object
  if (obj.structuredClarification !== null && (typeof obj.structuredClarification !== "object" || Array.isArray(obj.structuredClarification))) {
    return false;
  }

  // MUST NOT persist full message arrays in AsyncStorage (Privacy M-04)
  if ("messages" in obj && Array.isArray(obj.messages) && obj.messages.length > 0) {
    return false;
  }

  return true;
}

/**
 * Loads the persisted Caloy chat session context for the given Firebase UID.
 * Returns null if UID is missing/anonymous or stored data is invalid/outdated.
 */
export async function loadCaloyState(uid: string | null | undefined): Promise<CaloyPersistedState | null> {
  try {
    const key = getCaloyStorageKey(uid);
    if (!key) return null;

    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedState(parsed)) {
      // Incompatible or legacy state -> clean reset without crashing
      await AsyncStorage.removeItem(key);
      return null;
    }

    return {
      version: 2,
      sessionId: parsed.sessionId,
      selectedParishId: parsed.selectedParishId ?? null,
      selectedParishName: parsed.selectedParishName ?? null,
      conversationContext: parsed.conversationContext ?? null,
      structuredClarification: parsed.structuredClarification ?? null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch (err) {
    if (__DEV__) console.warn("[caloyStorage] Failed to load Caloy state from storage:", err);
    return null;
  }
}

/**
 * Saves the Caloy session context for the given Firebase UID.
 * Never persists full messages to AsyncStorage (Privacy M-04).
 * Refuses to save if UID is null or empty.
 */
export async function saveCaloyState(
  uid: string | null | undefined,
  state: Partial<Omit<CaloyPersistedState, "version" | "updatedAt">>
): Promise<void> {
  try {
    const key = getCaloyStorageKey(uid);
    if (!key) return; // Disallow anonymous persistence

    const payload: CaloyPersistedState = {
      version: 2,
      sessionId: isValidUuid(state.sessionId) ? state.sessionId : generateSessionId(),
      selectedParishId:
        typeof state.selectedParishId === "number" &&
        Number.isInteger(state.selectedParishId) &&
        state.selectedParishId > 0
          ? state.selectedParishId
          : null,
      selectedParishName: typeof state.selectedParishName === "string" ? state.selectedParishName : null,
      conversationContext: state.conversationContext && typeof state.conversationContext === "object" ? state.conversationContext : null,
      structuredClarification: state.structuredClarification && typeof state.structuredClarification === "object" ? state.structuredClarification : null,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    if (__DEV__) console.warn("[caloyStorage] Failed to save Caloy state to storage:", err);
  }
}

/**
 * Clears the persisted Caloy session for a specific Firebase UID.
 */
export async function clearCaloyStorage(uid: string | null | undefined): Promise<void> {
  try {
    if (!uid || typeof uid !== "string" || !uid.trim()) return;
    const safeUid = uid.trim();
    await AsyncStorage.multiRemove([
      `${STORAGE_KEY_PREFIX_V2}${safeUid}`,
      `${STORAGE_KEY_PREFIX_V1}${safeUid}`,
    ]);
  } catch (err) {
    if (__DEV__) console.warn("[caloyStorage] Failed to clear Caloy state for user:", err);
  }
}

/**
 * Clears all Caloy storage records across all accounts on device logout or session reset.
 */
export async function clearAllCaloyStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const caloyKeys = allKeys.filter(
      (k) => k.startsWith(STORAGE_KEY_PREFIX_V2) || k.startsWith(STORAGE_KEY_PREFIX_V1)
    );
    if (caloyKeys.length > 0) {
      await AsyncStorage.multiRemove(caloyKeys);
    }
  } catch (err) {
    if (__DEV__) console.warn("[caloyStorage] Failed to clear all Caloy storage:", err);
  }
}
