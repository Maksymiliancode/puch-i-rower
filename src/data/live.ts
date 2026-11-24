// Dane z bazy odświeżane na żywo (Dexie liveQuery). Danych jest mało (setki wpisów),
// więc ekrany czytają całe tabele i filtrują w czystych funkcjach.
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import type { Planned, Session } from '../domain/types';
import { db, type Morning } from './db';

function useTable<T>(read: () => Promise<T[]>): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => {
    const sub = liveQuery(read).subscribe({ next: setRows, error: () => setRows([]) });
    return () => sub.unsubscribe();
  }, [read]);
  return rows;
}

const readSessions = () => db.sessions.toArray();
const readPlanned = () => db.planned.toArray();
const readMorning = () => db.morning.toArray();

export const useSessions = (): Session[] | null => useTable(readSessions);
export const usePlanned = (): Planned[] | null => useTable(readPlanned);
export const useMorning = (): Morning[] | null => useTable(readMorning);
