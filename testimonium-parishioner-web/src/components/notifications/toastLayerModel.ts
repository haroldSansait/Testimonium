import type { AppNotification } from '../../types';

export const TOAST_DURATION_MS = 7000;
export const MAX_VISIBLE_DESKTOP = 3;
export const MAX_VISIBLE_MOBILE = 2;
export const MAX_PENDING_QUEUE = 5;

export interface ToastItem {
  notification: AppNotification;
  remainingMs: number;
  lastResumedAt: number | null;
  isHovered: boolean;
  isFocused: boolean;
}

export interface ToastLayerState {
  visible: ToastItem[];
  queue: AppNotification[];
  overflowCount: number;
}

export type ToastLayerAction =
  | { type: 'ENQUEUE_ARRIVALS'; items: AppNotification[]; maxVisible: number }
  | { type: 'REMOVE_VISIBLE'; id: string; maxVisible: number }
  | { type: 'PAUSE_TOAST'; id: string; isHovered?: boolean; isFocused?: boolean }
  | { type: 'RESUME_TOAST'; id: string; isHovered?: boolean; isFocused?: boolean }
  | { type: 'PAUSE_ALL' }
  | { type: 'RESUME_ALL' }
  | { type: 'DISMISS_OVERFLOW' }
  | { type: 'RESET' };

export const toastLayerReducer = (
  state: ToastLayerState,
  action: ToastLayerAction
): ToastLayerState => {
  switch (action.type) {
    case 'ENQUEUE_ARRIVALS': {
      const existingIds = new Set([
        ...state.visible.map(t => t.notification.id),
        ...state.queue.map(n => n.id)
      ]);
      const incoming = action.items.filter(item => !existingIds.has(item.id));
      if (incoming.length === 0) return state;

      const nextVisible = [...state.visible];
      const nextQueue = [...state.queue];
      let nextOverflow = state.overflowCount;

      // 1. Fill available visible slots up to maxVisible
      while (nextVisible.length < action.maxVisible && incoming.length > 0) {
        const notif = incoming.shift()!;
        nextVisible.push({
          notification: notif,
          remainingMs: TOAST_DURATION_MS,
          lastResumedAt: Date.now(),
          isHovered: false,
          isFocused: false
        });
      }

      // 2. Queue remaining incoming up to MAX_PENDING_QUEUE
      const availableQueueSlots = Math.max(0, MAX_PENDING_QUEUE - nextQueue.length);
      const toQueue = incoming.splice(0, availableQueueSlots);
      nextQueue.push(...toQueue);

      // 3. Any still left over are aggregated into overflowCount
      if (incoming.length > 0) {
        nextOverflow += incoming.length;
      }

      return {
        visible: nextVisible,
        queue: nextQueue,
        overflowCount: nextOverflow
      };
    }

    case 'REMOVE_VISIBLE': {
      const nextVisible = state.visible.filter(t => t.notification.id !== action.id);
      const nextQueue = [...state.queue];

      // Promote next from queue into visible slot
      while (nextVisible.length < action.maxVisible && nextQueue.length > 0) {
        const nextNotif = nextQueue.shift()!;
        nextVisible.push({
          notification: nextNotif,
          remainingMs: TOAST_DURATION_MS,
          lastResumedAt: Date.now(),
          isHovered: false,
          isFocused: false
        });
      }

      return {
        ...state,
        visible: nextVisible,
        queue: nextQueue
      };
    }

    case 'PAUSE_TOAST': {
      const now = Date.now();
      return {
        ...state,
        visible: state.visible.map(item => {
          if (item.notification.id !== action.id) return item;
          const nextHovered = action.isHovered ?? item.isHovered;
          const nextFocused = action.isFocused ?? item.isFocused;
          let remaining = item.remainingMs;
          if (item.lastResumedAt !== null) {
            remaining = Math.max(0, remaining - (now - item.lastResumedAt));
          }
          return {
            ...item,
            isHovered: nextHovered,
            isFocused: nextFocused,
            remainingMs: remaining,
            lastResumedAt: null
          };
        })
      };
    }

    case 'RESUME_TOAST': {
      const now = Date.now();
      return {
        ...state,
        visible: state.visible.map(item => {
          if (item.notification.id !== action.id) return item;
          const nextHovered = action.isHovered ?? item.isHovered;
          const nextFocused = action.isFocused ?? item.isFocused;
          const isPaused = nextHovered || nextFocused;
          return {
            ...item,
            isHovered: nextHovered,
            isFocused: nextFocused,
            lastResumedAt: isPaused ? null : now
          };
        })
      };
    }

    case 'PAUSE_ALL': {
      const now = Date.now();
      return {
        ...state,
        visible: state.visible.map(item => {
          let remaining = item.remainingMs;
          if (item.lastResumedAt !== null) {
            remaining = Math.max(0, remaining - (now - item.lastResumedAt));
          }
          return {
            ...item,
            remainingMs: remaining,
            lastResumedAt: null
          };
        })
      };
    }

    case 'RESUME_ALL': {
      const now = Date.now();
      return {
        ...state,
        visible: state.visible.map(item => {
          const isPaused = item.isHovered || item.isFocused;
          return {
            ...item,
            lastResumedAt: isPaused ? null : now
          };
        })
      };
    }

    case 'DISMISS_OVERFLOW':
      return {
        ...state,
        overflowCount: 0
      };

    case 'RESET':
      return {
        visible: [],
        queue: [],
        overflowCount: 0
      };

    default:
      return state;
  }
};
