// Ustawienia startowe z data/athlete.json i data/season.json.
// Z profilu bierzemy tylko liczby (`metrics`); imię, miasta i opis tygodnia nie trafiają do aplikacji.
import { metrics } from '../../data/athlete.json';
import historyJson from '../../data/history_seed.json';
import { SEASON } from '../domain/catalog';
import type { Planned, Session, SessionKind, Settings } from '../domain/types';

export function defaultSettings(): Settings {
  return {
    id: 'main',
    ftpW: metrics.ftp_keiser_w.value,
    ftpHistory: metrics.ftp_keiser_w.history.map((h) => ({ ...h, source: h.source as 'estimate' })),
    lthrBike: metrics.lthr_bike.value,
    lthrRun: metrics.lthr_run.value,
    hrMax: metrics.hr_max_observed.run,
    rhrAlert: metrics.rhr_baseline.alert_threshold,
    phases: SEASON.phases.map((p) => ({ ...p })),
    events: SEASON.events.map(({ id, name, date }) => ({ id, name, date })),
    lightWeeks: SEASON.light_weeks.map(({ start, end, reason }) => ({ start, end, reason })),
    timer: { sound: true, voice: false, countdownBeeps: 3 },
    keiserGearHints: [],
  };
}

interface SeedSession {
  id: string;
  date: string;
  workout_id: string | null;
  kind: string;
  title: string;
  phase: string;
  duration_min?: number;
  distance_km?: number;
  elevation_m?: number;
  avg_hr?: number;
  max_hr?: number;
  rpe?: number;
  notes?: string;
  bike?: { avg_w?: number; gear?: number; cadence?: number };
}

/** Historia startowa (snake_case w pliku) → Session. */
export function seedSessions(now = new Date().toISOString()): Session[] {
  const raw = (historyJson as unknown as { sessions: SeedSession[] }).sessions;
  return raw.map((s) => ({
    id: s.id,
    date: s.date,
    workoutId: s.workout_id ?? null,
    kind: s.kind as SessionKind,
    title: s.title,
    phase: s.phase,
    durationMin: s.duration_min,
    distanceKm: s.distance_km,
    elevationM: s.elevation_m,
    avgHr: s.avg_hr,
    maxHr: s.max_hr,
    rpe: s.rpe,
    notes: s.notes,
    bike: s.bike ? { avgW: s.bike.avg_w, gear: s.bike.gear, cadence: s.bike.cadence } : undefined,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  }));
}

/** `planned_next` → Planned; tylko daty od dziś. */
export function seedPlanned(today: string): Planned[] {
  const raw = (historyJson as unknown as { planned_next: { date: string; workout_id: string | null; note?: string }[] }).planned_next;
  return raw
    .filter((p) => p.date >= today)
    .map((p, i) => ({ id: `seed-plan-${p.date}-${i}`, date: p.date, workoutId: p.workout_id, status: 'planned', note: p.note }));
}
