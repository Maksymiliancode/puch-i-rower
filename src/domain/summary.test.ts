import { describe, expect, it } from 'vitest';
import { hoursText, summarize, trainingsText } from './summary';
import type { Session } from './types';

const s = (date: string, workoutId: string | null, kind: Session['kind'], durationMin?: number): Session => ({
  id: `${date}-${workoutId}`,
  date,
  workoutId,
  kind,
  title: 't',
  phase: 'P2',
  durationMin,
  source: 'manual',
  createdAt: date,
  updatedAt: date,
});

describe('podsumowanie', () => {
  const list = [
    s('2026-11-19', 's_puch', 'strength', 70),
    s('2026-11-20', 'r_easy', 'run', 59),
    s('2026-11-21', 's_upper', 'strength_upper'),
    s('2026-11-22', null, 'rest'),
    s('2026-11-24', 'b_intro', 'bike', 54),
    s('2026-11-24', 'mob', 'mobility', 20),
    s('2026-11-26', 's_puch', 'strength', 65),
    s('2026-12-01', 'b_z2', 'bike', 100),
  ];

  it('liczy rodzaje w okresie, bez dni wolnych', () => {
    const r = summarize(list, '2026-11-01', '2026-11-30');
    expect(r.count).toBe(6);
    expect(r.activeDays).toBe(5);
    expect(r.minutes).toBe(70 + 59 + 54 + 20 + 65);
    expect(r.byFamily.map((f) => [f.fam, f.count])).toEqual([
      ['legs', 2],
      ['upper', 1],
      ['bike', 1],
      ['run', 1],
      ['easy', 1],
    ]);
  });

  it('teksty', () => {
    expect(hoursText(580)).toBe('9 h 40 min');
    expect(hoursText(45)).toBe('45 min');
    expect(hoursText(120)).toBe('2 h');
    expect(trainingsText(1)).toBe('1 trening');
    expect(trainingsText(3)).toBe('3 treningi');
    expect(trainingsText(12)).toBe('12 treningów');
    expect(trainingsText(22)).toBe('22 treningi');
  });
});
