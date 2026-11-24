// Nagrany głos bez API: jeden tekst do wklejenia na stronie ElevenLabs i cięcie pobranego MP3 na frazy.
//
//   npm run voice:web -- tekst                         tworzy voice-web/tekst.txt (frazy oddzielone pustą linią)
//   npm run voice:web -- potnij --name Rhea            tnie najnowsze MP3 z Pobranych (z ostatnich 12 h)
//   npm run voice:web -- potnij --plik "C:\…\x.mp3"    tnie wskazany plik
//   npm run voice:web -- analizuj "C:\…\x.mp3"         pokazuje wykryte frazy i przerwy
//
// Bez znaczników <break> (przy wielu ElevenLabs przyspiesza mowę). Liczba fraz jest znana, więc cięcie
// idzie po N−1 najdłuższych przerwach. Poprawność sprawdza zgodność długości tekstu z długością nagrania.
// MP3 nie jest kodowany ponownie, tylko cięty po ramkach w środku przerw.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPEGDecoder } from 'mpg123-decoder';
import { phraseList, type Phrase } from '../src/domain/voicePhrases.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'voice-web');
const outDir = join(root, 'public', 'voice');

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface BikeJson {
  workouts: { rx: Record<string, { segments: { label: string; sec: number; cadence: string }[] }> }[];
}
const bike = JSON.parse(readFileSync(join(root, 'data', 'workouts_bike.json'), 'utf8')) as BikeJson;
const phrases = phraseList(bike.workouts.flatMap((w) => Object.values(w.rx).flatMap((r) => r.segments)));

const line = (p: Phrase) => (/[.!?]$/.test(p.text) ? p.text : `${p.text}.`);

function writeText() {
  mkdirSync(webDir, { recursive: true });
  const text = phrases.map(line).join('\n\n') + '\n';
  writeFileSync(join(webDir, 'tekst.txt'), text);
  writeFileSync(join(webDir, 'order.json'), JSON.stringify(phrases.map((p) => p.key)));
  console.log(`Gotowe: voice-web/tekst.txt, ${phrases.length} fraz, ${text.length} znaków (jedno wklejenie, limit strony to 5000).`);
}

// ---------- MP3: ramki ----------
interface Frame {
  offset: number;
  length: number;
}

const BITRATES: Record<string, number[]> = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Ramki MPEG Layer III (pomija tagi ID3 na początku). */
function frames(buf: Uint8Array): { frames: Frame[]; samplesPerFrame: number; sampleRate: number } {
  let i = 0;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  const out: Frame[] = [];
  let spf = 1152;
  let sr = 44100;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const ver = (buf[i + 1] >> 3) & 3;
    const layer = (buf[i + 1] >> 1) & 3;
    const br = (buf[i + 2] >> 4) & 15;
    const sri = (buf[i + 2] >> 2) & 3;
    const pad = (buf[i + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || br === 0 || br === 15 || sri === 3) {
      i++;
      continue;
    }
    sr = RATES[ver][sri];
    const kbps = (ver === 3 ? BITRATES.v1 : BITRATES.v2)[br];
    spf = ver === 3 ? 1152 : 576;
    const len = Math.floor(((spf / 8) * kbps * 1000) / sr) + pad;
    if (len < 4) {
      i++;
      continue;
    }
    out.push({ offset: i, length: len });
    i += len;
  }
  return { frames: out, samplesPerFrame: spf, sampleRate: sr };
}

// ---------- cisza i mowa ----------
const WIN = 0.01;

/** Przerwy (cisza ≥ 80 ms) między fragmentami mowy oraz początek i koniec mowy. */
function gaps(samples: Float32Array, sampleRate: number, threshold = 0.008) {
  const win = Math.round(sampleRate * WIN);
  const loud: boolean[] = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    loud.push(Math.sqrt(sum / (end - i)) > threshold);
  }
  const first = loud.indexOf(true);
  const last = loud.lastIndexOf(true);
  const out: { a: number; b: number; len: number }[] = [];
  let run = -1;
  for (let w = first; w <= last; w++) {
    if (!loud[w]) {
      if (run < 0) run = w;
    } else if (run >= 0) {
      if (w - run >= 8) out.push({ a: run * WIN, b: w * WIN, len: (w - run) * WIN });
      run = -1;
    }
  }
  return { gaps: out, start: first * WIN, end: (last + 1) * WIN };
}

/** Cięcie na n fraz po n−1 najdłuższych przerwach + ocena pewności. */
function cut(samples: Float32Array, sampleRate: number, n: number) {
  const g = gaps(samples, sampleRate);
  if (g.gaps.length < n - 1) return null;
  const sorted = [...g.gaps].sort((x, y) => y.len - x.len);
  const chosen = sorted.slice(0, n - 1).sort((x, y) => x.a - y.a);
  const minChosen = sorted[n - 2]?.len ?? 0;
  const maxOther = sorted[n - 1]?.len ?? 0;
  const segs: [number, number][] = [];
  let at = g.start;
  for (const c of chosen) {
    segs.push([at, c.a]);
    at = c.b;
  }
  segs.push([at, g.end]);
  return { segs, chosen, minChosen, maxOther };
}

