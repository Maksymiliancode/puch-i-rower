import { describe, expect, it } from 'vitest';
import { BIKE_WORKOUTS } from './catalog';
import { announcementKeys, durationWords, numberWords, phraseList, PAUSE, spokenLabel } from './voicePhrases';
import { segmentTarget } from './zones';

describe('liczby słownie', () => {
  it('mianownik', () => {
    expect(numberWords(5)).toBe('pięć');
    expect(numberWords(15)).toBe('piętnaście');
    expect(numberWords(65)).toBe('sześćdziesiąt pięć');
    expect(numberWords(110)).toBe('sto dziesięć');
    expect(numberWords(225)).toBe('dwieście dwadzieścia pięć');
    expect(numberWords(400)).toBe('czterysta');
  });

  it('rodzaj żeński: jedna, dwie', () => {
    expect(numberWords(1, true)).toBe('jedna');
    expect(numberWords(22, true)).toBe('dwadzieścia dwie');
    expect(numberWords(21, true)).toBe('dwadzieścia jeden');
  });
});

describe('czas słownie', () => {
  it.each([
    [10, 'dziesięć sekund'],
    [30, 'trzydzieści sekund'],
    [60, 'minuta'],
    [90, 'półtorej minuty'],
    [120, 'dwie minuty'],
    [300, 'pięć minut'],
    [1320, 'dwadzieścia dwie minuty'],
    [3600, 'godzina'],
    [4500, 'godzina piętnaście minut'],
    [7500, 'dwie godziny pięć minut'],
  ])('%i s → %s', (sec, text) => expect(durationWords(sec)).toBe(text));
});

describe('nazwy odcinków', () => {
  it('cyfry i skróty słownie', () => {
    expect(spokenLabel('30 s mocno')).toBe('trzydzieści sekund mocno');
    expect(spokenLabel('1 min mocno')).toBe('minuta mocno');
    expect(spokenLabel('TEST 20 min')).toBe('Test dwadzieścia minut');
    expect(spokenLabel('VO₂max')).toBe('VO2 max');
    expect(spokenLabel('Rozgrzewka: tempo')).toBe('Rozgrzewka tempo');
  });
});

describe('paczka nagrań', () => {
  const segments = BIKE_WORKOUTS.flatMap((w) => Object.values(w.rx).flatMap((r) => r!.segments));
  const phrases = phraseList(segments);
  const keys = new Set(phrases.map((p) => p.key));

  it('mieści się w darmowym limicie i nie ma pustych fraz', () => {
    const chars = phrases.reduce((a, p) => a + p.text.length, 0);
    expect(chars).toBeLessThan(5000);
    phrases.forEach((p) => expect(p.text.trim()).not.toBe(''));
  });

  it('każdą zapowiedź z katalogu da się złożyć z nagrań (FTP 230–380)', () => {
    for (const ftp of [230, 250, 290, 330, 380]) {
      for (const s of segments) {
        const k = announcementKeys(s, segmentTarget(s, ftp, 163).power);
        expect(k.length).toBeGreaterThan(0);
        k.filter((x) => x !== PAUSE).forEach((x) => expect(keys.has(x), `${x} (FTP ${ftp}, ${s.label})`).toBe(true));
      }
    }
  });

  it('zapowiedź: nazwa, czas, waty, kadencja', () => {
    expect(announcementKeys({ label: 'Podjazd siłowy', sec: 360, cadence: '55–65' }, { kind: 'range', lo: 220, hi: 250, unit: 'W' })).toEqual([
      'l-podjazd-silowy',
      'd-360',
      'n-220',
      PAUSE,
      'n-250',
      'w-watow',
      'w-kadencja',
      'n-55',
      PAUSE,
      'n-65',
    ]);
  });
});
