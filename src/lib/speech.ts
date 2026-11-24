// Głos zapowiadający odcinek: „Podjazd siłowy. 6 minut. 220 do 250 watów. Kadencja 55 do 65.”
// Używa głosów systemowych (działają offline). Na iPhonie lepsze głosy pobiera się w
// Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.
import { useSyncExternalStore } from 'react';
import { minutesText, secondsText } from '../domain/format';
import type { Segment } from '../domain/types';
import { announcementKeys } from '../domain/voicePhrases';
import type { SegmentTarget } from '../domain/zones';
import { hasVoicePack, preloadClips, sayKeys, stopClips } from './voicePack';

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
  // iOS: voiceURI w stylu com.apple.voice.enhanced.pl-PL.Zosia (compact / enhanced / premium).
  const s = `${v.name} ${v.voiceURI}`.toLowerCase();
  if (/premium|natural|neural/.test(s)) return 2;
  if (/enhanced|rozszerz|google|online/.test(s)) return 1;
  return 0;
}

const QUALITY_LABEL = ['', ' · Rozszerzony', ' · Premium'] as const;

/** Etykiety na listę; te same nazwy (np. dwie „Zosie”) dostają numer, żeby dało się je odróżnić. */
export function voiceLabels(list: SpeechSynthesisVoice[]): string[] {
  const base = list.map((v) => `${v.name.replace(/\s*\((enhanced|premium|rozszerzony|compact)\)/i, '')}${QUALITY_LABEL[voiceQuality(v)]}`);
  return base.map((b, i) => (base.filter((x) => x === b).length > 1 ? `${b} (wersja ${base.slice(0, i + 1).filter((x) => x === b).length})` : b));
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

/** Wartość voiceUri oznaczająca nagrany głos (paczka z public/voice). */
export const PACK_VOICE = 'pack';

/** Nagrany głos, gdy wybrany albo gdy nic nie wybrano, a paczka jest. */
export const usesPack = (p: VoicePrefs = prefs) => p.voiceUri === PACK_VOICE || (p.voiceUri === undefined && hasVoicePack());

function systemText(seg: Segment, t: SegmentTarget): string {
  const power =
    t.power.kind === 'max' ? 'Na maksa' : t.power.unit === 'W' ? `${t.power.lo} do ${t.power.hi} watów` : `${t.power.lo} do ${t.power.hi} procent FTP`;
  return `${seg.label}. ${spokenDuration(seg.sec)}. ${power}. Kadencja ${spoken(seg.cadence)}.`;
}

/** Zapowiedź odcinka: nagranym głosem, a gdy czegoś brakuje — głosem systemowym. */
export function announce(seg: Segment, t: SegmentTarget, override?: VoicePrefs): void {
  const p = { ...prefs, ...override };
  if (usesPack(p)) {
    stopSystem();
    void sayKeys(announcementKeys(seg, t.power)).then((ok) => {
      if (!ok) speak(systemText(seg, t), { ...override, voiceUri: undefined });
    });
    return;
  }
  speak(systemText(seg, t), override);
}

/** Wczytuje z wyprzedzeniem nagrania wszystkich zapowiedzi treningu. */
export function preloadAnnouncements(segments: Segment[], targetOf: (s: Segment) => SegmentTarget): void {
  if (!usesPack()) return;
  preloadClips(segments.flatMap((s) => announcementKeys(s, targetOf(s).power)));
}

function stopSystem(): void {
  try {
    if (hasVoice) speechSynthesis.cancel();
  } catch {
    /* ignoruj */
  }
}

export function stopSpeech(): void {
  stopSystem();
  stopClips();
}
