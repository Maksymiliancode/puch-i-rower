import { useEffect, useState } from 'react';
import { useSettings } from '../app/settings';
import { Icon } from '../components/Icon';
import { applyImport, db, exportAll, parseExport, planImport, type ImportPlan } from '../data/db';
import { prettyDate } from '../domain/format';
import { phaseForDate, todayIso } from '../domain/season';
import type { FtpEntry, PhaseId, Settings } from '../domain/types';
import { hasVoice, polishVoices, speak, useVoices, voiceLabel } from '../lib/speech';

type NumKey = 'lthrBike' | 'lthrRun' | 'hrMax' | 'rhrAlert';
const NUM_FIELDS: { key: NumKey; label: string; hint: string; min: number; max: number }[] = [
  { key: 'lthrBike', label: 'Próg tętna na rowerze (LTHR)', hint: 'Średnie tętno z ostatnich 10 minut testu FTP.', min: 120, max: 200 },
  { key: 'lthrRun', label: 'Próg tętna na nogach', hint: 'Zwykle 3–5 uderzeń więcej niż na rowerze.', min: 120, max: 210 },
  { key: 'hrMax', label: 'Tętno maksymalne', hint: 'Najwyższe zaobserwowane.', min: 140, max: 230 },
  { key: 'rhrAlert', label: 'Alarm tętna spoczynkowego', hint: 'Rano powyżej tej wartości: dzień lżej.', min: 30, max: 90 },
];

const SOURCE_LABEL: Record<FtpEntry['source'], string> = { estimate: 'szacunek', test: 'test', manual: 'ręcznie' };

