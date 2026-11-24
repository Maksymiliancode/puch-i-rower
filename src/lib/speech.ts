// Głos zapowiadający odcinek: „Podjazd siłowy. 6 minut. 220 do 250 watów. Kadencja 55 do 65.”
// Używa głosów systemowych (działają offline). Na iPhonie lepsze głosy pobiera się w
// Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.
import { useSyncExternalStore } from 'react';
import { minutesText, secondsText } from '../domain/format';
import type { Segment } from '../domain/types';
import type { SegmentTarget } from '../domain/zones';

export const hasVoice = (() => {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  } catch {
    return false;
  }
})();

export interface VoicePrefs {
  /** voiceURI wybranego głosu; brak = domyślny polski. */
  voiceUri?: string;
  /** Tempo mowy 0,8–1,3. */
  rate?: number;
}

let prefs: VoicePrefs = {};
export function setVoicePrefs(p: VoicePrefs): void {
  prefs = p;
}

// Głosy ładują się asynchronicznie (Chrome, Safari), więc trzymamy je w małym magazynie.
let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();
function refresh() {
  try {
    voices = speechSynthesis.getVoices();
  } catch {
    voices = [];
  }
  listeners.forEach((l) => l());
}
if (hasVoice) {
  refresh();
  try {
    speechSynthesis.addEventListener('voiceschanged', refresh);
  } catch {
    /* starsze Safari */
  }
}

/** Jakość głosu po nazwie (iOS/macOS dopisuje „Enhanced”/„Premium”, Chrome „Google”/„Natural”). */
export function voiceQuality(v: Pick<SpeechSynthesisVoice, 'name' | 'voiceURI'>): 0 | 1 | 2 {
  const s = `${v.name} ${v.voiceURI}`.toLowerCase();
  if (/premium|natural|neural/.test(s)) return 2;
  if (/enhanced|rozszerz|google|online/.test(s)) return 1;
  return 0;
}

const QUALITY_LABEL = ['', ' · lepsza jakość', ' · najlepsza jakość'] as const;

export function voiceLabel(v: SpeechSynthesisVoice): string {
  return `${v.name.replace(/\s*\((enhanced|premium|rozszerzony)\)/i, '')}${QUALITY_LABEL[voiceQuality(v)]}`;
}

/** Polskie głosy, najlepsze na górze. */
export function polishVoices(list: SpeechSynthesisVoice[] = voices): SpeechSynthesisVoice[] {
  return list.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('pl')).sort((a, b) => voiceQuality(b) - voiceQuality(a) || a.name.localeCompare(b.name));
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const EMPTY: SpeechSynthesisVoice[] = [];
export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribe, () => (hasVoice ? voices : EMPTY), () => EMPTY);
}

function pickVoice(uri?: string): SpeechSynthesisVoice | undefined {
  const pl = polishVoices();
  return pl.find((v) => v.voiceURI === uri) ?? pl[0];
}

/** Mówi tekst; `override` służy do odsłuchu w ustawieniach przed zapisem. */
export function speak(text: string, override?: VoicePrefs): void {
  if (!hasVoice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const p = { ...prefs, ...override };
    const v = pickVoice(p.voiceUri);
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'pl-PL';
    u.rate = p.rate ?? 1.05;
    speechSynthesis.speak(u);
  } catch {
    /* ignoruj */
  }
}

const spoken = (s: string) => s.replace('–', ' do ').replace('+', ' i więcej');

function spokenDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (m) parts.push(minutesText(m));
  if (s) parts.push(secondsText(s));
  return parts.join(' ');
}

export function announce(seg: Segment, t: SegmentTarget): void {
  const power =
    t.power.kind === 'max' ? 'Na maksa' : t.power.unit === 'W' ? `${t.power.lo} do ${t.power.hi} watów` : `${t.power.lo} do ${t.power.hi} procent FTP`;
  speak(`${seg.label}. ${spokenDuration(seg.sec)}. ${power}. Kadencja ${spoken(seg.cadence)}.`);
}

export function stopSpeech(): void {
  try {
    if (hasVoice) speechSynthesis.cancel();
  } catch {
    /* ignoruj */
  }
}
