import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Dialog } from '../components/ui/Dialog';

export function useDraftNavigationGuard({
  enabled,
  hasUnsavedChanges,
  saveBeforeLeave,
  isInternalDraftUpdate,
}: {
  enabled: boolean;
  hasUnsavedChanges: boolean;
  saveBeforeLeave: () => Promise<void>;
  isInternalDraftUpdate: () => boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);
  const navigationSaveRef = useRef(false);
  const latest = useRef({ enabled, hasUnsavedChanges, saveBeforeLeave, isInternalDraftUpdate });
  latest.current = { enabled, hasUnsavedChanges, saveBeforeLeave, isInternalDraftUpdate };
  const blocker = useBlocker(({ nextLocation }) => (
    latest.current.enabled &&
    latest.current.hasUnsavedChanges &&
    !latest.current.isInternalDraftUpdate() &&
    !['/login', '/signup', '/verify-email', '/forgot-password'].includes(nextLocation.pathname)
  ));
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (!enabled) {
      setFailed(false);
      blocker.proceed();
      return;
    }
    if (navigationSaveRef.current || failed) return;
    navigationSaveRef.current = true;
    setSaving(true);
    void (async () => {
      try {
        await latest.current.saveBeforeLeave();
        if (mountedRef.current && latest.current.enabled && blockerRef.current.state === 'blocked') blockerRef.current.proceed();
      } catch {
        if (mountedRef.current && latest.current.enabled && blockerRef.current.state === 'blocked') setFailed(true);
      } finally {
        navigationSaveRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
    })();
  }, [blocker, enabled, failed, saving]);

  const navigationDialog = (
    <Dialog
      isOpen={failed && blocker.state === 'blocked' && enabled}
      title="Unable to save changes"
      description="Your latest form changes could not be saved. Stay to retry, or leave knowing your newest unsaved changes may be lost."
      cancelLabel="Stay and Retry"
      confirmLabel="Leave Anyway"
      onClose={() => {
        setFailed(false);
        if (blockerRef.current.state === 'blocked') blockerRef.current.reset();
        navigationSaveRef.current = true;
        setSaving(true);
        void latest.current.saveBeforeLeave().catch(() => {}).finally(() => {
          navigationSaveRef.current = false;
          if (mountedRef.current) setSaving(false);
        });
      }}
      onConfirm={() => {
        setFailed(false);
        if (blockerRef.current.state === 'blocked') blockerRef.current.proceed();
      }}
    />
  );
  return { navigationSaveRef, navigationDialog };
}
