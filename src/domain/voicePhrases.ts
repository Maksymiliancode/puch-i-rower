// Frazy do nagranego głosu (ElevenLabs) i zapowiedzi składane z nagrań, jak w nawigacji.
// Bez importów: ten sam plik czyta skrypt scripts/generate-voice.ts (Node uruchamia go bezpośrednio).

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const a = n % 10;
  const b = n % 100;
  return a >= 2 && a <= 4 && !(b >= 12 && b <= 14) ? few : many;
}

const UNITS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const TEENS = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const TENS = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

/** Liczba 0–999 słownie w mianowniku; `feminine` dla „jedna/dwie minuty”. */
export function numberWords(n: number, feminine = false): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new Error(`Poza zakresem: ${n}`);
  if (n === 0) return UNITS[0];
  if (feminine && n === 1) return 'jedna';
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) parts.push(TENS[t]);
    if (u) parts.push(feminine && u === 2 ? 'dwie' : UNITS[u]);
  }
  return parts.join(' ');
}

function unitWords(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  return `${numberWords(n, true)} ${plural(n, one, few, many)}`;
}

/** „dziesięć sekund”, „minuta”, „półtorej minuty”, „godzina piętnaście minut”. */
export function durationWords(sec: number): string {
  if (sec === 90) return 'półtorej minuty';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? 'godzina' : unitWords(h, 'godzina', 'godziny', 'godzin'));
  if (m) parts.push(m === 1 && !h ? 'minuta' : unitWords(m, 'minuta', 'minuty', 'minut'));
  if (s) parts.push(s === 1 ? 'sekunda' : unitWords(s, 'sekunda', 'sekundy', 'sekund'));
  return parts.join(' ');
}

/** Nazwa odcinka do przeczytania: cyfry i skróty słownie („30 s mocno” → „trzydzieści sekund mocno”). */
export function spokenLabel(label: string): string {
  return label
    .replace(/VO₂\s*max/gi, 'VO2 max')
    .replace(/(\d+)\s*min\b/g, (_, n: string) => durationWords(Number(n) * 60))
    .replace(/(\d+)\s*s\b/g, (_, n: string) => durationWords(Number(n)))
    .replace(/TEST/g, 'Test')
    .replace(/:/g, ',');
}

/** Liczby kadencji z opisu: „55–65” → [55, 65], „110+” → [110] i „więcej”. */
export function cadenceNumbers(c: string): { nums: number[]; more: boolean } {
  return { nums: (c.match(/\d+/g) ?? []).map(Number).slice(0, 2), more: c.includes('+') };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const key = {
  label: (l: string) => `l-${slug(l)}`,
  dur: (sec: number) => `d-${sec}`,
  num: (n: number) => `n-${n}`,
  word: (w: keyof typeof WORDS) => `w-${w}`,
};

export const WORDS = {
  watow: 'watów',
  kadencja: 'Kadencja',
  'na-maksa': 'Na maksa!',
  'i-wiecej': 'i więcej',
  start: 'Zaczynamy!',
  koniec: 'Koniec treningu. Dobra robota!',
} as const;

/** Pauza między liczbami zakresu („dwieście dwadzieścia… dwieście pięćdziesiąt”). */
export const PAUSE = '|';

/** Zakres watów w nagraniach (co 5 W). */
export const WATTS = { from: 100, to: 500, step: 5 };

export interface Phrase {
  key: string;
  text: string;
}

/** Wszystkie frazy do nagrania dla podanych odcinków (unikalne). */
export function phraseList(segments: { label: string; sec: number; cadence: string }[]): Phrase[] {
  const out = new Map<string, string>();
  for (const s of segments) {
    out.set(key.label(s.label), spokenLabel(s.label));
    out.set(key.dur(s.sec), durationWords(s.sec));
    for (const n of cadenceNumbers(s.cadence).nums) out.set(key.num(n), numberWords(n));
  }
  for (let w = WATTS.from; w <= WATTS.to; w += WATTS.step) out.set(key.num(w), numberWords(w));
  for (const [k, text] of Object.entries(WORDS)) out.set(key.word(k as keyof typeof WORDS), text);
  return [...out].map(([k, text]) => ({ key: k, text }));
}

type Power = { kind: 'max' } | { kind: 'range'; lo: number; hi: number; unit: string };

/** Klucze nagrań dla zapowiedzi odcinka; null, gdy czegoś nie da się złożyć z nagrań. */
export function announcementKeys(seg: { label: string; sec: number; cadence: string }, power: Power): string[] {
  const out = [key.label(seg.label), key.dur(seg.sec)];
  if (power.kind === 'max') out.push(key.word('na-maksa'));
  else if (power.unit === 'W') {
    out.push(key.num(power.lo));
    if (power.hi !== power.lo) out.push(PAUSE, key.num(power.hi));
    out.push(key.word('watow'));
  } else return [];
  const c = cadenceNumbers(seg.cadence);
  if (c.nums.length) {
    out.push(key.word('kadencja'), key.num(c.nums[0]));
    if (c.nums[1]) out.push(PAUSE, key.num(c.nums[1]));
    if (c.more) out.push(key.word('i-wiecej'));
  }
  return out;
}
