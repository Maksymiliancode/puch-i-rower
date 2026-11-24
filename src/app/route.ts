import { useSyncExternalStore } from 'react';

// Nawigacja na #hashu: działa offline i pod dowolną ścieżką (GitHub Pages).
export type Route =
  | { name: 'today' }
  | { name: 'catalog'; focus?: string }
  | { name: 'settings' }
  | { name: 'timer'; workoutId: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'treningi':
      return { name: 'catalog', focus: parts[1] };
    case 'ustawienia':
      return { name: 'settings' };
    case 'timer':
      return parts[1] ? { name: 'timer', workoutId: parts[1] } : { name: 'catalog' };
    default:
      return { name: 'today' };
  }
}

export const href = {
  today: '#/',
  catalog: (focus?: string) => (focus ? `#/treningi/${encodeURIComponent(focus)}` : '#/treningi'),
  settings: '#/ustawienia',
  timer: (id: string) => `#/timer/${encodeURIComponent(id)}`,
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}

export function navigate(to: string): void {
  window.location.hash = to;
}
