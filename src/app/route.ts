import { useSyncExternalStore } from 'react';

// Nawigacja na #hashu: działa offline i pod dowolną ścieżką (GitHub Pages).
export type Route =
  | { name: 'today' }
  | { name: 'plan'; date?: string }
  | { name: 'catalog'; focus?: string }
  | { name: 'strength'; variant: 'full' | 'short' }
  | { name: 'settings' }
  | { name: 'timer'; workoutId: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'plan':
      return { name: 'plan', date: /^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? '') ? parts[1] : undefined };
    case 'treningi':
      return { name: 'catalog', focus: parts[1] };
    case 'sila':
      return { name: 'strength', variant: parts[1] === 'krotka' ? 'short' : 'full' };
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
  plan: (date?: string) => (date ? `#/plan/${date}` : '#/plan'),
  catalog: (focus?: string) => (focus ? `#/treningi/${encodeURIComponent(focus)}` : '#/treningi'),
  strength: (variant: 'full' | 'short' = 'full') => (variant === 'short' ? '#/sila/krotka' : '#/sila'),
  settings: '#/ustawienia',
  timer: (id: string) => `#/timer/${encodeURIComponent(id)}`,
};

/** Link „Start” dla dowolnego treningu: timer, ekran siły albo karta w katalogu. */
export function startHref(id: string, kind: 'timer' | 'strength' | 'log'): string {
  if (kind === 'timer') return href.timer(id);
  if (kind === 'strength') return href.strength(id === 's_short' ? 'short' : 'full');
  return href.catalog(id);
}

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
