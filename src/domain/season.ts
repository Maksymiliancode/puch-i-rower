import type { BikeRxKey, Phase, SeasonEvent } from './types';

const warsaw = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });

/** Dzisiejsza data w strefie Europe/Warsaw jako YYYY-MM-DD. */
export const todayIso = (now: Date = new Date()) => warsaw.format(now);

/** Faza zawierająca datę; przed sezonem pierwsza, po sezonie ostatnia. */
export function phaseForDate(phases: Phase[], date: string): Phase {
  const sorted = [...phases].sort((a, b) => a.start.localeCompare(b.start));
  const hit = sorted.find((p) => p.start <= date && date <= p.end);
  if (hit) return hit;
  return date < sorted[0].start ? sorted[0] : sorted[sorted.length - 1];
}

export function currentPhase(phases: Phase[], date: string, override?: string): Phase {
  if (override) {
    const p = phases.find((x) => x.id === override);
    if (p) return p;
  }
  return phaseForDate(phases, date);
}

export const bikeRxFor = (phase: Phase): BikeRxKey => phase.bike_rx;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Najbliższe wydarzenie od dziś (włącznie). */
export function nextEvent(events: SeasonEvent[], date: string): { event: SeasonEvent; days: number } | null {
  const upcoming = events.filter((e) => e.date >= date).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  return { event: upcoming[0], days: daysBetween(date, upcoming[0].date) };
}
