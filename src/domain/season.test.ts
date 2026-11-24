import { describe, expect, it } from 'vitest';
import { SEASON } from './catalog';
import { currentPhase, daysBetween, nextEvent, phaseForDate, todayIso } from './season';

describe('sezon', () => {
  it('wybiera fazę po dacie', () => {
    expect(phaseForDate(SEASON.phases, '2026-11-24').id).toBe('P2');
    expect(phaseForDate(SEASON.phases, '2027-01-10').id).toBe('P3');
    expect(phaseForDate(SEASON.phases, '2020-01-01').id).toBe('P1');
    expect(phaseForDate(SEASON.phases, '2030-01-01').id).toBe('P5');
  });

  it('faza ręczna ma pierwszeństwo', () => {
    expect(currentPhase(SEASON.phases, '2026-11-24', 'P4').id).toBe('P4');
  });

  it('liczy dni do wydarzenia', () => {
    expect(daysBetween('2026-11-24', '2027-01-15')).toBe(52);
    expect(nextEvent(SEASON.events, '2026-11-24')?.event.id).toBe('kurs');
  });

  it('dzisiejsza data w strefie Warszawy', () => {
    // 23:30 UTC 24.11 to już 25.11 w Warszawie
    expect(todayIso(new Date('2026-11-24T23:30:00Z'))).toBe('2026-11-25');
  });
});
