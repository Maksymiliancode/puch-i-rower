// Podsumowanie dziennika: ile treningów jakiego rodzaju i ile czasu w danym okresie.
import type { Session } from './types';
import { FAMILY_ORDER, familyFor, type Family } from './workouts';

export interface FamilyCount {
  fam: Family;
  count: number;
  minutes: number;
}

export interface Summary {
  count: number;
  minutes: number;
  /** Dni z co najmniej jednym treningiem. */
  activeDays: number;
  byFamily: FamilyCount[];
}

/** Wpisy z dat od–do (włącznie), bez dni wolnych. Rodzaje bez treningów są pomijane. */
export function summarize(sessions: Session[], from: string, to: string): Summary {
  const list = sessions.filter((s) => s.date >= from && s.date <= to && s.kind !== 'rest');
  const map = new Map<Family, FamilyCount>();
  for (const s of list) {
    const fam = familyFor(s.workoutId, s.kind);
    const row = map.get(fam) ?? { fam, count: 0, minutes: 0 };
    row.count++;
    row.minutes += s.durationMin ?? 0;
    map.set(fam, row);
  }
  return {
    count: list.length,
    minutes: list.reduce((a, s) => a + (s.durationMin ?? 0), 0),
    activeDays: new Set(list.map((s) => s.date)).size,
    byFamily: FAMILY_ORDER.filter((f) => map.has(f)).map((f) => map.get(f)!),
  };
}

/** „9 h 40 min”, „45 min”, „0 min”. */
export function hoursText(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** „1 trening”, „3 treningi”, „12 treningów”. */
export function trainingsText(n: number): string {
  const a = n % 10;
  const b = n % 100;
  if (n === 1) return '1 trening';
  return `${n} ${a >= 2 && a <= 4 && !(b >= 12 && b <= 14) ? 'treningi' : 'treningów'}`;
}
