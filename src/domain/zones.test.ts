import { describe, expect, it } from 'vitest';
import { cadenceMax, segmentTarget, watts, zoneOfPct } from './zones';
import type { Segment } from './types';

const seg = (p: Partial<Segment>): Segment => ({ sec: 360, pct_ftp: 82, label: 'x', cadence: '90', ...p });

describe('zoneOfPct', () => {
  it.each([
    [55, 'z1'], [60, 'z1'], [61, 'z2'], [75, 'z2'], [82, 'tempo'], [87, 'tempo'],
    [90, 'sst'], [94, 'sst'], [100, 'thr'], [102, 'thr'], [110, 'vo2'], [140, 'vo2'], [150, 'sprint'],
  ])('%i%% → %s', (p, z) => expect(zoneOfPct(p)).toBe(z));
});

describe('watts', () => {
  it('zaokrągla do 5 W', () => {
    expect(watts(290, 76)).toBe(220);
    expect(watts(290, 87)).toBe(250);
    expect(watts(290, 55)).toBe(160);
  });
});

describe('cadenceMax', () => {
  it('czyta różne zapisy', () => {
    expect(cadenceMax('55–65')).toBe(65);
    expect(cadenceMax('90')).toBe(90);
    expect(cadenceMax('100+')).toBe(100);
    expect(cadenceMax('dowolna')).toBeNull();
  });
});

describe('segmentTarget', () => {
  it('podjazd siłowy: zakres strefy tempo w W, kadencja jako główna metryka', () => {
    const t = segmentTarget(seg({ pct_ftp: 82, cadence: '55–65' }), 290, 163);
    expect(t.zone).toBe('tempo');
    expect(t.power).toEqual({ kind: 'range', lo: 220, hi: 250, unit: 'W' });
    expect(t.hr).toEqual({ kind: 'range', lo: 140, hi: 150 });
    expect(t.primary).toBe('cadence');
  });

  it('powyżej 102% pokazuje p±4%', () => {
    const t = segmentTarget(seg({ pct_ftp: 115, cadence: '95–105', sec: 240 }), 290, 163);
    expect(t.power).toEqual({ kind: 'range', lo: watts(290, 111), hi: watts(290, 119), unit: 'W' });
    expect(t.hr).toEqual({ kind: 'above', value: 163 });
    expect(t.primary).toBe('power');
  });

  it('krótki segment: „nie patrz” na tętno; sprint: na maksa', () => {
    expect(segmentTarget(seg({ sec: 30, pct_ftp: 120 }), 290, 163).hr).toEqual({ kind: 'none' });
    const s = segmentTarget(seg({ sec: 10, pct_ftp: 200 }), 290, 163);
    expect(s.power).toEqual({ kind: 'max' });
    expect(s.hr).toEqual({ kind: 'none' });
  });

  it('bez FTP pokazuje % FTP', () => {
    expect(segmentTarget(seg({ pct_ftp: 70 }), null, 163).power).toEqual({ kind: 'range', lo: 56, hi: 75, unit: '%FTP' });
  });

  it('zmiana FTP przelicza waty', () => {
    const a = segmentTarget(seg({ pct_ftp: 70 }), 290, 163).power;
    const b = segmentTarget(seg({ pct_ftp: 70 }), 300, 163).power;
    expect(a).not.toEqual(b);
  });
});
