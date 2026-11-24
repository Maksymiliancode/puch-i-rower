// Nagrany głos bez API: tekst do wklejenia na stronie ElevenLabs i cięcie pobranych MP3 na frazy.
//
//   npm run voice:web -- tekst                 tworzy voice-web/czesc-1.txt, czesc-2.txt, …
//   npm run voice:web -- potnij --name Kinga   tnie pobrane MP3 (voice-web/ albo Pobrane z ostatnich 12 h)
//
// Każda część ma inną liczbę fraz, więc kolejność pobierania plików nie ma znaczenia:
// plik dopasowuje się do części po liczbie wykrytych fraz. MP3 nie jest kodowany ponownie,
// tylko cięty po ramkach w środku przerw między frazami.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPEGDecoder } from 'mpg123-decoder';
import { phraseList, type Phrase } from '../src/domain/voicePhrases.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'voice-web');
const outDir = join(root, 'public', 'voice');
const BREAK = '<break time="1.5s" />';
/** Cisza dłuższa niż tyle sekund rozdziela frazy (przerwa w tekście to 1,5 s). */
const MIN_GAP = 0.7;

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

const line = (p: Phrase) => `${/[.!?]$/.test(p.text) ? p.text : `${p.text}.`} ${BREAK}`;

/** Podział na części o różnej liczbie fraz (np. 50, 47, 45). */
function parts(): Phrase[][] {
  const total = phrases.reduce((a, p) => a + line(p).length + 1, 0);
  const n = Math.max(3, Math.ceil(total / 2200));
  const base = Math.floor(phrases.length / n);
  const sizes = Array.from({ length: n }, (_, i) => base + (n - 1 - 2 * i));
  sizes[0] += phrases.length - sizes.reduce((a, b) => a + b, 0);
  const out: Phrase[][] = [];
  let at = 0;
  for (const s of sizes) {
    out.push(phrases.slice(at, at + s));
    at += s;
  }
  return out;
}

function writeText() {
  mkdirSync(webDir, { recursive: true });
  const ps = parts();
  ps.forEach((p, i) => writeFileSync(join(webDir, `czesc-${i + 1}.txt`), p.map(line).join('\n') + '\n'));
  writeFileSync(join(webDir, 'order.json'), JSON.stringify(ps.map((p) => p.map((x) => x.key))));
  const chars = ps.map((p) => p.map(line).join('\n').length);
  console.log(`Gotowe: ${ps.length} części w folderze voice-web (fraz: ${ps.map((p) => p.length).join(', ')}; znaków: ${chars.join(', ')}; razem ${chars.reduce((a, b) => a + b, 0)}).`);
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

/** Odcinki mowy [start, koniec] w sekundach, rozdzielone ciszą dłuższą niż MIN_GAP. */
function speech(samples: Float32Array, sampleRate: number): [number, number][] {
  const win = Math.round(sampleRate * 0.01);
  const loud: boolean[] = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    loud.push(Math.sqrt(sum / (end - i)) > 0.008);
  }
  const segs: [number, number][] = [];
  let start = -1;
  let quiet = 0;
  const gapWins = Math.round(MIN_GAP / 0.01);
  loud.forEach((l, w) => {
    if (l) {
      if (start < 0) start = w;
      quiet = 0;
    } else if (start >= 0 && ++quiet >= gapWins) {
      segs.push([start * 0.01, (w - quiet + 1) * 0.01]);
      start = -1;
      quiet = 0;
    }
  });
  if (start >= 0) segs.push([start * 0.01, (loud.length - quiet) * 0.01]);
  return segs.filter(([a, b]) => b - a >= 0.12);
}

function candidates(): string[] {
  const fromWeb = existsSync(webDir) ? readdirSync(webDir).filter((f) => f.toLowerCase().endsWith('.mp3')).map((f) => join(webDir, f)) : [];
  const dl = join(homedir(), 'Downloads');
  const recent = Date.now() - 12 * 3600 * 1000;
  const fromDl = existsSync(dl)
    ? readdirSync(dl)
        .filter((f) => f.toLowerCase().endsWith('.mp3'))
        .map((f) => join(dl, f))
        .filter((f) => statSync(f).mtimeMs > recent)
    : [];
  return [...fromWeb, ...fromDl];
}

async function split() {
  const orderPath = join(webDir, 'order.json');
  if (!existsSync(orderPath)) {
    console.error('Najpierw: npm run voice:web -- tekst');
    process.exitCode = 1;
    return;
  }
  const order = JSON.parse(readFileSync(orderPath, 'utf8')) as string[][];
  const files = candidates();
  if (!files.length) {
    console.error('Nie widzę pobranych plików MP3 (ani w voice-web, ani w Pobranych z ostatnich 12 godzin).');
    process.exitCode = 1;
    return;
  }

  const decoder = new MPEGDecoder();
  await decoder.ready;
  const matched = new Map<number, { file: string; buf: Uint8Array; segs: [number, number][] }>();
  for (const file of files) {
    const buf = new Uint8Array(readFileSync(file));
    decoder.reset();
    const { channelData, sampleRate } = decoder.decode(buf);
    const segs = speech(channelData[0], sampleRate);
    const part = order.findIndex((keys, i) => keys.length === segs.length && !matched.has(i));
    console.log(`${file.split(/[\\/]/).pop()}: ${segs.length} fraz${part >= 0 ? ` → część ${part + 1}` : ' (nie pasuje do żadnej części)'}`);
    if (part >= 0) matched.set(part, { file, buf, segs });
  }
  decoder.free();

  const missing = order.map((_, i) => i).filter((i) => !matched.has(i));
  if (missing.length) {
    console.error(`\nBrakuje części: ${missing.map((i) => `${i + 1} (${order[i].length} fraz)`).join(', ')}.`);
    console.error('Sprawdź, czy wybrany był model „Eleven Multilingual v2” i czy cały tekst części został wklejony. Plik do części z inną liczbą fraz trzeba wygenerować jeszcze raz.');
    process.exitCode = 1;
    return;
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const clips: Record<string, string> = {};
  for (const [part, { buf, segs }] of matched) {
    const { frames: fr, samplesPerFrame, sampleRate } = frames(buf);
    const frameAt = (t: number) => Math.max(0, Math.min(fr.length, Math.floor((t * sampleRate) / samplesPerFrame)));
    segs.forEach(([a, b], i) => {
      // Cięcie w połowie przerwy przed i po frazie.
      const from = i === 0 ? Math.max(0, a - 0.3) : (segs[i - 1][1] + a) / 2;
      const to = i === segs.length - 1 ? b + 0.3 : (b + segs[i + 1][0]) / 2;
      const slice = fr.slice(frameAt(from), frameAt(to) + 1);
      const bytes = Buffer.concat(slice.map((f) => Buffer.from(buf.subarray(f.offset, f.offset + f.length))));
      const k = order[part][i];
      writeFileSync(join(outDir, `${k}.mp3`), bytes);
      clips[k] = `${k}.mp3`;
    });
  }
  const manifest = { provider: 'ElevenLabs', model: 'eleven_multilingual_v2 (strona)', voiceName: option('name') ?? null, createdAt: new Date().toISOString(), clips };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`\nGotowe: ${Object.keys(clips).length} nagrań w public/voice.`);
}

const cmd = args[0];
if (cmd === 'tekst') writeText();
else if (cmd === 'potnij')
  split().catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
else console.log('Użycie: npm run voice:web -- tekst   |   npm run voice:web -- potnij --name Kinga');
