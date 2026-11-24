import type { CSSProperties } from 'react';
import { prettyDate } from '../../domain/format';
import type { Item } from '../../domain/planner';
import { daysBetween } from '../../domain/season';
import type { Equipment, Planned, Session } from '../../domain/types';
import { familyFor, workoutMeta, type Family } from '../../domain/workouts';

export const DEFAULT_EQUIPMENT: Equipment[] = ['keiser_m3', 'silownia', 'schody_lub_bieznia'];

export const EQUIPMENT_OPTIONS: { id: Equipment; label: string }[] = [
  { id: 'keiser_m3', label: 'Keiser' },
  { id: 'silownia', label: 'Siłownia' },
  { id: 'schody_lub_bieznia', label: 'Schody / bieżnia' },
  { id: 'gory', label: 'Góry' },
];

const weekdayFmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', timeZone: 'UTC' });
export const weekdayName = (iso: string) => weekdayFmt.format(new Date(`${iso}T12:00:00Z`));

export function dayLabel(date: string, today: string): string {
  const d = daysBetween(today, date);
  if (d === 0) return 'Dziś';
  if (d === 1) return 'Jutro';
  if (d === -1) return 'Wczoraj';
  const w = weekdayName(date);
  return `${w[0].toUpperCase()}${w.slice(1)}, ${prettyDate(date)}`;
}

export const sessionItems = (sessions: Session[]): Item[] => sessions.map((s) => ({ date: s.date, workoutId: s.workoutId, id: s.id }));

/** Plany od dziś, jeszcze niezrobione. */
export const plannedItems = (planned: Planned[], today: string): Item[] =>
  planned.filter((p) => p.status === 'planned' && p.date >= today).map((p) => ({ date: p.date, workoutId: p.workoutId, planned: true, id: p.id, note: p.note }));

export const familyOfWorkout = (id: string | null, kind?: Session['kind']): Family => familyFor(id, kind);

export const famStyle = (f: Family) => ({ '--fam': `var(--fam-${f})` }) as CSSProperties;

export const shortName = (id: string | null) => workoutMeta(id)?.short ?? 'Wolne';

export const minutesLabel = (r: [number, number] | null) => (!r ? '' : r[0] === r[1] ? `${r[0]} min` : `${r[0]}–${r[1]} min`);
