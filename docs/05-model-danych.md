# 05. Model danych

Propozycja w TypeScript. Dostosuj do wybranej platformy, ale zachowaj pola, bo od nich zależą import historii i eksport dla Claude.

```ts
// Ustawienia (jeden rekord)
type Settings = {
  ftpW: number;                // 290
  ftpHistory: { date: string; value: number; source: 'estimate'|'test'|'manual' }[];
  lthrBike: number;            // 163
  lthrRun: number;             // 167
  hrMax: number;               // 191
  rhrAlert: number;            // 50
  phaseOverride?: 'P1'|'P2'|'P3'|'P4'|'P5';
  phases: Phase[];             // z data/season.json, edytowalne daty
  events: { id: string; name: string; date: string }[];
  lightWeeks: { start: string; end: string; reason: string }[];
  timer: { sound: boolean; voice: boolean; countdownBeeps: 3 };
  keiserGearHints: { zone: string; gear: number; cadence: number; watts: number; date: string }[];
};

// Katalog treningów: wczytywany z data/*.json, tylko do odczytu w MVP
type Workout = {
  id: string; name: string;
  kind: 'bike'|'strength'|'strength_upper'|'run'|'hike'|'mountains'|'walk'|'mobility'|'other';
  equipment?: string[];        // 'keiser_m3', 'silownia', ...
  covers: string[][];          // jednostki slotów
  intensity_hard: boolean;
  legs_load: 'none'|'light'|'moderate'|'heavy';
  not_fasted?: boolean;
  rx: Record<string, Rx>;      // klucz: rx fazy (sm/ss/pr/la albo f1/f2/f3)
};
type Segment = { sec: number; pct_ftp: number; label: string; cadence: string; cue?: string;
                 rep?: [number, number]; set?: [number, number]; after_rep?: boolean };

// Zaplanowany trening na dzień (żonglowanie tygodniem)
type Planned = {
  id: string; date: string;    // YYYY-MM-DD
  workoutId: string; rxKey: string;
  status: 'planned'|'done'|'skipped'|'moved';
  sessionId?: string;          // gdy zrobiony
  note?: string;
};

// Wpis w dzienniku: wszystko, co zrobione
type Session = {
  id: string; date: string; startedAt?: string;
  workoutId: string | null;    // null dla 'rest' albo dowolnej aktywności
  kind: Workout['kind'] | 'rest';
  title: string;
  phase: string; rxKey?: string; plannedId?: string;
  durationMin?: number; distanceKm?: number; elevationM?: number;
  avgHr?: number; maxHr?: number; rpe?: number; fasted?: boolean;
  bike?: { avgW?: number; gear?: number; cadence?: number;
           intervals?: { label: string; rep?: number; avgW?: number; gear?: number; cadence?: number; avgHr?: number }[] };
  strength?: { exercises: { id: string; sets: { kg?: number; reps?: number; sec?: number }[]; done: boolean }[] };
  notes?: string;
  source: 'app'|'manual'|'garmin_csv'|'garmin_fit'|'seed';
  createdAt: string; updatedAt: string;
};

// Poranne dane (opcjonalne)
type Morning = { date: string; rhr?: number; legsHeavy?: boolean; sleepH?: number };
```

## Zasady

- Daty jako `YYYY-MM-DD` w strefie Europe/Warsaw. Tydzień od poniedziałku.
- Identyfikatory treningów zgodne z `data/*.json` (np. `b_z2`, `s_puch`, `r_easy`).
- **Migracje:** wersja schematu w bazie i funkcja migracji od pierwszego dnia.
- **Eksport JSON:** `{ schemaVersion, exportedAt, settings, planned, sessions, morning }`. Import scala po `id` i pyta przy konfliktach.
- Historia startowa: `data/history_seed.json → sessions`, z `source: 'seed'`. `planned_next` to propozycja zaplanowanych treningów na najbliższe dni; przy pierwszym uruchomieniu załaduj je jako `Planned`, jeśli ich daty nie minęły.
