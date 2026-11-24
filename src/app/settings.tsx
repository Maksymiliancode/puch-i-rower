import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../data/db';
import { currentPhase, todayIso } from '../domain/season';
import type { Phase, Settings } from '../domain/types';

interface SettingsApi {
  settings: Settings;
  phase: Phase;
  save: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  const current = useRef(initial);

  const save = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setSettings(next);
    await db.settings.put(next);
  }, []);

  const phase = useMemo(() => currentPhase(settings.phases, todayIso(), settings.phaseOverride), [settings.phases, settings.phaseOverride]);

  const value = useMemo(() => ({ settings, phase, save }), [settings, phase, save]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useSettings(): SettingsApi {
  const v = use(Ctx);
  if (!v) throw new Error('useSettings poza SettingsProvider');
  return v;
}
