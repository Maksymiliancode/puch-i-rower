// Nagrany głos (ElevenLabs): zapowiedzi sklejane z krótkich nagrań, jak w nawigacji.
// Grane przez Web Audio (ten sam kontekst co sygnały), więc działają offline i przy wyciszeniu.
import { useSyncExternalStore } from 'react';
import { PAUSE } from '../domain/voicePhrases';
import { audioContext } from './audio';

export interface VoiceManifest {
  provider: string;
  voiceName?: string | null;
  clips: Record<string, string>;
}

const BASE = './voice/';
let manifest: VoiceManifest | null = null;
let loading = false;
const listeners = new Set<() => void>();

/** Wczytuje spis nagrań; brak pliku = brak paczki (wtedy mówi głos systemowy). */
export function loadVoicePack(): void {
  if (loading || manifest) return;
  loading = true;
  fetch(`${BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
    .then((m) => {
      manifest = m && Object.keys(m.clips ?? {}).length ? m : null;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* brak paczki */
    });
}

export function useVoicePack(): VoiceManifest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      loadVoicePack();
      return () => listeners.delete(cb);
    },
    () => manifest,
    () => null,
  );
}

export const hasVoicePack = () => manifest !== null;

interface Clip {
  buffer: AudioBuffer;
  start: number;
  end: number;
}
const clips = new Map<string, Promise<Clip | null>>();

/** Początek i koniec dźwięku bez ciszy na brzegach nagrania. */
function trim(buffer: AudioBuffer): { start: number; end: number } {
  const data = buffer.getChannelData(0);
  const th = 0.012;
  let a = 0;
  let b = data.length - 1;
  while (a < b && Math.abs(data[a]) < th) a++;
  while (b > a && Math.abs(data[b]) < th) b--;
  const pad = 0.03 * buffer.sampleRate;
  return { start: Math.max(0, a - pad) / buffer.sampleRate, end: Math.min(data.length, b + pad) / buffer.sampleRate };
}

function clip(key: string): Promise<Clip | null> {
  const ctx = audioContext();
  const file = manifest?.clips[key];
  if (!ctx || !file) return Promise.resolve(null);
  let p = clips.get(key);
  if (!p) {
    p = fetch(BASE + file)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buffer) => ({ buffer, ...trim(buffer) }))
      .catch(() => null);
    clips.set(key, p);
  }
  return p;
}

/** Wczytanie z wyprzedzeniem (np. wszystkich fraz bieżącego treningu). */
export function preloadClips(keys: string[]): void {
  keys.filter((k) => k !== PAUSE).forEach((k) => void clip(k));
}

/** Czy wszystkie potrzebne nagrania są w paczce. */
export const canSay = (keys: string[]) => !!manifest && keys.length > 0 && keys.every((k) => k === PAUSE || !!manifest!.clips[k]);

let playing: AudioBufferSourceNode[] = [];

export function stopClips(): void {
  playing.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* już skończone */
    }
  });
  playing = [];
}

/** Gra frazy jedna po drugiej. Zwraca false, gdy nie da się (brak nagrania lub dźwięku). */
export async function sayKeys(keys: string[]): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx || !canSay(keys)) return false;
  const loaded = await Promise.all(keys.map((k) => (k === PAUSE ? Promise.resolve(PAUSE) : clip(k))));
  if (loaded.some((c) => c === null)) return false;
  stopClips();
  let t = ctx.currentTime + 0.05;
  for (const c of loaded) {
    if (c === PAUSE) {
      t += 0.16;
      continue;
    }
    const { buffer, start, end } = c as Clip;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(t, start, end - start);
    playing.push(src);
    t += end - start + 0.07;
  }
  return true;
}
