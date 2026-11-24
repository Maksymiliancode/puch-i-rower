// Przypadki testowe z docs/04-logika-planowania.md, sekcja 4.
import { describe, expect, it } from 'vitest';
import { SEASON } from './catalog';
import { addDays, lightWeekFor, mondayOf, nowSuggestion, planDays, suggest, weekPlan, type Context, type Item } from './planner';
import { phaseForDate } from './season';
import type { Equipment } from './types';

const phase = (d: string) => phaseForDate(SEASON.phases, d);
const LIGHT = SEASON.light_weeks;

// Historia startowa (skrót) + kolejne dni z planu.
const HISTORY: Item[] = [
  { date: '2026-11-19', workoutId: 's_puch' },
  { date: '2026-11-20', workoutId: 'r_easy' },
  { date: '2026-11-21', workoutId: 's_upper' },
  { date: '2026-11-22', workoutId: null },
  { date: '2026-11-23', workoutId: null },
  { date: '2026-11-24', workoutId: 'b_intro' },
];

function ctx(date: string, items: Item[], equipment: Equipment[], minutes: number, extra: Partial<Context> = {}): Context {
  return { date, phase: phase(date), items, equipment, minutes, lightWeeks: LIGHT, rhrAlert: 50, ...extra };
}

describe('daty', () => {
  it('poniedziałek tygodnia i dodawanie dni', () => {
    expect(mondayOf('2026-11-25')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
  });
});

describe('plan tygodnia', () => {
  it('b_intro wypełnia „Spokojny tlen”, góry dwa sloty naraz', () => {
    const p = weekPlan([{ date: '2026-11-24', workoutId: 'b_intro' }], 'P2', false);
    expect(p.filledBy.filter(Boolean)).toHaveLength(1);
    expect(p.slots[p.filledBy.findIndex(Boolean)].c).toBe('luz');
    const m = weekPlan([{ date: '2026-11-28', workoutId: 'm_day' }], 'P2', false);
    expect(m.coreDone).toBe(2);
  });

  it('siłownia góra nie wypełnia slotów, ale jest „dodatkowo”', () => {
    const p = weekPlan([{ date: '2026-11-21', workoutId: 's_upper' }], 'P1', false);
    expect(p.filledBy.every((x) => x === null)).toBe(true);
    expect(p.extra).toHaveLength(1);
  });

  it('7. tydzień 11–17.01.2027 nachodzi na lżejszy 8–14.01: najwyżej 4 sloty', () => {
    expect(lightWeekFor('2027-01-11', LIGHT)?.reason).toBe('przed kursem lawinowym');
    const p = weekPlan([], phase('2027-01-11').id, !!lightWeekFor('2027-01-11', LIGHT));
    expect(p.slots).toHaveLength(4);
  });
});

describe('co teraz', () => {
  it('1. śr 25.11, 90 min, tylko Keiser → b_z2 (siła nóg odpada przez brak siłowni)', () => {
    const s = suggest(ctx('2026-11-25', HISTORY, ['keiser_m3'], 90));
    expect(s.pick?.workoutId).toBe('b_z2');
    expect(s.pick?.slot).toBe('dlugi');
    expect(s.why).toContain('Siła nóg');
  });

  it('2. czw 26.11, 75 min, siłownia → s_puch', () => {
    const items = [...HISTORY, { date: '2026-11-25', workoutId: 'b_z2' }];
    const s = suggest(ctx('2026-11-26', items, ['silownia'], 75));
    expect(s.pick?.workoutId).toBe('s_puch');
    expect(phase('2026-11-26').strength_rx).toBe('f2');
  });

  it('3. pt 27.11, 45 min, bez sprzętu, wczoraj s_puch → r_easy skrócony do 45, podbiegi innego dnia', () => {
    const items = [...HISTORY, { date: '2026-11-25', workoutId: 'b_z2' }, { date: '2026-11-26', workoutId: 's_puch' }];
    const s = suggest(ctx('2026-11-27', items, [], 45));
    expect(s.pick?.workoutId).toBe('r_easy');
    expect(s.pick?.minutes).toEqual([40, 45]);
    expect(s.note).toContain('Podbiegi');
  });

  it('4. pn 30.11, 60 min, tylko Keiser → b_torque', () => {
    const items = [...HISTORY, { date: '2026-11-25', workoutId: 'b_z2' }, { date: '2026-11-26', workoutId: 's_puch' }, { date: '2026-11-27', workoutId: 'walk' }];
    const s = suggest(ctx('2026-11-30', items, ['keiser_m3'], 60));
    expect(s.pick?.workoutId).toBe('b_torque');
  });

  it('4b. rotacja P2: po podjeździe siłowym w poprzednim tygodniu → sweet spot', () => {
    const items = [{ date: '2026-11-30', workoutId: 'b_torque' }];
    const s = suggest(ctx('2026-12-08', items, ['keiser_m3'], 70, { items: [...items, { date: '2026-12-07', workoutId: 'b_easy' }] }));
    const intervals = [s.pick, ...s.alternatives].find((p) => p?.slot === 'mocny');
    expect(intervals?.workoutId).toBe('b_sst');
  });

  it('5. śr 2.12, 60 min, Keiser: zaplanowany test → b_test; na czczo test ukryty', () => {
    const items: Item[] = [{ date: '2026-11-30', workoutId: 'b_torque' }];
    const planned: Item[] = [{ date: '2026-12-02', workoutId: 'b_test', planned: true }];
    const fed = nowSuggestion(ctx('2026-12-02', [...items, ...planned], ['keiser_m3'], 60), planned);
    expect(fed.pick?.workoutId).toBe('b_test');
    const fasted = nowSuggestion(ctx('2026-12-02', [...items, ...planned], ['keiser_m3'], 60, { fasted: true }), planned);
    expect(fasted.pick?.workoutId).not.toBe('b_test');
    // Na czczo odpadają treningi z not_fasted (mocny rower); zostaje coś, co można zrobić bez śniadania.
    for (const p of [fasted.pick, ...fasted.alternatives]) expect(['b_test', 'b_torque', 'b_sst', 'b_vo2']).not.toContain(p?.workoutId);
  });

  it('6. dzień po s_puch, Keiser, 60 min → spokojnie (bez mocnego roweru)', () => {
    const items: Item[] = [{ date: '2026-12-03', workoutId: 's_puch' }];
    const s = suggest(ctx('2026-12-04', items, ['keiser_m3'], 60));
    expect(['b_easy', 'b_z2']).toContain(s.pick?.workoutId);
    for (const a of [s.pick, ...s.alternatives]) expect(['b_sst', 'b_vo2', 'b_torque', 'b_test']).not.toContain(a?.workoutId);
  });

  it('8. tętno spoczynkowe 51 i 52 dwa dni z rzędu → tylko spokojne', () => {
    const morning = [
      { date: '2026-12-08', rhr: 51 },
      { date: '2026-12-09', rhr: 52 },
    ];
    const s = suggest(ctx('2026-12-09', [], ['keiser_m3', 'silownia'], 120, { morning }));
    expect(s.pick).not.toBeNull();
    expect(['s_puch', 'b_torque', 'b_sst', 'b_vo2', 'r_hills', 'm_day']).not.toContain(s.pick?.workoutId);
    for (const a of s.alternatives) expect(['s_puch', 'b_torque', 'b_sst', 'b_vo2', 'r_hills']).not.toContain(a.workoutId);
  });

  it('dzień przed zaplanowanym mocnym treningiem: bez mocnego', () => {
    const items: Item[] = [{ date: '2026-11-30', workoutId: 'b_torque', planned: true }];
    const s = suggest(ctx('2026-11-29', items, ['keiser_m3', 'silownia'], 120));
    for (const p of [s.pick, ...s.alternatives]) expect(['s_puch', 's_short', 'b_torque', 'b_sst', 'b_vo2', 'r_hills']).not.toContain(p?.workoutId);
  });

  it('dzień po górach: tylko rozkręcenie, mobilność albo spacer', () => {
    const s = suggest(ctx('2026-12-06', [{ date: '2026-12-05', workoutId: 'm_day' }], ['keiser_m3', 'silownia'], 120));
    expect(['b_easy', 'mob', 'walk']).toContain(s.pick?.workoutId);
  });
});

describe('kolejne dni', () => {
  it('układa tydzień bez dwóch mocnych dzień po dniu i bez mocnego roweru obok Nóg na puch', () => {
    const days = planDays(
      { equipment: ['keiser_m3', 'silownia', 'schody_lub_bieznia'], minutes: null, lightWeeks: LIGHT, rhrAlert: 50 },
      { from: '2026-11-30', days: 7, done: [{ date: '2026-11-26', workoutId: 's_puch' }], planned: [], phaseFor: phase },
    );
    expect(days).toHaveLength(7);
    const ids = days.map((d) => d.suggestion?.pick?.workoutId ?? null);
    expect(ids).toContain('s_puch');
    for (let i = 1; i < ids.length; i++) {
      const a = ids[i - 1];
      const b = ids[i];
      const hard = (x: string | null) => ['s_puch', 's_short', 'b_torque', 'b_sst', 'b_vo2', 'r_hills', 'm_day'].includes(x ?? '');
      expect(hard(a) && hard(b)).toBe(false);
    }
  });

  it('zaplanowany dzień zostaje, a reszta się do niego dopasowuje', () => {
    const days = planDays(
      { equipment: ['keiser_m3', 'silownia'], minutes: null, lightWeeks: LIGHT, rhrAlert: 50 },
      { from: '2026-11-30', days: 3, done: [], planned: [{ date: '2026-12-01', workoutId: 's_puch', planned: true }], phaseFor: phase },
    );
    expect(days[1].planned[0].workoutId).toBe('s_puch');
    // Dzień przed Nogami na puch: bez mocnego roweru; dzień po: spokojnie.
    expect(['b_torque', 'b_sst', 'b_vo2']).not.toContain(days[0].suggestion?.pick?.workoutId);
    expect(['b_torque', 'b_sst', 'b_vo2', 's_short']).not.toContain(days[2].suggestion?.pick?.workoutId);
  });
});
