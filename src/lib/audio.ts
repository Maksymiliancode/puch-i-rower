// Sygnały dźwiękowe przez Web Audio. Kontekst tworzony przy pierwszym Start (wymóg iOS).

let ctx: AudioContext | null = null;

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

export function unlockAudio(): void {
  try {
    // Safari 16.4+: tryb „playback” gra także przy włączonym przełączniku wyciszenia.
    const nav = navigator as AudioSessionNav;
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* brak wsparcia */
  }
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    if (ctx) {
      // Cichy bufor „odblokowuje” odtwarzanie na iOS.
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    }
  } catch {
    ctx = null;
  }
}

/** Wspólny kontekst dźwięku (sygnały i nagrany głos); null przed pierwszym Start. */
export const audioContext = (): AudioContext | null => ctx;

export function resumeAudio(): void {
  try {
    if (ctx && ctx.state !== 'running') void ctx.resume();
  } catch {
    /* ignoruj */
  }
}

function beep(freq: number, ms: number, vol = 0.35, delayMs = 0): void {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t = ctx.currentTime + delayMs / 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  } catch {
    /* ignoruj */
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS Safari nie ma Vibration API */
  }
}

export const sounds = {
  start: () => beep(880, 220),
  countdown: () => {
    beep(1040, 110);
    vibrate(60);
  },
  change: (alt: boolean) => {
    beep(alt ? 660 : 880, 380, 0.45);
    vibrate([200, 80, 200]);
  },
  finish: () => {
    beep(660, 200);
    beep(880, 200, 0.35, 250);
    beep(1100, 400, 0.35, 500);
    vibrate([300, 100, 300, 100, 300]);
  },
};
