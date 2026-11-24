// Zapis stanu timera, żeby po przypadkowym zamknięciu aplikacji dało się wznowić trening.
import type { TimerState } from '../domain/timer';
import type { BikeRxKey } from '../domain/types';
import type { MetricId } from '../domain/zones';

const KEY = 'pir-timer-v1';
/** Starszych zapisów nie proponujemy do wznowienia. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface SavedTimer {
  workoutId: string;
  rxKey: BikeRxKey;
  state: TimerState;
  primary?: MetricId | null;
  startedAt?: string;
  savedAt: number;
}

export function saveTimer(t: Omit<SavedTimer, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...t, savedAt: Date.now() }));
  } catch {
    /* tryb prywatny albo brak miejsca */
  }
}

export function loadTimer(): SavedTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SavedTimer;
    if (!t?.state?.durations || Date.now() - t.savedAt > MAX_AGE_MS) return null;
    return t;
  } catch {
    return null;
  }
}

export function clearTimer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoruj */
  }
}
