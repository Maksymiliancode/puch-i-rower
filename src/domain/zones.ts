// Strefy i cele segmentu timera. Reguły z data/zones.json:
//  pct_to_zone_rule, rounding, timer_target_rule.
import zonesJson from '../../data/zones.json';
import type { Segment } from './types';

export type ZoneId = 'z1' | 'z2' | 'tempo' | 'sst' | 'thr' | 'vo2' | 'sprint' | 'z2lo';

export interface Zone {
  name: string;
  pct_ftp: [number, number];
  pct_lthr: [number, number] | null;
  feel: string;
  color_token: string;
}

export const ZONES = zonesJson.zones as unknown as Record<ZoneId, Zone>;

/** p<=60 → z1; p<=75 → z2; p<=87 → tempo; p<=94 → sst; p<=102 → thr; p<=140 → vo2; wyżej → sprint */
export function zoneOfPct(p: number): ZoneId {
  if (p <= 60) return 'z1';
  if (p <= 75) return 'z2';
  if (p <= 87) return 'tempo';
  if (p <= 94) return 'sst';
  if (p <= 102) return 'thr';
  if (p <= 140) return 'vo2';
  return 'sprint';
}

/** Waty zaokrąglane do 5 W. */
export const watts = (ftp: number, pct: number) => Math.round((ftp * pct) / 100 / 5) * 5;
/** Tętno zaokrąglane do całości. */
export const bpm = (lthr: number, pct: number) => Math.round((lthr * pct) / 100);

export type PowerTarget =
  | { kind: 'range'; lo: number; hi: number; unit: 'W' | '%FTP' }
  | { kind: 'max' };

export type HrTarget =
  | { kind: 'range'; lo: number; hi: number }
  | { kind: 'above'; value: number }
  | { kind: 'none' };

export type MetricId = 'power' | 'hr' | 'cadence';

export interface SegmentTarget {
  zone: ZoneId;
  power: PowerTarget;
  hr: HrTarget;
  cadence: string;
  /** Metryka wyróżniona na ekranie timera. */
  primary: MetricId;
}

/** Najwyższa liczba w zapisie kadencji, np. "55–65" → 65, "90" → 90, "100+" → 100. */
export function cadenceMax(cad: string): number | null {
  const nums = cad.match(/\d+/g);
  if (!nums) return null;
  return Math.max(...nums.map(Number));
}

/** Niska kadencja (podjazd siłowy) → kadencja jest główną metryką. */
export const LOW_CADENCE_MAX = 75;

export function segmentTarget(seg: Segment, ftp: number | null, lthr: number): SegmentTarget {
  const zone = zoneOfPct(seg.pct_ftp);
  const z = ZONES[zone];

  let power: PowerTarget;
  if (zone === 'sprint') {
    power = { kind: 'max' };
  } else {
    const lo = seg.pct_ftp <= 102 ? z.pct_ftp[0] : seg.pct_ftp - 4;
    const hi = seg.pct_ftp <= 102 ? z.pct_ftp[1] : seg.pct_ftp + 4;
    power = ftp ? { kind: 'range', lo: watts(ftp, lo), hi: watts(ftp, hi), unit: 'W' } : { kind: 'range', lo, hi, unit: '%FTP' };
  }

  let hr: HrTarget;
  if (seg.sec < 60 || zone === 'sprint' || !z.pct_lthr) hr = { kind: 'none' };
  else if (zone === 'vo2') hr = { kind: 'above', value: bpm(lthr, 100) };
  else hr = { kind: 'range', lo: bpm(lthr, z.pct_lthr[0]), hi: bpm(lthr, z.pct_lthr[1]) };

  const cmax = cadenceMax(seg.cadence);
  const primary: MetricId = cmax !== null && cmax < LOW_CADENCE_MAX ? 'cadence' : 'power';

  return { zone, power, hr, cadence: seg.cadence, primary };
}

/** Kolor strefy jako zmienna CSS (definicje w styles/tokens.css). */
export const zoneVar = (zone: ZoneId) => `var(--zone-${zone})`;
