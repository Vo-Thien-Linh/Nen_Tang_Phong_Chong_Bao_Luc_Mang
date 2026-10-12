import { useEffect } from 'react';

export function useAutoDismissNotice(active, onDismiss, duration = 3000) {
  useEffect(() => {
    if (!active || !onDismiss) return undefined;
    const timerId = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timerId);
  }, [active, duration, onDismiss]);
}
