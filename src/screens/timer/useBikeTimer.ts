import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import * as engine from '../../domain/timer';
import type { TimerState } from '../../domain/timer';
import type { BikeRxKey, Segment } from '../../domain/types';
import type { MetricId, SegmentTarget } from '../../domain/zones';
import { resumeAudio, sounds, unlockAudio } from '../../lib/audio';
import { announce, preloadAnnouncements, stopSpeech } from '../../lib/speech';
import { loadTimer, saveTimer } from '../../lib/timerStore';
import { lockScreen, releaseScreen } from '../../lib/wakeLock';

interface State {
  timer: TimerState;
  now: number;
  /** Ile sekund faktycznie przejechano, gdy trening się skończył (także przy wcześniejszym zakończeniu). */
  elapsedAtEnd: number | null;
  startedAt: string | null;
}

type Action =
  | { type: 'tick' | 'start' | 'pause' | 'next' | 'prev' | 'end'; now: number }
  | { type: 'adjust'; now: number; delta: number };

function withEnd(prev: State, timer: TimerState, now: number): State {
  if (timer.done && !prev.timer.done) {
    const elapsed = engine.view(prev.timer, now).totalElapsedSec;
    return { ...prev, timer, now, elapsedAtEnd: elapsed };
  }
  return { ...prev, timer, now };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'tick':
      return withEnd(s, engine.advance(s.timer, a.now).state, a.now);
    case 'start':
      return { ...s, timer: engine.start(s.timer, a.now), now: a.now, startedAt: s.startedAt ?? new Date(a.now).toISOString() };
    case 'pause':
      return { ...s, timer: engine.pause(s.timer, a.now), now: a.now };
    case 'next':
      return withEnd(s, engine.next(s.timer, a.now), a.now);
    case 'prev':
      return { ...s, timer: engine.prev(s.timer, a.now), now: a.now };
    case 'end':
      return withEnd(s, engine.jumpTo(s.timer, s.timer.durations.length, a.now), a.now);
    case 'adjust':
      return { ...s, timer: engine.adjust(s.timer, a.now, a.delta), now: a.now };
  }
}

const TICK_MS = 200;

export function useBikeTimer(opts: {
  workoutId: string;
  rxKey: BikeRxKey;
  segments: Segment[];
  targetOf: (seg: Segment) => SegmentTarget;
  sound: boolean;
  voice: boolean;
}) {
  const { workoutId, rxKey, segments, targetOf, sound, voice } = opts;

  const [restored] = useState(() => {
    const saved = loadTimer();
    if (saved && saved.workoutId === workoutId && saved.rxKey === rxKey && saved.state.durations.length === segments.length) return saved;
    return null;
  });

  const [state, dispatch] = useReducer(reducer, null, (): State => {
    const now = Date.now();
    if (restored) {
      const timer = engine.advance(restored.state, now).state;
      return { timer, now, elapsedAtEnd: timer.done ? engine.view(restored.state, now).totalElapsedSec : null, startedAt: restored.startedAt ?? null };
    }
    return { timer: engine.createTimer(segments.map((s) => s.sec)), now, elapsedAtEnd: null, startedAt: null };
  });

  const [primary, setPrimary] = useState<MetricId | null>(restored?.primary ?? null);
  const [wakeOk, setWakeOk] = useState<boolean | null>(null);
  const running = engine.isRunning(state.timer);
  const v = engine.view(state.timer, state.now);

  // Tykanie tylko do odświeżania; czas liczony ze znaczników.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  // Powrót z tła: nadrób czas, wznów blokadę ekranu i dźwięk.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      dispatch({ type: 'tick', now: Date.now() });
      if (running) {
        resumeAudio();
        void lockScreen().then(setWakeOk);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running]);

  // Zapis stanu przy każdej prawdziwej zmianie (stan jest na znacznikach, więc tyknięcia go nie zmieniają).
  useEffect(() => {
    saveTimer({ workoutId, rxKey, state: state.timer, primary, startedAt: state.startedAt ?? undefined });
  }, [workoutId, rxKey, state.timer, primary, state.startedAt]);

  // Dźwięk, wibracja i głos przy zmianie segmentu.
  const lastIdx = useRef(state.timer.idx);
  useEffect(() => {
    if (lastIdx.current === state.timer.idx) return;
    lastIdx.current = state.timer.idx;
    if (state.timer.done || !state.timer.started) return;
    if (sound) sounds.change(state.timer.idx % 2 === 1);
    if (voice) announce(segments[state.timer.idx], targetOf(segments[state.timer.idx]));
  }, [state.timer.idx, state.timer.done, state.timer.started, sound, voice, segments, targetOf]);

  // Trzy krótkie sygnały w ostatnich 3 s segmentu ≥ 10 s.
  const secLeft = Math.ceil(v.segLeftSec - 1e-6);
  const lastSec = useRef(secLeft);
  useEffect(() => {
    if (lastSec.current === secLeft) return;
    lastSec.current = secLeft;
    if (running && sound && secLeft >= 1 && secLeft <= 3 && v.segDurSec >= 10) sounds.countdown();
  }, [secLeft, running, sound, v.segDurSec]);

  // Koniec treningu.
  const wasDone = useRef(state.timer.done);
  useEffect(() => {
    if (state.timer.done && !wasDone.current) {
      if (sound) sounds.finish();
      releaseScreen();
      stopSpeech();
    }
    wasDone.current = state.timer.done;
  }, [state.timer.done, sound]);

  useEffect(
    () => () => {
      releaseScreen();
      stopSpeech();
    },
    [],
  );

  const start = useCallback(() => {
    unlockAudio();
    const first = !state.timer.started;
    dispatch({ type: 'start', now: Date.now() });
    if (first) {
      if (sound) sounds.start();
      if (voice) {
        preloadAnnouncements(segments, targetOf);
        announce(segments[state.timer.idx], targetOf(segments[state.timer.idx]));
      }
    }
    void lockScreen().then(setWakeOk);
  }, [state.timer.started, state.timer.idx, sound, voice, segments, targetOf]);

  const act = useCallback((type: 'pause' | 'next' | 'prev' | 'end') => dispatch({ type, now: Date.now() }), []);
  const adjust = useCallback((delta: number) => dispatch({ type: 'adjust', now: Date.now(), delta }), []);

  return {
    timer: state.timer,
    view: v,
    running,
    restored: restored !== null,
    startedAt: state.startedAt,
    elapsedAtEnd: state.elapsedAtEnd,
    wakeOk,
    primary,
    setPrimary,
    start,
    pause: () => act('pause'),
    next: () => act('next'),
    prev: () => act('prev'),
    end: () => act('end'),
    adjust,
  };
}
