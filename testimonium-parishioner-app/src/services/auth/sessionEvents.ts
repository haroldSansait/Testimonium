type SessionExpiredListener = () => void;
const listeners = new Set<SessionExpiredListener>();

export const onSessionExpired = (listener: SessionExpiredListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitSessionExpired = () => {
  for (const listener of listeners) listener();
};