function NumberField({ label, hint, value, min, max, onCommit }: { label: string; hint: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [err, setErr] = useState<string | null>(null);
  const id = `f-${label.replace(/\W+/g, '-')}`;
  const commit = () => {
    const v = Number(text);
    if (!Number.isFinite(v) || v < min || v > max) {
      setErr(`Wpisz liczbę od ${min} do ${max}.`);
      return;
    }
    setErr(null);
    if (v !== value) onCommit(Math.round(v));
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input num"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={err ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span id={`${id}-hint`} className="hint" aria-live="polite">
        {err ?? hint}
      </span>
    </div>
  );
}

const VOICE_SAMPLE = 'Podjazd siłowy. 6 minut. 220 do 250 watów. Kadencja 55 do 65.';
const RATES = [
  { v: 0.9, label: 'Wolno' },
  { v: 1.05, label: 'Normalnie' },
  { v: 1.2, label: 'Szybko' },
];

function VoiceSection() {
  const { settings, save } = useSettings();
  const voices = polishVoices(useVoices());
  if (!hasVoice) return null;
  const uri = voices.some((v) => v.voiceURI === settings.timer.voiceUri) ? settings.timer.voiceUri : (voices[0]?.voiceURI ?? '');
  const rate = settings.timer.voiceRate ?? 1.05;
  const set = (patch: Partial<Settings['timer']>) => {
    const timer = { ...settings.timer, ...patch };
    void save({ timer });
    speak(VOICE_SAMPLE, { voiceUri: timer.voiceUri, rate: timer.voiceRate });
  };

  return (
    <section className="card" aria-labelledby="voice-h">
      <h2 id="voice-h">Głos</h2>
      {voices.length === 0 ? (
        <p>Ta przeglądarka nie ma polskiego głosu. Na iPhonie pobierz go w ustawieniach (opis niżej).</p>
      ) : (
        <div className="field">
          <label htmlFor="voice">Który głos czyta zapowiedzi</label>
          <select id="voice" className="input" value={uri} onChange={(e) => set({ voiceUri: e.target.value })}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {voiceLabel(v)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <span className="label" id="rate-l">
          Tempo mowy
        </span>
        <div className="chips" role="group" aria-labelledby="rate-l">
          {RATES.map((r) => (
            <button key={r.v} type="button" className="chip chip-text" aria-pressed={Math.abs(rate - r.v) < 0.01} onClick={() => set({ voiceRate: r.v })}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => speak(VOICE_SAMPLE)}>
          <Icon name="voice" />
          Posłuchaj
        </button>
      </div>
      <details>
        <summary>Jak dodać ładniejszy głos na iPhonie</summary>
        <ol className="steps">
          <li>Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.</li>
          <li>Wybierz głos (np. Zosia) i pobierz wersję oznaczoną jako „Rozszerzony” albo „Premium”.</li>
          <li>Zamknij aplikację Puch i Rower całkiem i otwórz ponownie. Nowy głos pojawi się na liście wyżej z dopiskiem o jakości.</li>
        </ol>
        <p className="hint">Głosy systemowe działają bez internetu, także w górach. Głosy Siri zwykle nie są dostępne dla aplikacji z przeglądarki.</p>
      </details>
    </section>
  );
}

function FtpSection() {
  const { settings, save } = useSettings();
  const [value, setValue] = useState(String(settings.ftpW));
  const [source, setSource] = useState<FtpEntry['source']>('test');
  const [msg, setMsg] = useState<string | null>(null);

  const apply = async () => {
    const v = Math.round(Number(value));
    if (!Number.isFinite(v) || v < 80 || v > 600) {
      setMsg('Wpisz FTP od 80 do 600 W.');
      return;
    }
    const entry: FtpEntry = { date: todayIso(), value: v, source };
    await save({ ftpW: v, ftpHistory: [...settings.ftpHistory, entry] });
    setMsg(`Zapisano FTP ${v} W. Waty we wszystkich treningach są przeliczone.`);
  };

  return (
    <section className="card" aria-labelledby="ftp-h">
      <h2 id="ftp-h">FTP na Keiserze</h2>
      <p className="muted">Teraz: <b className="num">{settings.ftpW} W</b>. Po teście wpisz 95% średnich watów z 20 minut.</p>
      <div className="ftp-row">
        <div className="field">
          <label htmlFor="ftp">Nowe FTP (W)</label>
          <input id="ftp" className="input num" inputMode="numeric" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ftp-src">Skąd</label>
          <select id="ftp-src" className="input" value={source} onChange={(e) => setSource(e.target.value as FtpEntry['source'])}>
            <option value="test">Test</option>
            <option value="manual">Ręcznie</option>
            <option value="estimate">Szacunek</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void apply()}>
          Zapisz FTP
        </button>
      </div>
      <p className="hint" aria-live="polite">
        {msg}
      </p>
      <details>
        <summary>Historia FTP</summary>
        <ul className="ftp-history">
          {[...settings.ftpHistory].reverse().map((h, i) => (
            <li key={`${h.date}-${i}`}>
              <span>{prettyDate(h.date)}</span>
              <b className="num">{h.value} W</b>
              <span className="muted">{SOURCE_LABEL[h.source]}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function DataSection() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void db.sessions.count().then(setCount);
  }, []);

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `puch-i-rower-kopia-${todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Wyeksportowano ${data.sessions.length} wpisów. Zapisz plik w iCloud Drive albo wyślij sobie mailem.`);
  };

  const onFile = async (file: File) => {
    setMsg(null);
    try {
      const parsed = parseExport(await file.text());
      setPlan(await planImport(parsed));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Nie udało się odczytać pliku.');
    }
  };

  const finishImport = async (overwriteConflicts: boolean) => {
    if (!plan) return;
    await applyImport(plan, { overwriteConflicts, replaceSettings: false });
    setMsg(`Zaimportowano ${plan.newSessions.length + (overwriteConflicts ? plan.conflicts.length : 0)} wpisów.`);
    setPlan(null);
    setCount(await db.sessions.count());
  };

  return (
    <section className="card" aria-labelledby="data-h">
      <h2 id="data-h">Kopia danych</h2>
      <p className="muted">
        Dziennik jest tylko na tym telefonie{count !== null && <> ({count} wpisów)</>}. Rób kopię raz w tygodniu.
        {persisted === false && ' Przeglądarka nie potwierdziła trwałego zapisu, więc kopia jest tym ważniejsza.'}
      </p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => void doExport()}>
          <Icon name="download" />
          Eksportuj kopię
        </button>
        <label className="btn">
          <Icon name="upload" />
          Importuj z pliku
          <input type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
        </label>
      </div>
      {plan && (
        <div className="notice" role="dialog" aria-label="Podsumowanie importu">
          <p>
            Nowe wpisy: <b>{plan.newSessions.length}</b>. Takie same: {plan.sameSessions}. Różniące się od obecnych: <b>{plan.conflicts.length}</b>.
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={() => void finishImport(false)}>
              Dodaj nowe, zachowaj obecne
            </button>
            {plan.conflicts.length > 0 && (
              <button type="button" className="btn" onClick={() => void finishImport(true)}>
                Dodaj nowe i nadpisz różniące się
              </button>
            )}
            <button type="button" className="btn" onClick={() => setPlan(null)}>
              Anuluj
            </button>
          </div>
        </div>
      )}
      <p className="hint" aria-live="polite">
        {msg}
      </p>
    </section>
  );
}

export function SettingsScreen() {
  const { settings, save, phase } = useSettings();
  const auto = phaseForDate(settings.phases, todayIso());
  const setNum = (key: NumKey) => (v: number) => void save({ [key]: v } as Partial<Settings>);

  return (
    <main className="page">
      <h1 className="page-title">Ustawienia</h1>
      <FtpSection />

      <section className="card" aria-labelledby="hr-h">
        <h2 id="hr-h">Tętno</h2>
        <div className="grid-2">
          {NUM_FIELDS.map((f) => (
            <NumberField key={f.key} label={f.label} hint={f.hint} value={settings[f.key]} min={f.min} max={f.max} onCommit={setNum(f.key)} />
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="phase-h">
        <h2 id="phase-h">Faza sezonu</h2>
        <div className="field">
          <label htmlFor="phase">Która wersja treningów</label>
          <select
            id="phase"
            className="input"
            value={settings.phaseOverride ?? ''}
            onChange={(e) => void save({ phaseOverride: (e.target.value || undefined) as PhaseId | undefined })}
          >
            <option value="">Automatycznie z kalendarza ({auto.name})</option>
            {settings.phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}: {p.name}
              </option>
            ))}
          </select>
          <span className="hint">
            Teraz: {phase.name}, {prettyDate(phase.start)} – {prettyDate(phase.end)}.
          </span>
        </div>
      </section>

      <section className="card" aria-labelledby="timer-h">
        <h2 id="timer-h">Timer</h2>
        <label className="switch">
          <input type="checkbox" checked={settings.timer.sound} onChange={(e) => void save({ timer: { ...settings.timer, sound: e.target.checked } })} />
          <span>Sygnały przed zmianą odcinka</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={settings.timer.voice} onChange={(e) => void save({ timer: { ...settings.timer, voice: e.target.checked } })} />
          <span>Głos zapowiada odcinek (nazwa, czas, waty, kadencja)</span>
        </label>
        <p className="hint">Jeśli nie słychać sygnałów, sprawdź głośność i przełącznik wyciszenia z boku iPhone’a.</p>
      </section>

      <VoiceSection />

      <DataSection />
      <p className="muted version">Puch i Rower · wersja {__APP_VERSION__}</p>
    </main>
  );
}
