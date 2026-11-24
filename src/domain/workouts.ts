// Wspólny opis wszystkich treningów (rower, siła, bieg, góry, mobilność…) dla planera i kalendarza.
// Wszystko czytane z data/*.json; tu tylko ujednolicenie pól.
import otherJson from '../../data/workouts_other.json';
import strengthJson from '../../data/workouts_strength.json';
import { BIKE_WORKOUTS } from './catalog';
import type { BikeRxKey, Equipment, Phase, SessionKind } from './types';

export type StrengthKey = 'f1' | 'f2' | 'f3';
export type LegsLoad = 'none' | 'light' | 'moderate' | 'heavy';

export interface WorkoutMeta {
  id: string;
  name: string;
  short: string;
  kind: SessionKind;
  hard: boolean;
  legs: LegsLoad;
  covers: string[][];
  equipment: Equipment[];
  notFasted: boolean;
  /** Opis „ile” w danej fazie (null = trening niedostępny w tej fazie). */
  rxText: (phase: Phase) => string | null;
  /** Zakres minut w danej fazie [od, do] (null = brak danych). */
  minutes: (phase: Phase) => [number, number] | null;
  how: string[];
}

type Range = Record<string, [number, number]>;

interface OtherJson {
  id: string;
  name: string;
  short: string;
  kind: SessionKind;
  rx: string | Record<string, string>;
  how: string[];
  intensity_hard: boolean;
  legs_load: LegsLoad;
  covers: string[][];
  equipment: string[];
  duration_min_range: Range;
}

const sKey = (p: Phase) => p.strength_rx as StrengthKey;
const rangeFor = (r: Range | undefined, key: string): [number, number] | null => r?.[key] ?? r?.['*'] ?? null;

const bike: WorkoutMeta[] = BIKE_WORKOUTS.map((w) => {
  const range = (w as unknown as { duration_min_range?: Range }).duration_min_range;
  const rxOf = (p: Phase) => w.rx[p.bike_rx as BikeRxKey];
  return {
    id: w.id,
    name: w.name,
    short: w.name,
    kind: 'bike',
    hard: w.intensity_hard,
    legs: w.legs_load,
    covers: w.covers,
    equipment: (w.equipment ?? []) as Equipment[],
    notFasted: !!w.not_fasted,
    rxText: (p) => rxOf(p)?.text ?? null,
    minutes: (p) => {
      const rx = rxOf(p);
      if (!rx) return null;
      const r = rangeFor(range, p.bike_rx);
      if (r) return r;
      return rx.total_min ? [rx.total_min, rx.total_min] : null;
    },
    how: w.how,
  };
});

const other: WorkoutMeta[] = (otherJson as unknown as { workouts: OtherJson[] }).workouts.map((w) => ({
  id: w.id,
  name: w.name,
  short: w.short,
  kind: w.kind,
  hard: w.intensity_hard,
  legs: w.legs_load,
  covers: w.covers,
  equipment: w.equipment as Equipment[],
  notFasted: false,
  rxText: (p) => (typeof w.rx === 'string' ? w.rx : (w.rx[sKey(p)] ?? null)),
  minutes: (p) => rangeFor(w.duration_min_range, sKey(p)),
  how: w.how,
}));

const full = strengthJson.full_session;
const short = strengthJson.short_session;
const strength: WorkoutMeta[] = [
  {
    id: full.id,
    name: full.name,
    short: 'Nogi na puch',
    kind: 'strength',
    hard: full.intensity_hard,
    legs: full.legs_load as LegsLoad,
    covers: full.covers,
    equipment: full.equipment as Equipment[],
    notFasted: false,
    rxText: () => `około ${full.duration_min} minut: rozgrzewka, 8 ćwiczeń, core`,
    minutes: () => rangeFor(full.duration_min_range as unknown as Range, '*'),
    how: [full.pairing, ...full.rules],
  },
  {
    id: short.id,
    name: short.name,
    short: 'Siła krótka',
    kind: 'strength',
    hard: short.intensity_hard,
    legs: short.legs_load as LegsLoad,
    covers: short.covers,
    equipment: short.equipment as Equipment[],
    notFasted: false,
    rxText: (p) => (short.rx as Record<string, string>)[sKey(p)] ?? null,
    minutes: () => rangeFor(short.duration_min_range as unknown as Range, '*'),
    how: short.items,
  },
];

export const WORKOUTS: WorkoutMeta[] = [...bike, ...strength, ...other];
const BY_ID = new Map(WORKOUTS.map((w) => [w.id, w]));
export const workoutMeta = (id: string | null | undefined) => (id ? BY_ID.get(id) : undefined);

/** Gdzie startuje trening: timer rowerowy, ekran siły albo tylko zapis. */
export type StartKind = 'timer' | 'strength' | 'log';
export function startKind(id: string, phase: Phase): StartKind {
  if (id === full.id || id === short.id) return 'strength';
  const b = BIKE_WORKOUTS.find((w) => w.id === id);
  if (b && (b.rx[phase.bike_rx]?.segments.length ?? 0) > 0) return 'timer';
  return 'log';
}

/** Rodzaj do kolorów i ikon w kalendarzu. */
export type Family = 'legs' | 'upper' | 'bike' | 'run' | 'uphill' | 'easy' | 'other' | 'rest';
export const FAMILY_LABEL: Record<Family, string> = {
  legs: 'Siła nóg',
  upper: 'Siła góra',
  bike: 'Rower',
  run: 'Bieg',
  uphill: 'Pod górę / góry',
  easy: 'Mobilność / spacer',
  other: 'Inne',
  rest: 'Wolne',
};

/** Rodzaj wpisu: z treningu w katalogu, a gdy go nie ma, z pola `kind`. */
export function familyFor(workoutId: string | null, kind?: SessionKind): Family {
  if (!workoutId) return kind ? familyOf(kind, null) : 'rest';
  const m = workoutMeta(workoutId);
  return m ? familyOf(m.kind, workoutId) : familyOf(kind ?? 'other', workoutId);
}

/** Kolejność rodzajów w legendzie i podsumowaniu. */
export const FAMILY_ORDER: Family[] = ['legs', 'upper', 'bike', 'run', 'uphill', 'easy', 'other'];

export function familyOf(kind: SessionKind, workoutId?: string | null): Family {
  if (workoutId === 'r_hills') return 'uphill';
  switch (kind) {
    case 'strength':
      return 'legs';
    case 'strength_upper':
      return 'upper';
    case 'bike':
      return 'bike';
    case 'run':
      return 'run';
    case 'hike':
    case 'mountains':
      return 'uphill';
    case 'mobility':
    case 'walk':
      return 'easy';
    case 'rest':
      return 'rest';
    default:
      return 'other';
  }
}
