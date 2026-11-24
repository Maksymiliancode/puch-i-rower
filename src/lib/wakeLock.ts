// Screen Wake Lock: ekran nie gaśnie w trakcie timera (Safari iOS 16.4+, w PWA na iOS 18.4+).

let sentinel: WakeLockSentinel | null = null;

export async function lockScreen(): Promise<boolean> {
  try {
    if ('wakeLock' in navigator) {
      if (sentinel && !sentinel.released) return true;
      sentinel = await navigator.wakeLock.request('screen');
      return true;
    }
  } catch {
    /* odmowa albo brak wsparcia */
  }
  sentinel = null;
  return false;
}

export function releaseScreen(): void {
  try {
    void sentinel?.release();
  } catch {
    /* ignoruj */
  }
  sentinel = null;
}
