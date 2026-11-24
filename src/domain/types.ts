// Typy domenowe. Pola zgodne z docs/05-model-danych.md i data/*.json.

export type PhaseId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type BikeRxKey = 'sm' | 'ss' | 'pr' | 'la';

export interface Segment {
  sec: number;
  pct_ftp: number;
  label: string;
  cadence: string;
  cue?: string;
  rep?: [number, number];
  set?: [number, number];
  after_rep?: boolean;
}

export interface BikeRx {
  text: string;
  garmin_title?: string;
  total_min?: number;
  segments: Segment[];
}

export interface BikeWorkout {
  id: string;
  name: string;
  kind: 'bike';
  equipment?: string[];
  goals?: string[];
  why: string;
  how: string[];
  zone: string | Record<string, string>;
  intensity_hard: boolean;
  legs_load: 'none' | 'light' | 'moderate' | 'heavy';
  covers: string[][];
  not_fasted?: boolean;
  phases_recommended?: string[];
  rx: Partial<Record<BikeRxKey, BikeRx>>;
}

export interface Phase {
  id: PhaseId;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  strength_rx: string;
  bike_rx: BikeRxKey;
  bike_role?: string;
  bike_text?: string;
  strength_text?: string;
  rir?: string;
}

export interface SeasonEvent {
  id: string;
  name: string;
  date: string;
}

export interface FtpEntry {
  date: string;
  value: number;
  source: 'estimate' | 'test' | 'manual';
}

export interface Settings {
  id: 'main';
  ftpW: number;
  ftpHistory: FtpEntry[];
  lthrBike: number;
  lthrRun: number;
  hrMax: number;
  rhrAlert: number;
  phaseOverride?: PhaseId;
  phases: Phase[];
  events: SeasonEvent[];
  lightWeeks: { start: string; end: string; reason: string }[];
  timer: { sound: boolean; voice: boolean; countdownBeeps: 3; voiceUri?: string; voiceRate?: number };
  keiserGearHints: { zone: string; gear: number; cadence: number; watts: number; date: string }[];
  /** Planer: co zwykle jest pod ręką (do układania kolejnych dni). */
  planner?: { equipment: Equipment[] };
}

/** Sprzęt / miejsce z planner_rules.json → location_fit. */
export type Equipment = 'keiser_m3' | 'silownia' | 'schody_lub_bieznia' | 'gory';

export type SessionKind =
  | 'bike'
  | 'strength'
  | 'strength_upper'
  | 'run'
  | 'hike'
  | 'mountains'
  | 'walk'
  | 'mobility'
  | 'other'
  | 'rest';

export interface Session {
  id: string;
  date: string;
  startedAt?: string;
  workoutId: string | null;
  kind: SessionKind;
  title: string;
  phase: string;
  rxKey?: string;
  plannedId?: string;
  durationMin?: number;
  distanceKm?: number;
  elevationM?: number;
  avgHr?: number;
  maxHr?: number;
  rpe?: number;
  fasted?: boolean;
  bike?: {
    avgW?: number;
    gear?: number;
    cadence?: number;
    intervals?: { label: string; rep?: number; avgW?: number; gear?: number; cadence?: number; avgHr?: number }[];
  };
  strength?: { exercises: { id: string; sets: { kg?: number; reps?: number; sec?: number }[]; done: boolean }[] };
  notes?: string;
  source: 'app' | 'manual' | 'garmin_csv' | 'garmin_fit' | 'seed';
  createdAt: string;
  updatedAt: string;
}

export interface Planned {
  id: string;
  date: string;
  workoutId: string | null;
  rxKey?: string;
  status: 'planned' | 'done' | 'skipped' | 'moved';
  sessionId?: string;
  note?: string;
}
