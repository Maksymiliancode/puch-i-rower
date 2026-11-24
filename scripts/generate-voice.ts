// Generuje paczkę nagrań głosu (ElevenLabs) do public/voice/.
//
//   npm run voice -- --dry            ile znaków i fraz (bez łączenia z ElevenLabs)
//   npm run voice -- --list-voices    głosy dostępne na Twoim koncie (nazwa i id)
//   npm run voice -- --voice <id>     generuje brakujące nagrania tym głosem
//   npm run voice -- --voice <id> --force   generuje wszystko od nowa
//
// Klucz API czytany jest tylko ze zmiennej środowiskowej ELEVENLABS_API_KEY
// i nigdzie nie jest zapisywany ani wypisywany.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phraseList } from '../src/domain/voicePhrases.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice');
const API = 'https://api.elevenlabs.io/v1';
const MODEL = 'eleven_multilingual_v2';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface BikeJson {
  workouts: { rx: Record<string, { segments: { label: string; sec: number; cadence: string }[] }> }[];
}
const bike = JSON.parse(readFileSync(join(root, 'data', 'workouts_bike.json'), 'utf8')) as BikeJson;
const segments = bike.workouts.flatMap((w) => Object.values(w.rx).flatMap((r) => r.segments));
const phrases = phraseList(segments);
const chars = phrases.reduce((a, p) => a + p.text.length, 0);

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY?.trim();
  if (!k) {
    console.error('Brak klucza. Najpierw w tym samym oknie PowerShell:\n  $env:ELEVENLABS_API_KEY = Read-Host "Klucz ElevenLabs"');
    process.exit(1);
  }
  return k;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': apiKey(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`ElevenLabs odpowiedział ${res.status}: ${body}`);
  }
  return res;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (flag('dry')) {
    console.log(`Fraz: ${phrases.length}, znaków: ${chars} (darmowy plan ma ok. 10 000 znaków miesięcznie).`);
    for (const p of phrases) console.log(`  ${p.key.padEnd(28)} ${p.text}`);
    return;
  }

  if (flag('list-voices')) {
    const data = (await (await api('/voices')).json()) as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] };
    for (const v of data.voices) console.log(`${v.voice_id}  ${v.name}${v.labels ? '  ' + Object.values(v.labels).join(', ') : ''}`);
    console.log('\nGłosy z biblioteki dodaj najpierw do „My Voices” na elevenlabs.io, wtedy pojawią się tutaj.');
    return;
  }

  const voice = option('voice') ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voice) {
    console.error('Podaj głos: npm run voice -- --voice <id>   (listę daje: npm run voice -- --list-voices)');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  const old = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { voiceId?: string }) : null;
  // Inny głos niż poprzednio albo --force: zaczynamy od czystego katalogu, żeby głosy się nie mieszały.
  if (flag('force') || (old?.voiceId && old.voiceId !== voice)) {
    for (const f of readdirSync(outDir)) if (f.endsWith('.mp3')) rmSync(join(outDir, f));
  }

  const todo = phrases.filter((p) => !existsSync(join(outDir, `${p.key}.mp3`)));
  const todoChars = todo.reduce((a, p) => a + p.text.length, 0);
  console.log(`Do nagrania: ${todo.length} z ${phrases.length} fraz, ${todoChars} znaków.`);

  let done = 0;
  for (const p of todo) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await api(`/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: p.text,
            model_id: MODEL,
            voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
          }),
        });
        writeFileSync(join(outDir, `${p.key}.mp3`), Buffer.from(await res.arrayBuffer()));
        break;
      } catch (e) {
        const msg = (e as Error).message;
        if (attempt < 4 && /\b(429|5\d\d)\b/.test(msg)) {
          await sleep(2000 * attempt);
          continue;
        }
        console.error(`\nNie udało się: „${p.text}”. ${msg}`);
        if (/paid_plan_required|402/.test(msg)) {
          console.error('Ten głos jest z biblioteki ElevenLabs, a darmowe konto nie może go używać przez API. Wybierz głos z „Default voices” albo plan płatny.');
        } else console.error('Nagrane do tej pory frazy zostają; uruchom komendę ponownie, żeby dokończyć.');
        writeManifest(voice);
        process.exitCode = 1;
        return;
      }
    }
    done++;
    process.stdout.write(`\r${done}/${todo.length}  ${p.text.slice(0, 40).padEnd(40)}`);
    await sleep(150);
  }
  writeManifest(voice);
  console.log(`\nGotowe. Nagrania są w public/voice (${phrases.length} plików).`);
}

function writeManifest(voiceId: string) {
  const clips: Record<string, string> = {};
  for (const p of phrases) if (existsSync(join(outDir, `${p.key}.mp3`))) clips[p.key] = `${p.key}.mp3`;
  const manifest = { provider: 'ElevenLabs', model: MODEL, voiceId, voiceName: option('name') ?? null, createdAt: new Date().toISOString(), clips };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
}

// exitCode zamiast process.exit(): na Windowsie twarde wyjście przy otwartym połączeniu kończy się błędem Node.
main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
