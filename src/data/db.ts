// Lokalna baza (IndexedDB przez Dexie). Historia to najcenniejsze dane:
// nic nie jest kasowane bez potwierdzenia, a eksport/import JSON działa od pierwszego etapu.
import Dexie, { type EntityTable } from 'dexie';
import type { Planned, Session, Settings } from '../domain/types';
import { todayIso } from '../domain/season';
import { defaultSettings, seedPlanned, seedSessions } from './defaults';

export const SCHEMA_VERSION = 1;

interface Meta {
  key: string;
  value: unknown;
}

export interface Morning {
  date: string;
  rhr?: number;
  legsHeavy?: boolean;
  sleepH?: number;
}

export class AppDb extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  planned!: EntityTable<Planned, 'id'>;
  morning!: EntityTable<Morning, 'date'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name = 'puch-i-rower') {
    super(name);
    // Przy zmianie schematu: nowa wersja + .upgrade(), stare wersje zostają.
    this.version(1).stores({
      settings: 'id',
      sessions: 'id, date, kind, workoutId',
      planned: 'id, date, status',
      morning: 'date',
      meta: 'key',
    });
  }
}

export const db = new AppDb();

/** Pierwsze uruchomienie: ustawienia domyślne, historia startowa, plan na najbliższe dni. */
export async function ensureSeeded(d: AppDb = db, today = todayIso()): Promise<void> {
  await d.transaction('rw', [d.settings, d.sessions, d.planned, d.meta], async () => {
    const seeded = await d.meta.get('seeded');
    if (seeded) return;
    if (!(await d.settings.get('main'))) await d.settings.put(defaultSettings());
    await d.sessions.bulkPut(seedSessions());
    await d.planned.bulkPut(seedPlanned(today));
    await d.meta.put({ key: 'seeded', value: new Date().toISOString() });
    await d.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
  });
}

/** Prośba do przeglądarki, żeby nie czyściła danych przy braku miejsca. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* brak wsparcia */
  }
  return false;
}

export interface ExportFile {
  schemaVersion: number;
  exportedAt: string;
  settings: Settings | null;
  planned: Planned[];
  sessions: Session[];
  morning: Morning[];
}

export async function exportAll(d: AppDb = db): Promise<ExportFile> {
  const [settings, planned, sessions, morning] = await Promise.all([
    d.settings.get('main'),
    d.planned.toArray(),
    d.sessions.orderBy('date').toArray(),
    d.morning.toArray(),
  ]);
  return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings: settings ?? null, planned, sessions, morning };
}

export interface ImportPlan {
  newSessions: Session[];
  conflicts: { current: Session; incoming: Session }[];
  sameSessions: number;
  planned: Planned[];
  morning: Morning[];
  settings: Settings | null;
}

export function parseExport(text: string): ExportFile {
  const data = JSON.parse(text) as Partial<ExportFile>;
  if (typeof data !== 'object' || data === null || !Array.isArray(data.sessions)) {
    throw new Error('To nie jest plik kopii z tej aplikacji (brak listy treningów).');
  }
  if ((data.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error('Plik pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.');
  }
  return {
    schemaVersion: data.schemaVersion ?? SCHEMA_VERSION,
    exportedAt: data.exportedAt ?? '',
    settings: data.settings ?? null,
    planned: data.planned ?? [],
    sessions: data.sessions,
    morning: data.morning ?? [],
  };
}

/** Scalanie po `id`: nowe wpisy dodaje, różniące się zgłasza jako konflikty do decyzji. */
export async function planImport(file: ExportFile, d: AppDb = db): Promise<ImportPlan> {
  const existing = await d.sessions.bulkGet(file.sessions.map((s) => s.id));
  const plan: ImportPlan = { newSessions: [], conflicts: [], sameSessions: 0, planned: file.planned, morning: file.morning, settings: file.settings };
  file.sessions.forEach((incoming, i) => {
    const current = existing[i];
    if (!current) plan.newSessions.push(incoming);
    else if (JSON.stringify(current) === JSON.stringify(incoming)) plan.sameSessions++;
    else plan.conflicts.push({ current, incoming });
  });
  return plan;
}

export async function applyImport(
  plan: ImportPlan,
  opts: { overwriteConflicts: boolean; replaceSettings: boolean },
  d: AppDb = db,
): Promise<void> {
  await d.transaction('rw', [d.settings, d.sessions, d.planned, d.morning], async () => {
    await d.sessions.bulkPut(plan.newSessions);
    if (opts.overwriteConflicts) await d.sessions.bulkPut(plan.conflicts.map((c) => c.incoming));
    // Plan i poranki: dodaj brakujące, istniejących nie ruszaj.
    for (const p of plan.planned) if (!(await d.planned.get(p.id))) await d.planned.put(p);
    for (const m of plan.morning) if (!(await d.morning.get(m.date))) await d.morning.put(m);
    if (opts.replaceSettings && plan.settings) await d.settings.put({ ...plan.settings, id: 'main' });
  });
}
