import { useEffect, useCallback } from 'react';

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  message?: string;
}

/**
 * Hook to manage unsaved changes warnings on window refresh / tab close
 * and synchronize global window flag for sidebar/navbar navigation guards.
 */
export function useUnsavedChanges({
  isDirty,
  message = 'You have unsaved changes. Are you sure you want to leave without saving?',
}: UseUnsavedChangesOptions) {
  useEffect(() => {
    (window as any).hasUnsavedSettingsChanges = isDirty;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      (window as any).hasUnsavedSettingsChanges = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  const confirmNavigation = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(message);
  }, [isDirty, message]);

  return { isDirty, confirmNavigation };
}
