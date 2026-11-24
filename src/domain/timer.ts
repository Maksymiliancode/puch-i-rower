// Silnik timera: czyste funkcje na znacznikach czasu (ms od epoki), bez zliczania tyknięć.
// Dzięki temu stan da się zapisać, a po powrocie z tła lub po ponownym otwarciu
// aplikacji timer wraca we właściwe miejsce (przeskakuje minione segmenty).

export interface TimerState {
  /** Długości segmentów w sekundach (zmieniane przez −1 / +1 min). */
  durations: number[];
  idx: number;
  /** Czas, który upłynął w bieżącym segmencie przed `resumedAt`. */
  accMs: number;
  /** Kiedy ostatnio wznowiono (ms od epoki); null = zatrzymany. */
  resumedAt: number | null;
  started: boolean;
  done: boolean;
}

export function createTimer(durations: number[]): TimerState {
  if (durations.length === 0) throw new Error('Trening bez segmentów');
  return { durations: [...durations], idx: 0, accMs: 0, resumedAt: null, started: false, done: false };
}

export const isRunning = (s: TimerState) => s.resumedAt !== null;

export function segElapsedMs(s: TimerState, now: number): number {
  return s.accMs + (s.resumedAt !== null ? Math.max(0, now - s.resumedAt) : 0);
}

export function start(s: TimerState, now: number): TimerState {
  if (s.done || isRunning(s)) return s;
  return { ...s, started: true, resumedAt: now };
}

export function pause(s: TimerState, now: number): TimerState {
  if (!isRunning(s)) return s;
  return { ...s, accMs: segElapsedMs(s, now), resumedAt: null };
}

function finish(s: TimerState): TimerState {
  const last = s.durations.length - 1;
  return { ...s, idx: last, accMs: s.durations[last] * 1000, resumedAt: null, done: true, started: true };
}

export function jumpTo(s: TimerState, i: number, now: number): TimerState {
  if (s.done) return s;
  if (i >= s.durations.length) return finish(s);
  return { ...s, idx: Math.max(0, i), accMs: 0, resumedAt: isRunning(s) ? now : null };
}

export const next = (s: TimerState, now: number) => jumpTo(s, s.idx + 1, now);

/** Wstecz: w pierwszych 5 s segmentu idzie do poprzedniego, później na początek bieżącego. */
export function prev(s: TimerState, now: number): TimerState {
  return segElapsedMs(s, now) > 5000 ? jumpTo(s, s.idx, now) : jumpTo(s, s.idx - 1, now);
}

/** Zmienia długość bieżącego segmentu; nie mniej niż upłynęło + 5 s. */
export function adjust(s: TimerState, now: number, deltaSec: number): TimerState {
  if (s.done) return s;
  const el = Math.ceil(segElapsedMs(s, now) / 1000);
  const durations = [...s.durations];
  durations[s.idx] = Math.max(el + 5, durations[s.idx] + deltaSec);
  return { ...s, durations };
}

export interface AdvanceResult {
  state: TimerState;
  /** Ile granic segmentów minęło od poprzedniego wywołania. */
  crossed: number;
  finished: boolean;
}

/** Przesuwa timer do bieżącej chwili. Obsługuje telefon, który „przespał” kilka zmian. */
export function advance(s: TimerState, now: number): AdvanceResult {
  if (!isRunning(s) || s.done) return { state: s, crossed: 0, finished: false };
  let el = segElapsedMs(s, now);
  let idx = s.idx;
  let crossed = 0;
  while (el >= s.durations[idx] * 1000) {
    el -= s.durations[idx] * 1000;
    idx++;
    crossed++;
    if (idx >= s.durations.length) return { state: finish(s), crossed, finished: true };
  }
  if (crossed === 0) return { state: s, crossed: 0, finished: false };
  return { state: { ...s, idx, accMs: el, resumedAt: now }, crossed, finished: false };
}

export interface TimerView {
  idx: number;
  segDurSec: number;
  segElapsedSec: number;
  segLeftSec: number;
  totalSec: number;
  totalElapsedSec: number;
  totalLeftSec: number;
}

export function view(s: TimerState, now: number): TimerView {
  const segDurSec = s.durations[s.idx];
  const segElapsedSec = Math.min(segDurSec, segElapsedMs(s, now) / 1000);
  const totalSec = s.durations.reduce((a, d) => a + d, 0);
  const before = s.durations.slice(0, s.idx).reduce((a, d) => a + d, 0);
  const totalElapsedSec = Math.min(totalSec, before + segElapsedSec);
  return {
    idx: s.idx,
    segDurSec,
    segElapsedSec,
    segLeftSec: Math.max(0, segDurSec - segElapsedSec),
    totalSec,
    totalElapsedSec,
    totalLeftSec: Math.max(0, totalSec - totalElapsedSec),
  };
}
