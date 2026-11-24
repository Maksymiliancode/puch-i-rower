// „Nogi na puch”: plan sesji z data/workouts_strength.json i proste odczyty z opisów serii.
import strengthJson from '../../data/workouts_strength.json';
import type { Session } from './types';
import type { StrengthKey } from './workouts';

export const FULL = strengthJson.full_session;
export const SHORT = strengthJson.short_session;
export const LOGGING_HINT = strengthJson.logging;
export type Variant = 'full' | 'short';

export interface ExerciseRx {
  sets_reps: string;
  tempo: string;
  rest: string;
}

export interface PlanItem {
  /** id ćwiczenia z pełnego treningu albo własny (np. „pallof”). */
  id: string;
  name: string;
  /** Z pełnego treningu (animacja, wskazówki); brak dla ćwiczeń tylko z core/krótkiej. */
  animation?: string;
  why?: string;
  cues: string[];
  extra?: string | null;
  setsText: string;
  tempo?: string;
  restText?: string;
  sets: number;
  timed: boolean;
  repsHint: string;
  restSec: number | null;
}

/** Pierwsza liczba serii + dodatkowa seria („+ 1 seria tylną nogą”). „2–3 serie” → 3. */
export function setsCount(text: string): number {
  const m = text.match(/^\s*(\d+)(?:\s*[–-]\s*(\d+))?/);
  const base = m ? Number(m[2] ?? m[1]) : 1;
  const extra = text.match(/\+\s*(\d+)\s*seri/);
  return base + (extra ? Number(extra[1]) : 0);
}

/** Czy seria to trzymanie na czas („3 × 60 s”, „3 × 2–3 min”). */
export function isTimed(text: string): boolean {
  return /×\s*[\d–-]+\s*(s|min)\b/.test(text);
}

/** Podpowiedź powtórzeń: „4 × 4–6, ciężko” → „4–6”, „3 × 8 na nogę” → „8 na nogę”. */
export function repsHint(text: string): string {
  const after = text.split('×')[1];
  if (!after) return '';
  return after.split(/[,+]/)[0].trim();
}

/** Przerwa w sekundach: „90 s” → 90, „2–3 min” → 120, „w parze z ćwiczeniem 6” → null. */
export function restSec(text: string): number | null {
  const m = text.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*(s|min)\b/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'min' ? 60 : 1);
}

const EXERCISES = FULL.exercises;

/** Sekundy trzymania z opisu („60 s” → 60, „2–3 min” → 120). */
export function holdSec(text: string): number | null {
  if (!isTimed(text)) return null;
  return restSec(text.split('×')[1] ?? '');
}

export function fullPlan(key: StrengthKey): PlanItem[] {
  return EXERCISES.map((e) => {
    const rx = (e.rx as Record<string, ExerciseRx>)[key];
    return {
      id: e.id,
      name: e.name,
      animation: e.animation_key,
      why: e.why,
      cues: e.cues,
      extra: e.extra,
      setsText: rx.sets_reps,
      tempo: rx.tempo,
      restText: rx.rest,
      sets: setsCount(rx.sets_reps),
      timed: isTimed(rx.sets_reps),
      repsHint: repsHint(rx.sets_reps),
      restSec: restSec(rx.rest),
    };
  });
}

/** Krótka siła: pozycje to tekst „Nazwa: ile”; nazwę dopasowujemy do ćwiczeń z pełnego treningu. */
export function shortPlan(key: StrengthKey): PlanItem[] {
  const sets = setsCount((SHORT.rx as Record<string, string>)[key] ?? '2');
  return SHORT.items.map((text, i) => {
    const [name, rest = ''] = text.split(':');
    const ex = EXERCISES.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
    const what = rest.trim().replace(/\.$/, '');
    const timed = /\d\s*(s|min)\b/.test(what) && !/w dół/.test(what);
    return {
      id: ex?.id ?? `short-${i}`,
      name: name.trim(),
      animation: ex?.animation_key,
      why: ex?.why,
      cues: ex?.cues ?? [],
      extra: null,
      setsText: `${sets} × ${what}`,
      sets,
      timed,
      repsHint: what,
      restSec: ex ? restSec((ex.rx as Record<string, ExerciseRx>)[key].rest) : null,
    };
  });
}

export type SetLog = { kg?: number; reps?: number; sec?: number; done?: boolean };

/** Ostatnie zapisane serie danego ćwiczenia (do podpowiedzi „poprzednio”). */
export function lastSets(sessions: Session[], exerciseId: string): { date: string; sets: SetLog[] } | null {
  const sorted = [...sessions].filter((s) => s.strength).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
  for (const s of sorted) {
    const ex = s.strength!.exercises.find((e) => e.id === exerciseId);
    const sets = ex?.sets.filter((x) => x.kg != null || x.reps != null || x.sec != null) ?? [];
    if (sets.length) return { date: s.date, sets };
  }
  return null;
}

/** „60 kg × 5 · 60 × 5 · 62,5 × 4” albo „90 s · 90 s”. */
export function setsSummary(sets: SetLog[]): string {
  return sets
    .map((s) => {
      if (s.sec != null && s.kg == null && s.reps == null) return `${s.sec} s`;
      const kg = s.kg != null ? `${String(s.kg).replace('.', ',')} kg` : '';
      const reps = s.reps != null ? `${s.reps}` : '';
      return [kg, reps].filter(Boolean).join(' × ') + (s.sec != null ? ` · ${s.sec} s` : '');
    })
    .join(' · ');
}
