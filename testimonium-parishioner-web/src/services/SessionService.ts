import { signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { clearAllPollingTimers } from '../hooks/useService';
import { SESSION_CONFIG, type SessionState, type LogoutReason, type SessionBroadcastEvent } from '../config/sessionConfig';
import { logSessionEvent } from '../utils/sessionLogger';

// Generate unique ID for this browser tab instance
const TAB_ID = Math.random().toString(36).substring(2, 9);

type StateChangeListener = (state: SessionState, reason?: LogoutReason) => void;

class SessionServiceImpl {
  private currentState: SessionState = 'ACTIVE';
  private logoutInProgress = false;
  private refreshPromise: Promise<boolean> | null = null;
  private stateListeners = new Set<StateChangeListener>();
  private broadcastChannel: BroadcastChannel | null = null;
  private registeredTimers = new Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>();

  constructor() {
    this.initBroadcastChannel();
    this.initStorageFallback();
  }

  // ── Finite State Machine Management ─────────────────────────────────────

  public getState(): SessionState {
    return this.currentState;
  }

  public subscribeState(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public transitionTo(newState: SessionState, reason?: LogoutReason): boolean {
    if (this.currentState === 'LOGGED_OUT') {
      return false; // Terminal state
    }

    if (this.currentState === 'LOGGING_OUT' && newState !== 'LOGGED_OUT') {
      return false; // Cannot recover once logging out
    }

    if (this.currentState === newState) {
      return true;
    }

    // Valid transitions logic
    const isValid =
      (this.currentState === 'ACTIVE' && (newState === 'WARNING' || newState === 'REFRESHING' || newState === 'LOGGING_OUT')) ||
      (this.currentState === 'WARNING' && (newState === 'ACTIVE' || newState === 'REFRESHING' || newState === 'LOGGING_OUT')) ||
      (this.currentState === 'REFRESHING' && (newState === 'ACTIVE' || newState === 'WARNING' || newState === 'LOGGING_OUT')) ||
      (newState === 'LOGGING_OUT') ||
      (newState === 'LOGGED_OUT');

    if (!isValid) {
      console.warn(`[ParishionerSessionService] Invalid state transition rejected: ${this.currentState} -> ${newState}`);
      return false;
    }

    this.currentState = newState;
    this.stateListeners.forEach((listener) => listener(newState, reason));
    return true;
  }

  // ── Role-Aware Persistence Setup ─────────────────────────────────────────

  public async enforceSessionPersistence(): Promise<void> {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (err) {
      console.error('[ParishionerSessionService] Failed to enforce browserLocalPersistence:', err);
    }
  }

  // ── Timer & Resource Management ──────────────────────────────────────────

  public registerTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>): void {
    this.registeredTimers.add(timer);
  }

  public unregisterTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>): void {
    this.registeredTimers.delete(timer);
  }

  public clearAllTimers(): void {
    this.registeredTimers.forEach((timer) => {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
    });
    this.registeredTimers.clear();
    clearAllPollingTimers();
  }

  // ── Intelligent Single-Flight Token Refresh ───────────────────────────────

  public async refreshToken(force = false): Promise<boolean> {
    // If logout is in progress, refuse token refresh
    if (this.logoutInProgress || this.currentState === 'LOGGING_OUT' || this.currentState === 'LOGGED_OUT') {
      return false;
    }

    // Single-flight deduplication: return existing promise if already running
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const previousState = this.currentState;
    this.transitionTo('REFRESHING');

    this.refreshPromise = (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          await this.logout('expired');
          return false;
        }

        if (!force) {
          // Check token expiration threshold before hitting server
          const tokenResult = await user.getIdTokenResult();
          const expirationTime = new Date(tokenResult.expirationTime).getTime();
          const timeUntilExpiryMs = expirationTime - Date.now();
          const thresholdMs = SESSION_CONFIG.TOKEN_REFRESH_THRESHOLD_MINUTES * 60 * 1000;

          if (timeUntilExpiryMs > thresholdMs) {
            // Token is still fresh
            this.transitionTo(previousState === 'REFRESHING' ? 'ACTIVE' : previousState);
            return true;
          }
        }

        // Attempt refresh
        try {
          await user.getIdToken(true);
          logSessionEvent('Session Refreshed');
          this.transitionTo('ACTIVE');
          this.broadcastEvent({ type: 'SESSION_EXTENDED', timestamp: Date.now(), tabId: TAB_ID });
          return true;
        } catch (firstErr) {
          logSessionEvent('Network Refresh Retry', { error: (firstErr as Error).message });
          // Retry ONCE on transient failure
          try {
            await new Promise((res) => setTimeout(res, 1000));
            await user.getIdToken(true);
            logSessionEvent('Session Refreshed');
            this.transitionTo('ACTIVE');
            this.broadcastEvent({ type: 'SESSION_EXTENDED', timestamp: Date.now(), tabId: TAB_ID });
            return true;
          } catch (retryErr) {
            logSessionEvent('Refresh Failed', { error: (retryErr as Error).message });
            await this.logout('network');
            return false;
          }
        }
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ── Idempotent Centralized Logout ────────────────────────────────────────

  public async logout(reason: LogoutReason = 'manual'): Promise<void> {
    if (this.logoutInProgress) {
      return; // Already logging out
    }

    this.logoutInProgress = true;
    this.transitionTo('LOGGING_OUT', reason);

    // Map log event
    let logEventName: any = 'Manual Logout';
    if (reason === 'idle') logEventName = 'Idle Logout';
    if (reason === 'absolute') logEventName = 'Absolute Timeout Logout';
    if (reason === 'cross-tab') logEventName = 'Cross-Tab Logout';
    if (reason === 'revoked') logEventName = 'Revoked Token Logout';
    logSessionEvent(logEventName, { reason, tabId: TAB_ID });

    // Cancel all timers and background polling
    this.clearAllTimers();

    // Broadcast logout to other open tabs
    if (reason !== 'cross-tab') {
      this.broadcastEvent({
        type: reason === 'idle' ? 'SESSION_EXPIRED' : 'LOGOUT',
        reason,
        timestamp: Date.now(),
        tabId: TAB_ID,
      });
    }

    // Clean up Firebase session
    try {
      await signOut(auth);
    } catch (err) {
      console.error('[ParishionerSessionService] Error during Firebase signOut:', err);
    }

    // Clear local storage items (excluding non-sensitive app configs if any, while NEVER storing tokens)
    try {
      localStorage.removeItem(SESSION_CONFIG.SESSION_START_KEY);
      localStorage.removeItem(SESSION_CONFIG.STORAGE_SYNC_KEY);
      sessionStorage.clear();
    } catch (err) {
      console.error('[ParishionerSessionService] Storage cleanup error:', err);
    }

    this.transitionTo('LOGGED_OUT', reason);

    // Redirect to landing/login page cleanly
    if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/') {
      const searchParams = new URLSearchParams();
      if (reason && reason !== 'manual') {
        searchParams.set('reason', reason);
      }
      const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
      window.location.replace(`/login${queryString}`);
    }
  }

  // ── Cross-Tab Synchronization ──────────────────────────────────────────

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel(SESSION_CONFIG.BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event: MessageEvent<SessionBroadcastEvent>) => {
        this.handleBroadcastMessage(event.data);
      };
    } catch (err) {
      console.warn('[ParishionerSessionService] BroadcastChannel initialization failed, falling back to storage:', err);
    }
  }

  private initStorageFallback(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === SESSION_CONFIG.STORAGE_SYNC_KEY && event.newValue) {
        try {
          const payload: SessionBroadcastEvent = JSON.parse(event.newValue);
          this.handleBroadcastMessage(payload);
        } catch {
          // Ignore malformed storage events
        }
      }
    });
  }

  private handleBroadcastMessage(event: SessionBroadcastEvent): void {
    if (!event || event.tabId === TAB_ID) return; // Ignore own messages

    // Ignore stale events (>30 seconds old)
    if (Date.now() - event.timestamp > 30000) return;

    if (event.type === 'LOGOUT' || event.type === 'SESSION_EXPIRED' || event.type === 'FORCED_LOGOUT') {
      logSessionEvent('Cross-Tab Logout', { reason: event.reason, senderTab: event.tabId });
      this.logout('cross-tab');
    }
  }

  private broadcastEvent(event: SessionBroadcastEvent): void {
    // 1. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch (err) {
        console.error('[ParishionerSessionService] Failed to post BroadcastChannel message:', err);
      }
    }

    // 2. Storage event fallback
    try {
      localStorage.setItem(SESSION_CONFIG.STORAGE_SYNC_KEY, JSON.stringify(event));
    } catch {
      // Storage quota or restriction fallback ignore
    }
  }
}

export const SessionService = new SessionServiceImpl();
