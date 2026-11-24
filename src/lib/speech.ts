// Opcjonalny głos zapowiadający segment: „Podjazd siłowy. 6 minut. 220 do 250 watów. Kadencja 55 do 65.”
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
  if (!hasVoice) return;
  try {
    const power =
      t.power.kind === 'max' ? 'Na maksa' : t.power.unit === 'W' ? `${t.power.lo} do ${t.power.hi} watów` : `${t.power.lo} do ${t.power.hi} procent FTP`;
    const text = `${seg.label}. ${spokenDuration(seg.sec)}. ${power}. Kadencja ${spoken(seg.cadence)}.`;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pl-PL';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {
    /* ignoruj */
  }
}

export function stopSpeech(): void {
  try {
    if (hasVoice) speechSynthesis.cancel();
  } catch {
    /* ignoruj */
  }
}
