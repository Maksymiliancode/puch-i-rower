import { describe, expect, it } from 'vitest';
import { adjust, advance, createTimer, next, pause, prev, start, view } from './timer';

const T0 = 1_000_000;
const s = (sec: number) => sec * 1000;

describe('timer', () => {
  it('odlicza na znacznikach czasu', () => {
    const t = start(createTimer([60, 30]), T0);
    const v = view(t, T0 + s(20));
    expect(v.segLeftSec).toBe(40);
    expect(v.totalElapsedSec).toBe(20);
    expect(v.totalLeftSec).toBe(70);
  });

  it('pauza zatrzymuje upływ czasu, wznowienie kontynuuje', () => {
    let t = start(createTimer([60]), T0);
    t = pause(t, T0 + s(10));
    expect(view(t, T0 + s(500)).segElapsedSec).toBe(10);
    t = start(t, T0 + s(500));
    expect(view(t, T0 + s(505)).segElapsedSec).toBe(15);
  });

  it('po powrocie z tła przeskakuje tyle segmentów, ile minęło', () => {
    const t = start(createTimer([60, 30, 30, 60]), T0);
    const r = advance(t, T0 + s(130));
    expect(r.crossed).toBe(3);
    expect(r.state.idx).toBe(3);
    expect(view(r.state, T0 + s(130)).segElapsedSec).toBe(10);
  });

  it('kończy trening po ostatnim segmencie', () => {
    const t = start(createTimer([10, 10]), T0);
    const r = advance(t, T0 + s(25));
    expect(r.finished).toBe(true);
    expect(r.state.done).toBe(true);
    expect(view(r.state, T0 + s(25)).totalLeftSec).toBe(0);
  });

  it('Wstecz: do 5 s poprzedni segment, później początek bieżącego', () => {
    let t = start(createTimer([60, 60]), T0);
    t = next(t, T0 + s(10));
    expect(prev(t, T0 + s(13)).idx).toBe(0);
    const restarted = prev(t, T0 + s(30));
    expect(restarted.idx).toBe(1);
    expect(view(restarted, T0 + s(30)).segElapsedSec).toBe(0);
  });

  it('−1 min nie skraca poniżej upłynęło + 5 s', () => {
    let t = start(createTimer([120]), T0);
    t = adjust(t, T0 + s(100), -60);
    expect(t.durations[0]).toBe(105);
    t = adjust(t, T0 + s(100), 60);
    expect(t.durations[0]).toBe(165);
  });

  it('Dalej na ostatnim segmencie kończy trening', () => {
    const t = start(createTimer([10]), T0);
    expect(next(t, T0 + s(1)).done).toBe(true);
  });

  it('stan da się zserializować i odtworzyć', () => {
    const t = start(createTimer([60, 60]), T0);
    const restored = JSON.parse(JSON.stringify(t));
    expect(advance(restored, T0 + s(70)).state.idx).toBe(1);
  });
});
