import type { Segment } from './types';
import type { HrTarget, PowerTarget } from './zones';

/** Sekundy → "m:ss" albo "h:mm:ss". Zaokrągla w górę, żeby odliczanie kończyło się na 0:01 → 0:00. */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec - 1e-6));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(x).padStart(2, '0')}`;
}

/** 360 → "6 min", 90 → "1 min 30 s", 30 → "30 s". */
export function duration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function powerText(p: PowerTarget): { value: string; unit: string } {
  if (p.kind === 'max') return { value: 'Na maksa', unit: '' };
  return { value: `${p.lo}–${p.hi}`, unit: p.unit === 'W' ? 'W' : '% FTP' };
}

export function hrText(h: HrTarget): { value: string; unit: string } {
  if (h.kind === 'none') return { value: 'Nie patrz', unit: '' };
  if (h.kind === 'above') return { value: `>${h.value}`, unit: 'bpm' };
  return { value: `${h.lo}–${h.hi}`, unit: 'bpm' };
}

/** „Powtórzenie 2 z 4”, „Seria 1 z 3 · po powtórzeniu 5 z 13”. */
export function repText(seg: Segment): string {
  const parts: string[] = [];
  if (seg.set) parts.push(`Seria ${seg.set[0]} z ${seg.set[1]}`);
  if (seg.rep) parts.push(seg.after_rep ? `po powtórzeniu ${seg.rep[0]} z ${seg.rep[1]}` : `Powtórzenie ${seg.rep[0]} z ${seg.rep[1]}`);
  return parts.join(' · ');
}

/** Przerwa dłuższa niż 45 s → przypomnienie o zerowaniu Keisera. */
export function isLongRest(seg: Segment): boolean {
  const restLike = seg.after_rep === true || /przerwa|odpoczynek/i.test(seg.label);
  return restLike && seg.sec > 45;
}

export const KEISER_REST_HINT = 'Kręć lekko, Keiser zeruje się po minucie bez pedałowania';

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });
export const prettyDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`));

const plural = (n: number, one: string, few: string, many: string) => {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};
export const daysText = (n: number) => `${n} ${plural(n, 'dzień', 'dni', 'dni')}`;
export const minutesText = (n: number) => `${n} ${plural(n, 'minuta', 'minuty', 'minut')}`;
export const secondsText = (n: number) => `${n} ${plural(n, 'sekunda', 'sekundy', 'sekund')}`;
