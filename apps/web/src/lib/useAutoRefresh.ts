import { useEffect, useRef } from 'react';

/**
 * Auto-refresh hook: re-fetches data when the browser tab gains focus.
 * Uses visibilitychange to detect focus events.
 */
export function useAutoRefresh(
  onRefresh: () => void,
  enabled = true,
  delayMs = 5000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // Debounce: wait for the tab to settle before refreshing
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onRefresh();
        }, delayMs);
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, delayMs, onRefresh]);
}