/** Korelacja Pearsona (długość tekstu ↔ długość nagrania). */
function pearson(x: number[], y: number[]): number {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  x.forEach((xi, i) => {
    sxy += (xi - mx) * (y[i] - my);
    sxx += (xi - mx) ** 2;
    syy += (y[i] - my) ** 2;
  });
  return sxy / Math.sqrt(sxx * syy);
}

async function decode(file: string) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const buf = new Uint8Array(readFileSync(file));
  const { channelData, sampleRate } = decoder.decode(buf);
  decoder.free();
  return { buf, samples: channelData[0], sampleRate };
}

function newestMp3(): string | null {
  const dirs = [webDir, join(homedir(), 'Downloads')].filter(existsSync);
  const recent = Date.now() - 12 * 3600 * 1000;
  const files = dirs
    .flatMap((d) => readdirSync(d).filter((f) => f.toLowerCase().endsWith('.mp3')).map((f) => join(d, f)))
    .map((f) => ({ f, t: statSync(f).mtimeMs }))
    .filter((x) => x.t > recent)
    .sort((a, b) => b.t - a.t);
  return files[0]?.f ?? null;
}

async function split() {
  const orderPath = join(webDir, 'order.json');
  if (!existsSync(orderPath)) {
    console.error('Najpierw: npm run voice:web -- tekst');
    process.exitCode = 1;
    return;
  }
  const order = JSON.parse(readFileSync(orderPath, 'utf8')) as string[];
  if (!Array.isArray(order) || typeof order[0] !== 'string') {
    console.error('Plik voice-web/order.json jest ze starej wersji. Uruchom: npm run voice:web -- tekst');
    process.exitCode = 1;
    return;
  }
  const file = option('plik') ?? newestMp3();
  if (!file) {
    console.error('Nie widzę pobranego MP3 z ostatnich 12 godzin. Podaj go: npm run voice:web -- potnij --plik "ścieżka.mp3"');
    process.exitCode = 1;
    return;
  }
  console.log(`Plik: ${file.split(/[\\/]/).pop()}`);
  const { buf, samples, sampleRate } = await decode(file);
  const r = cut(samples, sampleRate, order.length);
  if (!r) {
    console.error(`Za mało przerw w nagraniu na ${order.length} fraz. Czy wklejony był cały tekst z voice-web/tekst.txt?`);
    process.exitCode = 1;
    return;
  }
  const texts = order.map((k) => phrases.find((p) => p.key === k)?.text.length ?? 0);
  const corr = pearson(
    texts,
    r.segs.map(([a, b]) => b - a),
  );
  console.log(`Fraz: ${r.segs.length}. Najkrótsza przerwa między frazami: ${r.minChosen.toFixed(2)} s, najdłuższa wewnątrz frazy: ${r.maxOther.toFixed(2)} s.`);
  console.log(`Zgodność długości tekstu z nagraniem: ${corr.toFixed(2)} (dobrze, gdy powyżej 0,8).`);
  if (corr < 0.8 || r.minChosen <= r.maxOther) {
    console.error('\nCięcie jest niepewne, więc nic nie zapisuję. Wygeneruj tekst jeszcze raz (najlepiej z Stability 40–50%) albo pokaż mi wynik.');
    process.exitCode = 1;
    return;
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const { frames: fr, samplesPerFrame, sampleRate: sr } = frames(buf);
  const frameAt = (t: number) => Math.max(0, Math.min(fr.length, Math.floor((t * sr) / samplesPerFrame)));
  const clips: Record<string, string> = {};
  r.segs.forEach(([a, b], i) => {
    const from = i === 0 ? Math.max(0, a - 0.2) : (r.segs[i - 1][1] + a) / 2;
    const to = i === r.segs.length - 1 ? b + 0.2 : (b + r.segs[i + 1][0]) / 2;
    const slice = fr.slice(frameAt(from), frameAt(to) + 1);
    const bytes = Buffer.concat(slice.map((f) => Buffer.from(buf.subarray(f.offset, f.offset + f.length))));
    writeFileSync(join(outDir, `${order[i]}.mp3`), bytes);
    clips[order[i]] = `${order[i]}.mp3`;
  });
  const manifest = { provider: 'ElevenLabs', model: 'eleven_multilingual_v2 (strona)', voiceName: option('name') ?? null, createdAt: new Date().toISOString(), clips };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`\nGotowe: ${Object.keys(clips).length} nagrań w public/voice.`);
}

/** Podgląd jednego pliku: przerwy i fragmenty mowy (do strojenia). */
async function analyze(file: string) {
  const { samples, sampleRate } = await decode(file);
  const g = gaps(samples, sampleRate);
  console.log(`Długość: ${(samples.length / sampleRate).toFixed(1)} s, mowa ${g.start.toFixed(2)}–${g.end.toFixed(2)} s, przerw ≥ 80 ms: ${g.gaps.length}`);
  console.log('Przerwy (s): ' + g.gaps.map((x) => x.len.toFixed(2)).join(' '));
}

const cmd = args[0];
const fail = (e: unknown) => {
  console.error((e as Error).message);
  process.exitCode = 1;
};
if (cmd === 'tekst') writeText();
else if (cmd === 'potnij') split().catch(fail);
else if (cmd === 'analizuj' && args[1]) analyze(args[1]).catch(fail);
else console.log('Użycie: npm run voice:web -- tekst | potnij --name Rhea | analizuj "plik.mp3"');
