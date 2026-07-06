/**
 * LoadingOverlay — full-viewport spinner shown while auth state resolves.
 * Matches the existing crimson design system without adding new styles.
 */
export function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="w-10 h-10 border-4 border-gray-200 border-t-crimson-700 rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-400 tracking-widest uppercase">
          Loading…
        </p>
      </div>
    </div>
  );
}
