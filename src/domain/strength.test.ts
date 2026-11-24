import { describe, expect, it } from 'vitest';
import { fullPlan, holdSec, isTimed, lastSets, repsHint, restSec, setsCount, setsSummary, shortPlan } from './strength';
import type { Session } from './types';

describe('odczyt opisów serii', () => {
  it('liczba serii', () => {
    expect(setsCount('4 × 4–6, ciężko')).toBe(4);
    expect(setsCount('3 × 8 na nogę + 1 seria tylną nogą')).toBe(4);
    expect(setsCount('2–3 serie każdego ćwiczenia, ciężko')).toBe(3);
  });

  it('przerwa', () => {
    expect(restSec('90 s')).toBe(90);
    expect(restSec('2–3 min')).toBe(120);
    expect(restSec('60–90 s po parze')).toBe(60);
    expect(restSec('w parze z ćwiczeniem 6')).toBeNull();
  });

  it('trzymanie na czas i powtórzenia', () => {
    expect(isTimed('3 × 60 s')).toBe(true);
    expect(isTimed('3 × 2–3 min, możesz trzymać hantle')).toBe(true);
    expect(isTimed('4 × 6 na stronę')).toBe(false);
    expect(holdSec('3 × 2–3 min, możesz trzymać hantle')).toBe(120);
    expect(repsHint('4 × 4–6, ciężko')).toBe('4–6');
  });
});

describe('plan sesji', () => {
  it('pełny trening ma 8 ćwiczeń z seriami dla każdej fazy', () => {
    for (const k of ['f1', 'f2', 'f3'] as const) {
      const plan = fullPlan(k);
      expect(plan).toHaveLength(8);
      plan.forEach((p) => expect(p.sets).toBeGreaterThan(0));
    }
    const f2 = fullPlan('f2');
    expect(f2.find((p) => p.id === 'squat')?.sets).toBe(4);
    expect(f2.find((p) => p.id === 'stance')?.timed).toBe(true);
    expect(f2.find((p) => p.id === 'stepup')?.restSec).toBeNull();
  });

  it('krótka siła dopasowuje ćwiczenia po nazwie', () => {
    const plan = shortPlan('f2');
    expect(plan.map((p) => p.id).slice(0, 4)).toEqual(['bulgarian', 'stepdown', 'nordic', 'stance']);
    expect(plan[4].animation).toBeUndefined();
    expect(plan[0].sets).toBe(3);
  });
});

describe('poprzednie wyniki', () => {
  const s = (date: string, kg: number): Session => ({
    id: date,
    date,
    workoutId: 's_puch',
    kind: 'strength',
    title: 'Nogi',
    phase: 'P2',
    source: 'app',
    createdAt: date,
    updatedAt: date,
    strength: { exercises: [{ id: 'squat', sets: [{ kg, reps: 5 }, {}], done: true }] },
  });

  it('bierze najnowszy wpis z wypełnionymi seriami', () => {
    const r = lastSets([s('2026-11-26', 60), s('2026-12-04', 65)], 'squat');
    expect(r?.date).toBe('2026-12-04');
    expect(setsSummary(r!.sets)).toBe('65 kg × 5');
    expect(lastSets([s('2026-11-26', 60)], 'rdl')).toBeNull();
  });
});
