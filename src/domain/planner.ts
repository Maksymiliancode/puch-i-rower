// Planer tygodnia i „co teraz?” według docs/04-logika-planowania.md i data/planner_rules.json.
// Czyste funkcje: dostają historię i kontekst, zwracają propozycję z uzasadnieniem po polsku.
import rulesJson from '../../data/planner_rules.json';
import { daysBetween } from './season';
import type { Equipment, Phase, PhaseId } from './types';
import { workoutMeta, type WorkoutMeta } from './workouts';

export type Category = 'sila' | 'dlugi' | 'gora' | 'mocny' | 'luz' | 'sila2' | 'regen';
export interface Slot {
  c: Category;
  why: string;
}

const RULES = rulesJson as unknown as {
  categories: Record<Category, string>;
  slots_by_phase: Record<PhaseId, Slot[]>;
  core_slots: number;
  light_week_max_slots: number;
  preferences_by_phase: Record<PhaseId, Record<Category, string[]>>;
};

export const CATEGORY_LABEL = RULES.categories;
export const CORE_SLOTS = RULES.core_slots;

/** Zrobiony albo zaplanowany trening (wpis z dziennika, plan, albo symulacja kolejnych dni). */
export interface Item {
  date: string;
  workoutId: string | null;
  /** Zaplanowany, jeszcze niezrobiony. */
  planned?: boolean;
  id?: string;
  note?: string;
}

export interface LightWeek {
  start: string;
  end: string;
  reason: string;
}

// ---------- daty ----------
export function addDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

/** 0 = poniedziałek … 6 = niedziela. */
export const weekday = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -weekday(iso));

export function lightWeekFor(date: string, lightWeeks: LightWeek[]): LightWeek | null {
  const a = mondayOf(date);
  const b = addDays(a, 6);
  return lightWeeks.find((l) => l.start <= b && l.end >= a) ?? null;
}

// ---------- plan tygodnia ----------
export interface WeekPlan {
  slots: Slot[];
  /** Co wypełnia slot (ten sam indeks co `slots`), null = wolny. */
  filledBy: (Item | null)[];
  extra: Item[];
  coreDone: number;
}

