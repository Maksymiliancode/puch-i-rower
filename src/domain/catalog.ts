// Katalog treningów wczytywany z data/*.json (tylko do odczytu).
import bikeJson from '../../data/workouts_bike.json';
import otherJson from '../../data/workouts_other.json';
import strengthJson from '../../data/workouts_strength.json';
import seasonJson from '../../data/season.json';
import type { BikeRxKey, BikeWorkout, Phase, SeasonEvent } from './types';

export const BIKE_WORKOUTS = (bikeJson as unknown as { workouts: BikeWorkout[] }).workouts;

export const SEASON = seasonJson as unknown as {
  phases: Phase[];
  events: SeasonEvent[];
  light_weeks: { start: string; end: string; reason: string; rules?: string }[];
};

export const bikeWorkout = (id: string) => BIKE_WORKOUTS.find((w) => w.id === id);

const NAMES = new Map<string, string>([
  ...BIKE_WORKOUTS.map((w) => [w.id, w.name] as [string, string]),
  ...(otherJson as unknown as { workouts: { id: string; name: string }[] }).workouts.map((w) => [w.id, w.name] as [string, string]),
  ...[strengthJson.full_session, strengthJson.short_session].map((s) => [s.id, s.name] as [string, string]),
]);

/** Nazwa dowolnego treningu z katalogu (rower, siła, inne). */
export const workoutName = (id: string | null) => (id ? (NAMES.get(id) ?? id) : 'Dowolna aktywność');

/** Trening ma timer, gdy w danej wersji są segmenty (np. jazda na zewnątrz ich nie ma). */
export const hasTimer = (w: BikeWorkout, rx: BikeRxKey) => (w.rx[rx]?.segments.length ?? 0) > 0;

/** Kolejność w katalogu: najpierw zalecane w tej fazie, potem dostępne, na końcu „nie w tej fazie”. */
export function orderForPhase(rx: BikeRxKey): BikeWorkout[] {
  const score = (w: BikeWorkout) => (w.rx[rx] ? (w.phases_recommended?.includes(rx) ? 0 : 1) : 2);
  return [...BIKE_WORKOUTS].sort((a, b) => score(a) - score(b));
}

/** Strefa treningu do opisu „Jak mocno” (pole `zone` może zależeć od fazy). */
export function workoutZone(w: BikeWorkout, rx: BikeRxKey): string {
  return typeof w.zone === 'string' ? w.zone : (w.zone[rx] ?? 'thr');
}
