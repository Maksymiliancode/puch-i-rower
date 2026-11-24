import { useSettings } from '../../app/settings';
import { useMorning, usePlanned, useSessions } from '../../data/live';
import { planDays, type DayPlan, type Item } from '../../domain/planner';
import { currentPhase, todayIso } from '../../domain/season';
import type { Equipment, Phase, Planned, Session } from '../../domain/types';
import type { Morning } from '../../data/db';
import { DEFAULT_EQUIPMENT, plannedItems, sessionItems } from './common';

export const DAYS_AHEAD = 7;

export interface PlanData {
  today: string;
  sessions: Session[];
  planned: Planned[];
  morning: Morning[];
  done: Item[];
  ahead: Item[];
  equipment: Equipment[];
  base: { equipment: Equipment[]; minutes: null; morning: Morning[]; rhrAlert: number; lightWeeks: { start: string; end: string; reason: string }[] };
  phaseFor: (date: string) => Phase;
  days: DayPlan[];
}

/** Jeden wspólny plan na kolejne dni: ten sam na ekranie Dziś i Plan. */
export function usePlanDays(): PlanData | null {
  const { settings } = useSettings();
  const sessions = useSessions();
  const planned = usePlanned();
  const morning = useMorning();
  if (!sessions || !planned || !morning) return null;
  const today = todayIso();
  const equipment = settings.planner?.equipment ?? DEFAULT_EQUIPMENT;
  const done = sessionItems(sessions);
  const ahead = plannedItems(planned, today);
  const phaseFor = (d: string) => currentPhase(settings.phases, d, settings.phaseOverride);
  const base = { equipment, minutes: null, morning, rhrAlert: settings.rhrAlert, lightWeeks: settings.lightWeeks };
  const days = planDays(base, { from: today, days: DAYS_AHEAD, done, planned: ahead, phaseFor });
  return { today, sessions, planned, morning, done, ahead, equipment, base, phaseFor, days };
}

/** Pierwszy dzień, w którym jest coś do zrobienia (zaplanowane albo propozycja). */
export function nextDay(days: DayPlan[]): DayPlan | undefined {
  return days.find((d) => d.planned.length > 0 || d.suggestion !== null);
}