/** Dopasowanie maksymalne treningów do slotów (jak weekPlan() we wzorcu). */
export function weekPlan(items: Item[], phaseId: PhaseId, light: boolean): WeekPlan {
  const all = RULES.slots_by_phase[phaseId];
  const slots = light ? all.slice(0, RULES.light_week_max_slots) : all;
  const units: { item: Item; alts: string[] }[] = [];
  for (const item of items) for (const alts of workoutMeta(item.workoutId)?.covers ?? []) units.push({ item, alts });
  units.sort((a, b) => a.alts.length - b.alts.length);
  const mU = units.map(() => -1);
  const mS = slots.map(() => -1);
  const trySlot = (si: number, seen: boolean[]): boolean => {
    for (let u = 0; u < units.length; u++) {
      if (seen[u] || !units[u].alts.includes(slots[si].c)) continue;
      seen[u] = true;
      if (mU[u] < 0 || trySlot(mU[u], seen)) {
        mU[u] = si;
        mS[si] = u;
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, si) => trySlot(si, []));
  const used = new Set(units.filter((_, i) => mU[i] >= 0).map((u) => u.item));
  const filledBy = mS.map((u) => (u >= 0 ? units[u].item : null));
  return {
    slots,
    filledBy,
    extra: items.filter((i) => !used.has(i) && i.workoutId !== null),
    coreDone: filledBy.slice(0, CORE_SLOTS).filter(Boolean).length,
  };
}

// ---------- propozycja ----------
export interface Context {
  date: string;
  phase: Phase;
  /** Zrobione (i zaplanowane) treningi: historia + plan. */
  items: Item[];
  /** Co jest pod ręką; null = nie filtruj. */
  equipment: Equipment[] | null;
  /** Dostępny czas w minutach; null = nie filtruj. */
  minutes: number | null;
  fasted?: boolean;
  legsHeavy?: boolean;
  morning?: { date: string; rhr?: number }[];
  rhrAlert?: number;
  lightWeeks?: LightWeek[];
}

export interface Pick {
  workoutId: string;
  slot: Category;
  /** Zakres minut dopasowany do dostępnego czasu. */
  minutes: [number, number] | null;
}

export interface Suggestion {
  pick: Pick | null;
  why: string;
  note?: string;
  alternatives: Pick[];
}

const EASY_AFTER_MOUNTAINS = ['b_easy', 'mob', 'walk'];

export function hasEquipment(w: WorkoutMeta, eq: Equipment[] | null): boolean {
  if (!eq) return true;
  const have = new Set<string>(eq);
  if (have.has('silownia')) have.add('schody_lub_bieznia');
  return w.equipment.every((e) => have.has(e));
}

function fitMinutes(w: WorkoutMeta, phase: Phase, minutes: number | null): { ok: boolean; range: [number, number] | null } {
  const r = w.minutes(phase);
  if (minutes === null || !r) return { ok: true, range: r };
  if (r[0] > minutes) return { ok: false, range: r };
  return { ok: true, range: [r[0], Math.min(r[1], minutes)] };
}

const metaOf = (i: Item) => workoutMeta(i.workoutId);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const whenText = (days: number) => (days === 0 ? 'dziś' : days === 1 ? 'wczoraj' : `${days} dni temu`);

export function suggest(ctx: Context): Suggestion {
  const { date, phase } = ctx;
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  // W tym tygodniu: zrobione + zaplanowane na inne dni (zaplanowane na ten dzień właśnie zastępujemy).
  const week = ctx.items.filter((i) => i.date >= monday && i.date <= sunday && !(i.planned && i.date === date));
  const light = !!lightWeekFor(date, ctx.lightWeeks ?? []);
  const plan = weekPlan(week, phase.id, light);
  const free = plan.slots.map((s, i) => ({ s, i })).filter(({ i }) => plan.filledBy[i] === null);

  if (free.length === 0) {
    return { pick: null, why: light ? 'Tydzień lżejszy jest już zrobiony. Odpocznij, żeby przyjechać wypoczętym.' : 'Wszystkie treningi tygodnia są zrobione. Odpocznij albo zrób coś lekkiego.', alternatives: [] };
  }

  // Zmęczenie: ostatni trening do dziś włącznie (bez planów na przyszłość).
  const past = ctx.items.filter((i) => i.date <= date && !(i.planned && i.date >= date) && metaOf(i));
  const last = [...past].sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastMeta = last ? metaOf(last) : undefined;
  const lastDays = last ? daysBetween(last.date, date) : 99;
  const tired = (!!lastMeta?.hard && lastDays <= 1) || !!ctx.legsHeavy;
  const near = (d: number) => ctx.items.filter((i) => i.date === addDays(date, d) && metaOf(i)?.legs === 'heavy');
  const heavyNear = near(-1).length > 0 || near(1).length > 0 || ctx.items.some((i) => i.date === date && !i.planned && metaOf(i)?.legs === 'heavy');
  // Jutro w planie coś mocnego: dziś bez mocnego, żeby nie było dwóch dzień po dniu.
  const hardTomorrow = ctx.items.some((i) => i.date === addDays(date, 1) && metaOf(i)?.hard);
  const heavyRecent = near(-1).length > 0 || ctx.items.some((i) => i.date === date && !i.planned && metaOf(i)?.legs === 'heavy');
  const afterMountains = ctx.items.some((i) => i.date === addDays(date, -1) && !i.planned && i.workoutId === 'm_day');
  const alert = ctx.rhrAlert ?? 50;
  const rhrOf = (d: string) => ctx.morning?.find((m) => m.date === d)?.rhr;
  const rhrHigh = [date, addDays(date, -1)].every((d) => (rhrOf(d) ?? 0) >= alert);

  // Rotacja w P2: podjazd siłowy i sweet spot na zmianę tydzień po tygodniu.
  const prevMon = addDays(monday, -7);
  const prevWeek = new Set(ctx.items.filter((i) => i.date >= prevMon && i.date < monday).map((i) => i.workoutId));
  const doneThisWeek = new Set(week.map((i) => i.workoutId));
  const ordered = (c: Category): string[] => {
    let list = [...(RULES.preferences_by_phase[phase.id][c] ?? [])];
    const demote = (id: string) => {
      if (list.includes(id)) list = [...list.filter((x) => x !== id), id];
    };
    if (phase.id === 'P2' && prevWeek.has('b_torque') && !prevWeek.has('b_sst')) demote('b_torque');
    if (phase.id === 'P2' && prevWeek.has('b_sst') && !prevWeek.has('b_torque')) demote('b_sst');
    return [...list.filter((x) => !doneThisWeek.has(x)), ...list.filter((x) => doneThisWeek.has(x))];
  };

  type Why = 'equipment' | 'time' | 'fatigue' | 'phase' | 'fasted';
  const reject = (w: WorkoutMeta): Why | null => {
    if (!w.rxText(phase) || !w.minutes(phase)) return 'phase';
    if (!hasEquipment(w, ctx.equipment)) return 'equipment';
    if (ctx.fasted && w.notFasted) return 'fasted';
    if (afterMountains && !EASY_AFTER_MOUNTAINS.includes(w.id)) return 'fatigue';
    if ((tired || rhrHigh || hardTomorrow) && w.hard) return 'fatigue';
    if (heavyNear && w.kind === 'bike' && w.hard) return 'fatigue';
    if (w.id === 'b_test' && heavyRecent) return 'fatigue';
    if (!fitMinutes(w, phase, ctx.minutes).ok) return 'time';
    return null;
  };

  const passing: { slot: Slot; picks: Pick[] }[] = [];
  const skipped: { slot: Slot; reasons: Set<Why>; firstFatigued?: WorkoutMeta }[] = [];
  const seenCat = new Set<Category>();
  for (const { s } of free) {
    if (seenCat.has(s.c)) continue;
    seenCat.add(s.c);
    const picks: Pick[] = [];
    const reasons = new Set<Why>();
    let firstFatigued: WorkoutMeta | undefined;
    for (const id of ordered(s.c)) {
      const w = workoutMeta(id);
      if (!w) continue;
      const r = reject(w);
      if (r) {
        reasons.add(r);
        if (r === 'fatigue' && !firstFatigued) firstFatigued = w;
      } else picks.push({ workoutId: id, slot: s.c, minutes: fitMinutes(w, phase, ctx.minutes).range });
    }
    if (picks.length) passing.push({ slot: s, picks });
    else skipped.push({ slot: s, reasons, firstFatigued });
  }

  if (passing.length === 0) {
    let why = 'Nic z planu tygodnia nie pasuje teraz do czasu i miejsca.';
    if (afterMountains) why = 'Dzień po górach: odpocznij, zrób mobilność albo spokojne rozkręcenie.';
    else if (rhrHigh) why = `Tętno spoczynkowe od dwóch dni jest wysokie (≥ ${alert}). Odpocznij albo zrób coś bardzo lekko.`;
    else if (tired && lastMeta) why = `Ostatni trening (${lastMeta.short}, ${whenText(lastDays)}) był mocny, a zostały tylko mocne. Zrób dzień przerwy.`;
    return { pick: null, why, alternatives: [] };
  }

  const first = passing[0];
  const pick = first.picks[0];
  const alternatives = [...first.picks.slice(1), ...passing.slice(1).map((p) => p.picks[0])].filter((p, i, a) => a.findIndex((x) => x.workoutId === p.workoutId) === i).slice(0, 4);

  const label = CATEGORY_LABEL[first.slot.c];
  const before = skipped.filter((s) => free.findIndex((f) => f.s === s.slot) < free.findIndex((f) => f.s === first.slot));
  const parts: string[] = [];
  // Dlaczego ważniejsze sloty odpadły (zmęczenie opisuje osobna notatka).
  const skippedText = before
    .filter((s) => !s.reasons.has('fatigue'))
    .map((s) => {
      const name = `„${CATEGORY_LABEL[s.slot.c]}”`;
      if (s.reasons.has('time')) return `${name} nie mieści się w czasie`;
      if (s.reasons.has('fasted')) return `${name} nie na czczo`;
      return `${name} wymaga sprzętu, którego teraz nie masz`;
    });
  if (skippedText.length) parts.push(`${skippedText.join('; ')}. ${label} to najważniejszy trening tygodnia możliwy teraz: ${lower(first.slot.why)}`);
  else parts.push(`${label}: ${lower(first.slot.why)}`);
  if (tired && lastMeta && !afterMountains) parts.push(`Ostatni trening (${lastMeta.short}, ${whenText(lastDays)}) był mocny, więc teraz spokojniej.`);
  if (afterMountains) parts.push('Dzień po górach tylko lekko.');
  if (rhrHigh) parts.push(`Tętno spoczynkowe od dwóch dni ≥ ${alert}: tylko spokojnie.`);

  const fatigued = before.find((s) => s.firstFatigued);
  const note = fatigued ? `„${CATEGORY_LABEL[fatigued.slot.c]}” (${fatigued.firstFatigued!.short}) lepiej zrobić innego dnia.` : undefined;

  return { pick, why: parts.join(' '), note, alternatives };
}

// ---------- kolejne dni ----------
export interface DayPlan {
  date: string;
  done: Item[];
  planned: Item[];
  suggestion: Suggestion | null;
}

/**
 * Plan na kolejne dni: dni z planem zostają, puste dostają propozycję.
 * Każda propozycja liczy się jako „zrobiona” przy układaniu następnych dni,
 * więc zamiana jednego kafelka przelicza resztę tygodnia.
 */
export function planDays(
  base: Omit<Context, 'date' | 'phase' | 'items' | 'fasted' | 'legsHeavy'>,
  opts: { from: string; days: number; done: Item[]; planned: Item[]; phaseFor: (date: string) => Phase },
): DayPlan[] {
  const virtual: Item[] = [...opts.done];
  const out: DayPlan[] = [];
  for (let k = 0; k < opts.days; k++) {
    const date = addDays(opts.from, k);
    const done = opts.done.filter((i) => i.date === date);
    const planned = opts.planned.filter((i) => i.date === date);
    if (planned.length) {
      virtual.push(...planned.filter((p) => p.workoutId).map((p) => ({ ...p, planned: false })));
      out.push({ date, done, planned, suggestion: null });
      continue;
    }
    if (done.length) {
      out.push({ date, done, planned, suggestion: null });
      continue;
    }
    const future = opts.planned.filter((p) => p.date > date);
    const s = suggest({ ...base, date, phase: opts.phaseFor(date), items: [...virtual, ...future], minutes: k === 0 ? base.minutes : null });
    if (s.pick) virtual.push({ date, workoutId: s.pick.workoutId });
    out.push({ date, done, planned, suggestion: s });
  }
  return out;
}

/** „Co teraz?”: zaplanowany na dziś trening, jeśli pasuje; inaczej propozycja z planera. */
export function nowSuggestion(ctx: Context, plannedToday: Item[]): Suggestion {
  for (const p of plannedToday) {
    const w = workoutMeta(p.workoutId);
    if (!w) continue;
    if (!hasEquipment(w, ctx.equipment)) continue;
    if (ctx.fasted && w.notFasted) continue;
    const fit = fitMinutes(w, ctx.phase, ctx.minutes);
    if (!fit.ok) continue;
    const rest = suggest(ctx);
    return {
      pick: { workoutId: w.id, slot: (w.covers[0]?.[0] as Category) ?? 'luz', minutes: fit.range },
      why: 'Zaplanowane na dziś.',
      alternatives: [rest.pick, ...rest.alternatives].filter((x): x is Pick => !!x && x.workoutId !== w.id).slice(0, 4),
    };
  }
  return suggest(ctx);
}
