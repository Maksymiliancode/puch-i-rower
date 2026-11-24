import { describe, expect, it } from 'vitest';
import { BIKE_WORKOUTS, SEASON, workoutZone } from './catalog';
import { ZONES } from './zones';
import type { BikeRxKey } from './types';

const RX_KEYS: BikeRxKey[] = ['sm', 'ss', 'pr', 'la'];

describe('katalog treningów rowerowych', () => {
  it('ma unikalne id', () => {
    const ids = BIKE_WORKOUTS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const w of BIKE_WORKOUTS) {
    describe(w.id, () => {
      it('ma co najmniej jedną wersję rx o znanym kluczu', () => {
        const keys = Object.keys(w.rx);
        expect(keys.length).toBeGreaterThan(0);
        for (const k of keys) expect(RX_KEYS).toContain(k);
      });

      it('segmenty są poprawne', () => {
        for (const [key, rx] of Object.entries(w.rx)) {
          expect(rx, key).toBeDefined();
          for (const seg of rx!.segments) {
            expect(seg.sec, `${key} ${seg.label}`).toBeGreaterThan(0);
            expect(seg.pct_ftp).toBeGreaterThan(0);
            expect(seg.label.length).toBeGreaterThan(0);
            expect(typeof seg.cadence).toBe('string');
            if (seg.rep) expect(seg.rep[0]).toBeLessThanOrEqual(seg.rep[1]);
            if (seg.set) expect(seg.set[0]).toBeLessThanOrEqual(seg.set[1]);
          }
        }
      });

      it('strefa treningu istnieje w zones.json', () => {
        for (const key of Object.keys(w.rx) as BikeRxKey[]) {
          expect(Object.keys(ZONES)).toContain(workoutZone(w, key));
        }
      });
    });
  }
});

describe('sezon', () => {
  it('fazy są ciągłe i wskazują istniejące rx', () => {
    const p = [...SEASON.phases].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < p.length; i++) {
      const prevEnd = new Date(`${p[i - 1].end}T00:00:00Z`).getTime();
      const start = new Date(`${p[i].start}T00:00:00Z`).getTime();
      expect(start - prevEnd).toBe(86_400_000);
    }
    for (const ph of p) expect(RX_KEYS).toContain(ph.bike_rx);
  });
});
